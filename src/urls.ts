import type { Env, ShortenRequest, UrlRecord, UrlRecordStored } from "./types";
import { json, jsonError } from "./auth";
import { log } from "./log";
import { collectAudit, parseAuditQuery } from "./audit";

const CODE_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 7;
const MAX_URL_LENGTH = 2048;
const CUSTOM_CODE_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const LIST_CLICK_CONCURRENCY = 25;

function nowBrasilia(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-03:00`;
}

function clickStub(env: Env, code: string) {
  return env.CLICK_COUNTER.getByName(code);
}

async function resolveClicks(
  env: Env,
  code: string,
  legacyClicks?: number,
): Promise<number> {
  const stub = clickStub(env, code);
  if (legacyClicks && legacyClicks > 0) {
    return stub.seedIfEmpty(legacyClicks);
  }
  return stub.getCount();
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) || 0 },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function parseStored(raw: string): UrlRecordStored | null {
  try {
    const record = JSON.parse(raw) as UrlRecordStored;
    if (!record || typeof record.url !== "string" || typeof record.created_at !== "string") {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export function normalizeBaseUrl(request: Request, env: Env): string {
  const configured = env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function validateHttpUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (raw.trim().length > MAX_URL_LENGTH) {
    return null;
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    return null;
  }
  return parsed;
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

async function allocateCode(env: Env, preferred?: string): Promise<string | Response> {
  if (preferred !== undefined) {
    if (!CUSTOM_CODE_RE.test(preferred)) {
      return jsonError(
        "Código inválido: use 3-32 caracteres (letras, números, _ ou -)",
        400,
      );
    }
    if (["urls", "shorten", "health"].includes(preferred.toLowerCase())) {
      return jsonError("Código reservado", 400);
    }
    const existing = await env.URLS.get(preferred);
    if (existing !== null) {
      return jsonError("Código já em uso", 409);
    }
    return preferred;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const existing = await env.URLS.get(code);
    if (existing === null) {
      return code;
    }
  }
  return jsonError("Não foi possível gerar um código único", 500);
}

export async function createShortUrl(
  request: Request,
  env: Env,
  publicRequest = false,
): Promise<Response> {
  let body: ShortenRequest;
  try {
    const reader = request.body?.getReader();
    if (!reader) return jsonError("JSON inválido", 400);
    const decoder = new TextDecoder();
    let size = 0;
    let text = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return jsonError("Solicitação muito grande", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode()) as ShortenRequest;
  } catch {
    return jsonError("JSON inválido", 400);
  }

  if (!body || typeof body.url !== "string") {
    return jsonError("Campo 'url' é obrigatório", 400);
  }

  if (publicRequest && body.code !== undefined) {
    return jsonError("Códigos personalizados exigem acesso autenticado", 400);
  }

  const parsed = validateHttpUrl(body.url);
  if (!parsed) {
    return jsonError("URL inválida: use http:// ou https://", 400);
  }

  const custom =
    typeof body.code === "string" && body.code.length > 0
      ? body.code
      : undefined;
  const codeOrError = await allocateCode(env, custom);
  if (codeOrError instanceof Response) {
    return codeOrError;
  }

  const stored: UrlRecordStored = {
    url: parsed.toString(),
    created_at: nowBrasilia(),
  };

  await env.URLS.put(codeOrError, JSON.stringify(stored));

  const base = normalizeBaseUrl(request, env);
  const shortUrl = `${base}/${codeOrError}`;

  log.info("url.created", {
    code: codeOrError,
    custom: Boolean(custom),
    host: parsed.hostname,
  });

  return json(
    {
      code: codeOrError,
      short_url: shortUrl,
      url: stored.url,
      created_at: stored.created_at,
      clicks: 0,
    },
    201,
  );
}

export async function createPublicShortUrl(request: Request, env: Env): Promise<Response> {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return jsonError("Origem não permitida", 403);
  }
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return jsonError("Envie uma solicitação JSON", 415);
  }
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return jsonError("Não foi possível verificar a conexão. Tente novamente.", 503);
  const { success } = await env.PUBLIC_RATE_LIMIT.limit({ key: `encurtador:public:${ip}` });
  if (!success) {
    const response = jsonError("Você chegou ao limite de solicitações. Aguarde um minuto e tente novamente.", 429);
    response.headers.set("Retry-After", "60");
    return response;
  }
  return createShortUrl(request, env, true);
}

export async function listUrls(env: Env): Promise<Response> {
  const storedItems: Array<{ code: string; record: UrlRecordStored }> = [];
  let cursor: string | undefined;

  do {
    const page = await env.URLS.list({ cursor, limit: 1000 });
    for (const key of page.keys) {
      const raw = await env.URLS.get(key.name);
      if (!raw) continue;
      const record = parseStored(raw);
      if (!record) continue;
      storedItems.push({ code: key.name, record });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const items = await mapPool(
    storedItems,
    LIST_CLICK_CONCURRENCY,
    async ({ code, record }): Promise<UrlRecord & { code: string }> => ({
      code,
      url: record.url,
      created_at: record.created_at,
      clicks: await resolveClicks(env, code, record.clicks),
    }),
  );

  log.info("url.listed", { count: items.length });

  return json({ count: items.length, items });
}

export async function getUrl(env: Env, code: string): Promise<Response> {
  const raw = await env.URLS.get(code);
  if (raw === null) {
    return jsonError("Link não encontrado", 404);
  }
  const record = parseStored(raw);
  if (!record) {
    return jsonError("Registro corrompido", 500);
  }

  const clicks = await resolveClicks(env, code, record.clicks);

  log.info("url.fetched", { code, clicks });

  return json({
    code,
    url: record.url,
    created_at: record.created_at,
    clicks,
  });
}

export async function deleteUrl(env: Env, code: string): Promise<Response> {
  const raw = await env.URLS.get(code);
  if (raw === null) {
    return jsonError("Link não encontrado", 404);
  }

  await Promise.all([
    env.URLS.delete(code),
    clickStub(env, code).reset(),
  ]);

  log.info("url.deleted", { code });

  return json({ deleted: true, code });
}

export async function redirect(
  request: Request,
  env: Env,
  code: string,
  ctx: ExecutionContext,
): Promise<Response> {
  const raw = await env.URLS.get(code);
  if (raw === null) {
    log.warn("redirect.not_found", { code });
    return jsonError("Link não encontrado", 404);
  }

  const record = parseStored(raw);
  if (!record) {
    log.error("redirect.corrupt_record", { code });
    return jsonError("Registro corrompido", 500);
  }

  ctx.waitUntil(
    clickStub(env, code)
      .increment(collectAudit(request, code, record.url), record.clicks)
      .then((clicks) => {
        log.info("click.incremented", { code, clicks });
      })
      .catch((error: unknown) => {
        log.error("click.increment_failed", { code }, error);
      }),
  );

  log.info("redirect.ok", { code, host: new URL(record.url).hostname });

  return new Response(null, {
    status: 302,
    headers: {
      Location: record.url,
      "Cache-Control": "no-store",
    },
  });
}

export async function getClicks(request: Request, env: Env, code: string): Promise<Response> {
  const query = parseAuditQuery(new URL(request.url).searchParams);
  if (!query) return jsonError('Consulta inválida: limit 1-100, cursor numérico e datas UTC ISO 8601 (from <= until)', 400);
  if (await env.URLS.get(code) === null) return jsonError('Link não encontrado', 404);
  return json(await clickStub(env, code).listEvents(query));
}
