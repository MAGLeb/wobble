// WOBBLE GameCore - вся серверная механика (docs/14 §2) над KV.
// Побочные эффекты (мемориал-пост, флаир, realtime) - через hooks, вызываются
// СТРОГО ПОСЛЕ фиксации состояния (красная команда: иначе дубль-мемориалы).
// На Devvit: KV → redis, hooks → reddit.submitPost / setUserFlair / realtime.send.

import { CONFIG } from '../shared/config.mjs';
import { applyDrop, regenEnergy, msToNextEnergy, limitAt } from '../shared/math.mjs';

const K = {
  tower: 'tower_current',
  counter: 'tower_counter',
  lock: 'turn_lock',
  next: 'turn_next',            // FIFO-слот «you're next» (один, docs/14 §2)
  last: 'last_builder',         // «не подряд»: кто положил последний этаж
  archive: (id) => `tower_archive_${id}`,
  energy: (u) => `energy_${u}`,
  stats: (u) => `stats_${u}`,
};

const freshTower = (id, now) => ({ id, blocks: [], L: 0, createdAt: now, lastEventSeq: 0 });

export class GameCore {
  /**
   * @param {InMemoryKV} kv
   * @param {{onMemorial?:Function, onEvent?:Function, onFlair?:Function}} hooks
   * @param {() => number} now
   */
  constructor(kv, hooks = {}, now = () => Date.now()) {
    this.kv = kv; this.hooks = hooks; this.now = now; this.cfg = CONFIG;
  }

  async #tower() {
    let t = await this.kv.get(K.tower);
    if (!t) { t = freshTower(1, this.now()); await this.kv.set(K.tower, t); await this.kv.set(K.counter, 1); }
    return t;
  }

  async #emit(type, payload, seq) { if (this.hooks.onEvent) await this.hooks.onEvent({ type, ...payload, seq }); }

  // «Память кривизны» (идея пользователя 14.07): средний |промах| по ВСЕЙ истории башни, 0..1.
  // Текущий крен можно выровнять - кривизну истории не выровняешь: кривая башня качается
  // сильнее и строится труднее (быстрее и более рваный свип). Обвал по-прежнему только по |L|.
  #crookOf(t) {
    if (!t.blocks.length) return 0;
    let s = 0; for (const b of t.blocks) s += Math.abs(b.o ?? 0);
    return Math.min(1, (s / t.blocks.length) / this.cfg.oMax);
  }

  async #queue() { return (await this.kv.get(K.next)) ?? []; }
  #freshQueue(q, now) { return q.filter((e) => now - e.ts < this.cfg.lockTtlMs); } // не тапал 15с - выбыл

  /** Публичное состояние для клиента. */
  async state(userId) {
    const now = this.now();
    const t = await this.#tower();
    const lock = await this.kv.get(K.lock);
    const queue = this.#freshQueue(await this.#queue(), now);
    const energy = userId ? regenEnergy(await this.kv.get(K.energy(userId)), now, this.cfg) : null;
    const lastB = userId ? await this.kv.get(K.last) : null;
    const stats = userId ? (await this.kv.get(K.stats(userId))) ?? { placed: 0, survived: 0, caused: 0 } : null;
    const fallen = ((await this.kv.get(K.counter)) ?? 1) - 1;
    return {
      tower: { id: t.id, h: t.blocks.length, L: t.L, limit: limitAt(t.blocks.length, this.cfg),
               crook: this.#crookOf(t),
               blocks: t.blocks, createdAt: t.createdAt, seq: t.lastEventSeq },
      fallenCount: fallen,
      turn: lock ? { user: lock.user, expiresAt: lock.expiresAt } : null,
      queueLen: queue.length,
      me: userId ? {
        energy: energy.n,
        msToNext: msToNextEnergy(energy, now, this.cfg),
        stats,
        // «не подряд»: сколько мне ждать (0 = можно строить); чужой дроп обнуляет
        repeatMsLeft: (lastB && lastB.u === userId)
          ? Math.max(0, this.cfg.repeatCooldownMs - (now - lastB.ts)) : 0,
      } : null,
      cfg: { oMax: this.cfg.oMax, sweepSpeed: this.cfg.sweepSpeed, sweepRamp: this.cfg.sweepRamp,
             blockW: this.cfg.blockW, blockH: this.cfg.blockH, energyCap: this.cfg.energyCap,
             limit0: this.cfg.limit0, limitMin: this.cfg.limitMin, limitRefH: this.cfg.limitRefH,
             practice: this.cfg.practice, lockTtlMs: this.cfg.lockTtlMs,
             repeatCooldownMs: this.cfg.repeatCooldownMs },
    };
  }

  /** Взять ход. Энергия НЕ списывается (только при дропе). */
  async claim(userId) {
    if (!userId) return { ok: false, reason: 'login_required' };
    const now = this.now();
    const energy = regenEnergy(await this.kv.get(K.energy(userId)), now, this.cfg);
    if (energy.n <= 0) return { ok: false, reason: 'no_energy', msToNext: msToNextEnergy(energy, now, this.cfg) };

    // «Не подряд»: последний этаж клал ты → жди чужого дропа или кулдауна
    const lastB = await this.kv.get(K.last);
    if (lastB && lastB.u === userId && (now - lastB.ts) < this.cfg.repeatCooldownMs) {
      return { ok: false, reason: 'consecutive', msLeft: this.cfg.repeatCooldownMs - (now - lastB.ts) };
    }

    // Очередь (фидбек 14.07): первый в очереди имеет приоритет на свободный ход.
    // Живость через touch: повторный claim обновляет ts; молчание 15с - выбыл.
    let queue = this.#freshQueue(await this.#queue(), now);
    const myPos = queue.findIndex((e) => e.u === userId); // -1 если не в очереди
    const firstIsMe = queue.length === 0 || myPos === 0;
    if (firstIsMe) {
      const token = Math.random().toString(36).slice(2) + now.toString(36);
      const lockVal = { user: userId, token, expiresAt: now + this.cfg.lockTtlMs };
      const got = await this.kv.set(K.lock, lockVal, { nx: true, expirationMs: this.cfg.lockTtlMs });
      if (got) {
        if (myPos === 0) { queue.shift(); await this.kv.set(K.next, queue); } // моя бронь употреблена
        const t = await this.#tower();
        await this.#emit('turn_claimed', { user: userId, towerId: t.id }, t.lastEventSeq);
        return { ok: true, token, expiresAt: lockVal.expiresAt,
                 frozen: { h: t.blocks.length, L: t.L, crook: this.#crookOf(t) } };
      }
    }
    const holder = await this.kv.get(K.lock);
    if (holder && holder.user === userId) return { ok: false, reason: 'already_yours' };
    // встать в очередь / обновить свой ts (touch)
    if (myPos >= 0) queue[myPos] = { u: userId, ts: now };
    else if (queue.length < 30) queue.push({ u: userId, ts: now });
    await this.kv.set(K.next, queue);
    const pos = queue.findIndex((e) => e.u === userId) + 1; // 1-based; 0 = не влез
    return { ok: false, reason: 'busy', holder: holder?.user ?? null,
             position: pos || null, queueLen: queue.length, youAreNext: pos === 1 };
  }

  /** Продлить лок, пока игрок целится. */
  async heartbeat(userId, token) {
    const lock = await this.kv.get(K.lock);
    if (!lock || lock.user !== userId || lock.token !== token) return { ok: false };
    const expiresAt = this.now() + this.cfg.lockTtlMs;
    await this.kv.set(K.lock, { ...lock, expiresAt }, { expirationMs: this.cfg.lockTtlMs });
    return { ok: true, expiresAt };
  }

  /**
   * Дроп. Токен сверяется (не верим TTL - красная команда, находка №1).
   * Возврат: {ok, o, L, h, collapsed, memorial?}
   */
  async drop(userId, token, rawOffset) {
    if (!userId) return { ok: false, reason: 'login_required' };
    const now = this.now();
    const lock = await this.kv.get(K.lock);
    if (!lock || lock.user !== userId || lock.token !== token || lock.expiresAt <= now) {
      return { ok: false, reason: 'lock_lost' };
    }
    const energy = regenEnergy(await this.kv.get(K.energy(userId)), now, this.cfg);
    if (energy.n <= 0) { await this.kv.del(K.lock); return { ok: false, reason: 'no_energy' }; }

    const t = await this.#tower();
    const res = applyDrop({ L: t.L, h: t.blocks.length }, rawOffset, this.cfg);

    // --- фиксация состояния (локально последовательно; на Devvit: watch/multi по K.tower) ---
    let memorial = null;
    const seq = t.lastEventSeq + 1;
    if (!res.collapsed) {
      t.blocks.push({ dx: res.L, o: res.o, u: userId, ts: now });
      t.L = res.L; t.lastEventSeq = seq;
      await this.kv.set(K.tower, t);
    } else {
      const counter = ((await this.kv.get(K.counter)) ?? 1);
      const archived = {
        ...t,
        blocks: [...t.blocks, { dx: res.L, o: res.o, u: userId, ts: now }],
        L: res.L, fellAt: now, fellHeight: res.h, culprit: userId,
      };
      await this.kv.set(K.archive(t.id), archived);
      await this.kv.set(K.counter, counter + 1);
      await this.kv.set(K.tower, freshTower(counter + 1, now));
      memorial = this.#memorialData(archived);
    }
    await this.kv.set(K.energy(userId), { n: energy.n - 1, ts: energy.n === this.cfg.energyCap ? now : energy.ts });
    const st = (await this.kv.get(K.stats(userId))) ?? { placed: 0, survived: 0, caused: 0 };
    st.placed += 1; if (res.collapsed) st.caused += 1;
    await this.kv.set(K.stats(userId), st);
    await this.kv.del(K.lock);
    if (res.collapsed) await this.kv.del(K.last);                    // новая башня - чистый лист
    else await this.kv.set(K.last, { u: userId, ts: now });          // «не подряд»
    // ожидающий в слоте заклеймит сам (у него приоритет в claim)
    // --- side-эффекты СТРОГО после фиксации ---
    if (!res.collapsed) {
      await this.#emit('block_placed', { user: userId, towerId: t.id, dx: res.L, o: res.o, L: res.L, h: res.h }, seq);
    } else {
      // survived-статы всем строителям павшей башни (кроме виновника)
      const builders = new Set(memorial.topBuilders.map(b => b.u));
      for (const b of builders) if (b !== userId) {
        const s = (await this.kv.get(K.stats(b))) ?? { placed: 0, survived: 0, caused: 0 };
        s.survived += 1; await this.kv.set(K.stats(b), s);
      }
      await this.#emit('collapse', { towerId: memorial.towerId, h: memorial.height, culprit: userId }, seq);
      if (this.hooks.onMemorial) await this.hooks.onMemorial(memorial);
    }
    if (this.hooks.onFlair) await this.hooks.onFlair(userId, st);
    return { ok: true, ...res, collapsed: res.collapsed, memorial };
  }

  #memorialData(archived) {
    const byUser = new Map();
    for (const b of archived.blocks) byUser.set(b.u, (byUser.get(b.u) ?? 0) + 1);
    const topBuilders = [...byUser.entries()].map(([u, n]) => ({ u, n }))
      .sort((a, b) => b.n - a.n).slice(0, 5);
    // статистика жизни башни (фидбек 14.07): идеальные дропы и «герой» - лучший спасающий дроп
    let perfect = 0, hero = null, prev = 0;
    for (const b of archived.blocks) {
      if (Math.abs(b.o ?? 0) <= 2) perfect++;
      const saved = Math.abs(prev) - Math.abs(b.dx);
      if (saved > 2 && (!hero || saved > hero.saved)) hero = { u: b.u, saved: Math.round(saved) };
      prev = b.dx;
    }
    return {
      towerId: archived.id, height: archived.fellHeight, culprit: archived.culprit,
      lifetimeMs: archived.fellAt - archived.createdAt, topBuilders,
      buildersCount: byUser.size, perfect, hero,
      title: `\u{1F3DB} Tower #${archived.id} fell at storey ${archived.fellHeight} - toppled by u/${archived.culprit}`,
    };
  }

  /** Архив павшей башни (мемориал-режим клиента). */
  async archive(id) { return this.kv.get(K.archive(id)); }
}
