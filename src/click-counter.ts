import { DurableObject } from "cloudflare:workers";
import { auditExpiresAt, type AuditMetadata, type AuditQuery } from "./audit";
import type { Env } from "./types";

export class ClickCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        metadata TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_expiry ON audit_events(expires_at);
      CREATE INDEX IF NOT EXISTS audit_time ON audit_events(created_at);
    `);
  }

  async increment(metadata: AuditMetadata, legacyClicks = 0): Promise<number> {
    const timestamp = Date.parse(metadata.created_at);
    const expires = auditExpiresAt(timestamp, this.env.AUDIT_RETENTION_MONTHS);
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > expires) await this.ctx.storage.setAlarm(expires);
    return this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.kv.get<number>('clicks') ?? Math.max(0, Math.floor(legacyClicks));
      this.ctx.storage.sql.exec('INSERT INTO audit_events (created_at, expires_at, metadata) VALUES (?, ?, ?)', timestamp, expires, JSON.stringify(metadata));
      this.ctx.storage.kv.put('clicks', current + 1);
      return current + 1;
    });
  }

  listEvents(query: AuditQuery) {
    const rows = this.ctx.storage.sql.exec<{ id: number; created_at: number; expires_at: number; metadata: string }>(
      'SELECT id, created_at, expires_at, metadata FROM audit_events WHERE id < ? AND created_at >= ? AND created_at <= ? AND expires_at > ? ORDER BY id DESC LIMIT ?',
      query.cursor, query.from, query.until, Date.now(), query.limit + 1,
    ).toArray();
    const items = rows.slice(0, query.limit).map(row => ({
      ...JSON.parse(row.metadata) as AuditMetadata,
      id: row.id, created_at: new Date(row.created_at).toISOString(), expires_at: new Date(row.expires_at).toISOString(),
    }));
    return { items, next_cursor: rows.length > query.limit ? String(items[items.length - 1]!.id) : null };
  }

  async alarm(): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM audit_events WHERE id IN (SELECT id FROM audit_events WHERE expires_at <= ? ORDER BY expires_at LIMIT 1000)', Date.now());
    const next = this.ctx.storage.sql.exec<{ expires_at: number }>('SELECT expires_at FROM audit_events ORDER BY expires_at LIMIT 1').toArray()[0];
    if (next) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next.expires_at));
  }

  async getCount(): Promise<number> {
    return (await this.ctx.storage.get<number>("clicks")) ?? 0;
  }

  /** Migra contagem legada do KV uma única vez (se o DO ainda estiver em 0). */
  async seedIfEmpty(value: number): Promise<number> {
    const current = this.ctx.storage.kv.get<number>("clicks") ?? 0;
    if (current > 0) {
      return current;
    }
    const seeded = Math.max(0, Math.floor(value));
    if (seeded > 0) {
      this.ctx.storage.kv.put("clicks", seeded);
    }
    return seeded;
  }

  async reset(): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('DELETE FROM audit_events');
      this.ctx.storage.kv.delete('clicks');
    });
    await this.ctx.storage.deleteAlarm();
  }
}
