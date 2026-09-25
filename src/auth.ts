import type { Env } from "./types";

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i]! ^ bufB[i]!;
  }
  return diff === 0;
}

export function requireApiKey(request: Request, env: Env): Response | null {
  if (!env.API_KEY) {
    return jsonError("API_KEY não configurada no Worker", 500);
  }
  const provided = request.headers.get("X-API-Key") ?? "";
  if (!provided || !timingSafeEqual(provided, env.API_KEY)) {
    return jsonError("Não autorizado", 401);
  }
  return null;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}
