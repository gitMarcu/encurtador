import { json, jsonError, requireApiKey } from "./auth";
import { log } from "./log";
import type { Env } from "./types";
import {
  createShortUrl,
  deleteUrl,
  getUrl,
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

      const urlMatch = path.match(/^\/urls\/([^/]+)$/);
      if (urlMatch) {
        const code = decodeURIComponent(urlMatch[1]!);
        const unauthorized = requireApiKey(request, env);
        if (unauthorized) {
          log.warn("auth.denied", { method, path });
          return withCors(unauthorized);
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
          return await redirect(env, code, ctx);
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
