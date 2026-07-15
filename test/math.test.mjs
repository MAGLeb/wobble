import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/shared/config.mjs';
import { limitAt, clampOffset, applyDrop, regenEnergy, msToNextEnergy } from '../src/shared/math.mjs';

test('анти-гриф: один блок с ровной башни не роняет НИКОГДА (на любой высоте)', () => {
  for (let h = 0; h <= 500; h++) {
    const r = applyDrop({ L: 0, h }, 1e9, CONFIG); // максимально злой промах
    assert.equal(r.collapsed, false, `упала при h=${h}, L=${r.L}, limit=${r.limit}`);
    assert.ok(Math.abs(r.o) <= CONFIG.oMax);
  }
});

test('двое неряшливых на ВЫСОКОЙ башне роняют (2·oMax > limitMin)', () => {
  assert.ok(2 * CONFIG.oMax > CONFIG.limitMin, 'инвариант «двое роняют» сломан');
  const high = CONFIG.limitRefH + 10;
  const r1 = applyDrop({ L: 0, h: high }, CONFIG.oMax, CONFIG);
  assert.equal(r1.collapsed, false, 'первый неряшливый не должен ронять с ровной');
  const r2 = applyDrop({ L: r1.L, h: r1.h }, CONFIG.oMax, CONFIG);
  assert.equal(r2.collapsed, true, 'второй неряшливый в ту же сторону обязан ронять высокую');
});

test('двое неряшливых на НИЗКОЙ башне прощаются (limit0 > 2·oMax)', () => {
  assert.ok(CONFIG.limit0 > 2 * CONFIG.oMax);
  const r1 = applyDrop({ L: 0, h: 0 }, CONFIG.oMax, CONFIG);
  const r2 = applyDrop({ L: r1.L, h: r1.h }, CONFIG.oMax, CONFIG);
  assert.equal(r2.collapsed, false, 'низкая башня должна прощать двоих');
});

test('дроп против крена СНИЖАЕТ L (роль спасителя)', () => {
  const r = applyDrop({ L: 20, h: 30 }, -CONFIG.oMax, CONFIG);
  assert.ok(Math.abs(r.L) < 20);
});

test('limitAt монотонно сжимается и не пробивает limitMin', () => {
  let prev = Infinity;
  for (let h = 0; h <= 300; h++) {
    const l = limitAt(h, CONFIG);
    assert.ok(l <= prev + 1e-9, 'Предел должен сжиматься');
    assert.ok(l >= CONFIG.limitMin - 1e-9);
    prev = l;
  }
  assert.equal(limitAt(0, CONFIG), CONFIG.limit0);
});

test('clampOffset: мусор и бесконечности не проходят', () => {
  assert.equal(clampOffset(NaN, CONFIG), 0);
  assert.equal(clampOffset(Infinity, CONFIG), 0);
  assert.equal(clampOffset(1e9, CONFIG), CONFIG.oMax);
  assert.equal(clampOffset(-1e9, CONFIG), -CONFIG.oMax);
});

test('каденция: медиана высоты обвала в окне 60–120 при смешанной толпе (бот-сим)', () => {
  // Толпа: 60% нормальные (|o| ~ 0..10), 30% средние (0..20), 10% криворукие (0..oMax);
  // 70% целятся ПРОТИВ крена (люди правят башню). Промах растёт со скоростью свипа —
  // это и есть рычаг каденции (sweepRamp): выше башня → быстрее блок → крупнее промахи.
  let seed = 42;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const falls = [];
  for (let run = 0; run < 400; run++) {
    let L = 0, h = 0;
    for (let i = 0; i < 5000; i++) {
      const speedK = 1 + h * CONFIG.sweepRamp / CONFIG.sweepSpeed;
      const p = rnd();
      const mag = (p < 0.6 ? rnd() * 10 : p < 0.9 ? rnd() * 20 : rnd() * CONFIG.oMax) * speedK;
      const sign = rnd() < 0.7 ? -Math.sign(L || (rnd() - 0.5)) : (rnd() < 0.5 ? -1 : 1);
      const r = applyDrop({ L, h }, sign * Math.min(mag, CONFIG.oMax), CONFIG);
      L = r.L; h = r.h;
      if (r.collapsed) { falls.push(h); break; }
    }
  }
  falls.sort((a, b) => a - b);
  const med = falls[Math.floor(falls.length / 2)];
  assert.ok(falls.length >= 390, 'почти все прогоны должны заканчиваться обвалом');
  assert.ok(med >= 60 && med <= 120, `медиана ${med} вне окна 60-120 — крути sweepRamp`);
  console.log(`    каденция: медиана=${med}, p10=${falls[Math.floor(falls.length*0.1)]}, p90=${falls[Math.floor(falls.length*0.9)]}`);
});

test('энергия: новичок 3; регенерация 1/3ч с потолком; таймер до следующего', () => {
  const now = 1_000_000_000_000;
  const fresh = regenEnergy(null, now, CONFIG);
  assert.deepEqual(fresh, { n: CONFIG.energyStart, ts: now });
  const spent = { n: 0, ts: now };
  assert.equal(regenEnergy(spent, now + CONFIG.energyRegenMs - 1, CONFIG).n, 0);
  assert.equal(regenEnergy(spent, now + CONFIG.energyRegenMs, CONFIG).n, 1);
  assert.equal(regenEnergy(spent, now + 100 * CONFIG.energyRegenMs, CONFIG).n, CONFIG.energyCap);
  assert.equal(msToNextEnergy(spent, now + 1000, CONFIG), CONFIG.energyRegenMs - 1000);
  assert.equal(msToNextEnergy({ n: 2, ts: now }, now, CONFIG), 0);
});
