// Адаптер KV-контракта GameCore поверх Devvit Redis.
// Контракт (см. kv.mjs): get(key)→объект|undefined · set(key, value, {nx, expirationMs})→boolean · del(key).
// Значения — JSON-строки. Успех SET NX проверяем перечитыванием (возврат set при занятом NX не специфицирован).

export class DevvitKV {
  /** @param {{get:Function,set:Function,del:Function}} redis Devvit redis client */
  constructor(redis) { this.r = redis; }

  async get(key) {
    const raw = await this.r.get(key);
    if (raw === undefined || raw === null || raw === '') return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  }

  async set(key, value, opts = {}) {
    const payload = JSON.stringify(value);
    const o = {};
    if (opts.nx) o.nx = true;
    if (opts.expirationMs) o.expiration = new Date(Date.now() + opts.expirationMs);
    await this.r.set(key, payload, Object.keys(o).length ? o : undefined);
    if (opts.nx) { // подтверждаем владение перечитыванием
      const now = await this.r.get(key);
      return now === payload;
    }
    return true;
  }

  async del(key) { await this.r.del(key); }
}
