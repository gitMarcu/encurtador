import { DurableObject } from "cloudflare:workers";

/**
 * Um Durable Object por código curto.
 * Requests ao mesmo objeto são serializados → incremento atômico e exato.
 */
export class ClickCounter extends DurableObject {
  async increment(): Promise<number> {
    const current = (await this.ctx.storage.get<number>("clicks")) ?? 0;
    const next = current + 1;
    await this.ctx.storage.put("clicks", next);
    return next;
  }

  async getCount(): Promise<number> {
    return (await this.ctx.storage.get<number>("clicks")) ?? 0;
  }

  /** Migra contagem legada do KV uma única vez (se o DO ainda estiver em 0). */
  async seedIfEmpty(value: number): Promise<number> {
    const current = (await this.ctx.storage.get<number>("clicks")) ?? 0;
    if (current > 0) {
      return current;
    }
    const seeded = Math.max(0, Math.floor(value));
    if (seeded > 0) {
      await this.ctx.storage.put("clicks", seeded);
    }
    return seeded;
  }

  async reset(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
