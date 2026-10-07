import { json, jsonError, requireApiKey } from "./auth";
import { log } from "./log";
import type { Env } from "./types";
import {
  createShortUrl,
  createPublicShortUrl,
  deleteUrl,
  getUrl,
  getClicks,
  listUrls,
  redirect,
} from "./urls";

export { ClickCounter } from "./click-counter";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      if (path === "/public/shorten") {
        if (method !== "POST") return jsonError("Método não permitido", 405);
        return await createPublicShortUrl(request, env);
      }
      if ((method === "GET" || method === "HEAD") &&
          (path === "/" && !request.headers.get("Accept")?.includes("application/json") ||
           path.startsWith("/_next/") || path === "/favicon.svg")) {
        const assetUrl = new URL(request.url);
        if (path === "/") assetUrl.pathname = "/index.html";
        const response = await env.ASSETS.fetch(new Request(assetUrl, request));
        const headers = new Headers(response.headers);
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
        return new Response(response.body, { status: response.status, headers });
      }
      if (method === "GET" && path === "/health") {
        return withCors(json({ status: "ok" }));
      }

      if (method === "POST" && path === "/shorten") {
        const unauthorized = requireApiKey(request, env);
        if (unauthorized) {
          log.warn("auth.denied", { method, path });
          return withCors(unauthorized);
        }
        return withCors(await createShortUrl(request, env));
      }

      if (method === "GET" && path === "/urls") {
        const unauthorized = requireApiKey(request, env);
        if (unauthorized) {
          log.warn("auth.denied", { method, path });
          return withCors(unauthorized);
        }
        return withCors(await listUrls(env));
      }

      const urlMatch = path.match(/^\/urls\/([a-zA-Z0-9_-]{3,32})(\/clicks)?$/);
      if (urlMatch) {
        const code = decodeURIComponent(urlMatch[1]!);
        const unauthorized = requireApiKey(request, env);
        if (unauthorized) {
          log.warn("auth.denied", { method, path });
          return withCors(unauthorized);
        }

        if (urlMatch[2]) {
          if (method !== 'GET') return withCors(jsonError('Método não permitido', 405));
          return withCors(await getClicks(request, env, code));
        }
        if (method === "GET") {
          return withCors(await getUrl(env, code));
        }
        if (method === "DELETE") {
          return withCors(await deleteUrl(env, code));
        }
        return withCors(jsonError("Método não permitido", 405));
      }

      if (method === "GET" && path !== "/") {
        const code = decodeURIComponent(path.slice(1));
        if (!code.includes("/")) {
          return await redirect(request, env, code, ctx);
        }
      }

      if (method === "GET" && path === "/") {
        return withCors(
          json({
            name: "encurtador",
            endpoints: {
              "POST /shorten": "Cria link curto (X-API-Key)",
              "GET /{code}": "Redireciona (público) + clique atômico (Durable Object)",
              "GET /urls": "Lista links + cliques exatos (X-API-Key)",
              "GET /urls/{code}": "Detalhes + cliques exatos (X-API-Key)",
              "GET /urls/{code}/clicks": "Auditoria paginada: limit, cursor, from, until (X-API-Key)",
              "DELETE /urls/{code}": "Remove link e contador (X-API-Key)",
              "GET /health": "Health check",
            },
          }),
        );
      }

      return withCors(jsonError("Não encontrado", 404));
    } catch (error) {
      log.error("request.unhandled", { method, path }, error);
      return withCors(jsonError("Erro interno", 500));
    }
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
