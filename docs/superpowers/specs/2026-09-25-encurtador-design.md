# Encurtador — Design

**Data:** 2026-09-25  
**Stack:** Cloudflare Worker (TypeScript) + Workers KV  
**Auth:** header `X-API-Key` (secret `API_KEY`)

## Escopo

API REST completa: criar, redirecionar, listar, estatísticas (cliques) e deletar. Persistência no KV da Cloudflare. Sem UI web.

## Modelo de dados

- **KV key:** código curto — value `{ "url", "created_at" }`
- **Durable Object `ClickCounter`:** 1 instância por código — storage `clicks` (SQLite-backed)
- Migração legada: se o KV ainda tiver `clicks`, `seedIfEmpty` copia uma vez para o DO

## Contagem de cliques

- Redirect: 302 imediato + `waitUntil(increment())` no DO
- Serialização do DO → contador exacto sob concorrência
- Listagem: leituras do DO com pool de concorrência (25)

## Rotas

Ver README.md.

## Restrições

- Validação de URL (apenas http/https)
- Códigos reservados: `urls`, `shorten`, `health`
- Redirect com `Cache-Control: no-store`
