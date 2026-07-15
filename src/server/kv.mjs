// KV-интерфейс в форме Devvit Redis-подмножества, которое использует ядро.
// Локально — InMemoryKV; на Devvit те же 3 метода мапятся на context.redis 1:1:
//   get(key) / set(key, value, {nx, expiration}) / del(key)
// set с {nx:true} — атомарный claim (в Devvit это redis.set(..., {nx:true, expiration})).

export class InMemoryKV {
  constructor(now = () => Date.now()) { this.m = new Map(); this.now = now; }

  #alive(e) { return e && (e.exp === 0 || e.exp > this.now()); }

  async get(key) {
    const e = this.m.get(key);
    if (!this.#alive(e)) { this.m.delete(key); return undefined; }
    return e.v;
  }

  /** @param {{nx?:boolean, expirationMs?:number}} [opts] @returns {Promise<boolean>} успех записи */
  async set(key, value, opts = {}) {
    if (opts.nx) {
      const e = this.m.get(key);
      if (this.#alive(e)) return false;
    }
    this.m.set(key, { v: value, exp: opts.expirationMs ? this.now() + opts.expirationMs : 0 });
    return true;
  }

  async del(key) { this.m.delete(key); }
}
