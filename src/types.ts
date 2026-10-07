import type { ClickCounter } from "./click-counter";

export interface Env {
  ASSETS: Fetcher;
  PUBLIC_RATE_LIMIT: RateLimit;
  URLS: KVNamespace;
  CLICK_COUNTER: DurableObjectNamespace<ClickCounter>;
  API_KEY: string;
  PUBLIC_BASE_URL?: string;
  AUDIT_RETENTION_MONTHS?: string;
}

/** Metadados no KV (cliques vivem no Durable Object). */
export interface UrlRecordStored {
  url: string;
  created_at: string;
  /** Legado: cliques antigos gravados no KV antes do DO. */
  clicks?: number;
}

export interface UrlRecord {
  url: string;
  created_at: string;
  clicks: number;
}

export interface ShortenRequest {
  url: string;
  code?: string;
}
