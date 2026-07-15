// WOBBLE — чистая математика крена (docs/13 §1). Единственный источник истины:
// сервер решает исход ЭТИМИ функциями; клиент использует их же для превью/practice.

/** Предел |L| на данной высоте (этажей уже стоит, не считая плинтуса). */
export function limitAt(h, cfg) {
  const t = Math.min(1, h / cfg.limitRefH);
  return Math.max(cfg.limitMin, cfg.limit0 - (cfg.limit0 - cfg.limitMin) * t);
}

/** Клэмп промаха (сервер обязателен: анти-чит/анти-гриф). */
export function clampOffset(o, cfg) {
  if (!Number.isFinite(o)) return 0;
  return Math.max(-cfg.oMax, Math.min(cfg.oMax, o));
}

/**
 * Применить дроп к башне. Ничего не мутирует.
 * @param {{L:number, h:number}} tower  текущий крен и высота (этажей)
 * @param {number} rawOffset            промах игрока (сырое значение с клиента)
 * @returns {{o:number, L:number, h:number, collapsed:boolean, limit:number}}
 */
export function applyDrop(tower, rawOffset, cfg) {
  const o = clampOffset(rawOffset, cfg);
  const L = tower.L + o;
  const h = tower.h + 1;
  const limit = limitAt(h, cfg);
  return { o, L, h, collapsed: Math.abs(L) >= limit, collapsed_at: h, limit };
}

/** Ленивая регенерация энергии. @returns {{n:number, ts:number}} */
export function regenEnergy(state, now, cfg) {
  if (!state) return { n: cfg.energyStart, ts: now };
  const gained = Math.floor((now - state.ts) / cfg.energyRegenMs);
  if (gained <= 0) return state;
  return { n: Math.min(cfg.energyCap, state.n + gained), ts: state.ts + gained * cfg.energyRegenMs };
}

/** Мс до следующего блока (0 если есть блоки или полный запас). */
export function msToNextEnergy(state, now, cfg) {
  const cur = regenEnergy(state, now, cfg);
  if (cur.n >= cfg.energyCap || cur.n > 0) return 0;
  return Math.max(0, cur.ts + cfg.energyRegenMs - now);
}
