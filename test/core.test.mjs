import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/shared/config.mjs';
import { InMemoryKV } from '../src/server/kv.mjs';
import { GameCore } from '../src/server/core.mjs';

function makeCore() {
  let t = 1_000_000_000_000;
  const now = () => t;
  const events = [], memorials = [], flairs = [];
  const kv = new InMemoryKV(now);
  const core = new GameCore(kv, {
    onEvent: (e) => events.push(e),
    onMemorial: (m) => memorials.push(m),
    onFlair: (u, s) => flairs.push({ u, s }),
  }, now);
  return { core, kv, events, memorials, flairs, tick: (ms) => { t += ms; }, now };
}

test('claim: второй одновременный получает busy + youAreNext; после дропа слот имеет приоритет', async () => {
  const { core, tick } = makeCore();
  const a = await core.claim('alice');
  assert.equal(a.ok, true);
  const b = await core.claim('bob');
  assert.equal(b.ok, false);
  assert.equal(b.reason, 'busy');
  assert.equal(b.youAreNext, true);
  assert.equal(b.position, 1);
  const c = await core.claim('carol');            // очередь: bob #1, carol #2
  assert.equal(c.youAreNext, false);
  assert.equal(c.position, 2);
  assert.equal(c.queueLen, 2);
  await core.drop('alice', a.token, 5);           // ход завершён, лок снят
  const c2 = await core.claim('carol');           // лок свободен, но слот bob'а блокирует
  assert.equal(c2.ok, false);
  const b2 = await core.claim('bob');             // bob получает свой приоритет
  assert.equal(b2.ok, true);
  const c3 = await core.claim('carol');           // слот употреблён, но ход у bob
  assert.equal(c3.ok, false);
  assert.equal(c3.youAreNext, true);              // carol встаёт в освободившийся слот
  tick(1);
});

test('TTL: протухший лок освобождает ход; дроп с протухшим токеном отклонён; энергия не сгорает', async () => {
  const { core, tick } = makeCore();
  const a = await core.claim('alice');
  tick(CONFIG.lockTtlMs + 1);
  const b = await core.claim('bob');              // лок протух → bob берёт
  assert.equal(b.ok, true);
  const late = await core.drop('alice', a.token, 5);
  assert.equal(late.ok, false);
  assert.equal(late.reason, 'lock_lost');
  const st = await core.state('alice');
  assert.equal(st.me.energy, CONFIG.energyStart); // недо-ход не списал энергию
});

test('heartbeat продлевает лок только владельцу с верным токеном', async () => {
  const { core, tick } = makeCore();
  const a = await core.claim('alice');
  tick(CONFIG.lockTtlMs - 1000);
  assert.equal((await core.heartbeat('alice', a.token)).ok, true);
  tick(CONFIG.lockTtlMs - 1000);                  // без heartbeat уже протух бы
  const d = await core.drop('alice', a.token, 3);
  assert.equal(d.ok, true);
  assert.equal((await core.heartbeat('bob', 'fake')).ok, false);
});

test('drop: канон растёт, крен = сумме клэмпнутых промахов, событию присвоен seq', async () => {
  const { core, events, tick } = makeCore();
  const a = await core.claim('u1');
  const d1 = await core.drop('u1', a.token, 10);
  assert.equal(d1.ok, true);
  assert.equal(d1.h, 1);
  assert.equal(d1.L, 10);
  tick(CONFIG.repeatCooldownMs + 1); // правило «не подряд»
  const b = await core.claim('u1');
  const d2 = await core.drop('u1', b.token, 1e9); // клэмп до oMax
  assert.equal(d2.L, 10 + CONFIG.oMax);
  const st = await core.state('u1');
  assert.equal(st.tower.h, 2);
  assert.equal(st.me.energy, CONFIG.energyStart - 2);
  const placed = events.filter(e => e.type === 'block_placed');
  assert.deepEqual(placed.map(e => e.seq), [1, 2]);
});

test('не подряд: повторный claim отклонён; чужой дроп или кулдаун открывают; обвал сбрасывает', async () => {
  const { core, kv, tick } = makeCore();
  const a = await core.claim('alice');
  await core.drop('alice', a.token, 5);
  const again = await core.claim('alice');                 // сразу после своего дропа
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'consecutive');
  assert.ok(again.msLeft > 0 && again.msLeft <= CONFIG.repeatCooldownMs);
  const b = await core.claim('bob');                       // другой игрок строит
  await core.drop('bob', b.token, 5);
  const a2 = await core.claim('alice');                    // теперь можно
  assert.equal(a2.ok, true);
  await core.drop('alice', a2.token, 0);
  tick(CONFIG.repeatCooldownMs + 1);                       // кулдаун тоже открывает
  const a3 = await core.claim('alice');
  assert.equal(a3.ok, true);
  await core.drop('alice', a3.token, 0);
  // обвал сбрасывает «последнего строителя» - виновник может начать новую башню
  const blocks = [];
  for (let i = 0; i < 100; i++) blocks.push({ dx: 0, o: 0, u: 'x', ts: 1 });
  await kv.set('tower_current', { id: 9, blocks, L: CONFIG.limitMin - 1, createdAt: 1, lastEventSeq: 100 });
  const c = await core.claim('carol');
  const d = await core.drop('carol', c.token, CONFIG.oMax);
  assert.equal(d.collapsed, true);
  const c2 = await core.claim('carol');                    // сразу после обвала - можно
  assert.equal(c2.ok, true);
});

test('обвал: архив, мемориал РОВНО один, новая башня, статы виновника и выживших', async () => {
  const { core, kv, memorials, tick } = makeCore();
  // строим высокую башню напрямую в канон (быстрее, чем 80 клеймов)
  const blocks = [];
  for (let i = 0; i < 100; i++) blocks.push({ dx: 0, o: 0, u: i % 2 ? 'alice' : 'bob', ts: 1 });
  await kv.set('tower_current', { id: 1, blocks, L: CONFIG.limitMin - 1, createdAt: 1, lastEventSeq: 100 });
  await kv.set('tower_counter', 1);

  const c = await core.claim('carol');
  const d = await core.drop('carol', c.token, CONFIG.oMax); // L = 41-1+30 > 42 → обвал
  assert.equal(d.ok, true);
  assert.equal(d.collapsed, true);
  assert.equal(memorials.length, 1);
  assert.equal(memorials[0].culprit, 'carol');
  assert.equal(memorials[0].height, 101);
  assert.match(memorials[0].title, /Tower #1 fell at storey 101 - toppled by u\/carol/);

  const st = await core.state('carol');
  assert.equal(st.tower.id, 2);
  assert.equal(st.tower.h, 0);                     // новая башня пуста
  assert.equal(st.fallenCount, 1);
  assert.equal(st.me.stats.caused, 1);
  const alice = await core.state('alice');
  assert.equal(alice.me.stats.survived, 1);        // строитель пережил обвал

  // retry того же дропа (сеть мигнула) НЕ создаёт второй мемориал
  const retry = await core.drop('carol', c.token, CONFIG.oMax);
  assert.equal(retry.ok, false);
  assert.equal(retry.reason, 'lock_lost');
  assert.equal(memorials.length, 1);
  // архив читается для мемориал-режима
  const arch = await core.archive(1);
  assert.equal(arch.fellHeight, 101);
  tick(1);
});

test('энергия: 3 дропа → out of energy; через 3 часа снова можно', async () => {
  const { core, tick } = makeCore();
  for (let i = 0; i < CONFIG.energyStart; i++) {
    tick(CONFIG.repeatCooldownMs + 1); // обходим «не подряд» (регенерации за 90с нет: 90с << 3ч)
    const c = await core.claim('u');
    assert.equal(c.ok, true, `claim ${i}`);
    await core.drop('u', c.token, 0);
  }
  const denied = await core.claim('u');
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'no_energy');
  assert.ok(denied.msToNext > 0 && denied.msToNext <= CONFIG.energyRegenMs);
  tick(CONFIG.energyRegenMs + 1);
  const again = await core.claim('u');
  assert.equal(again.ok, true);
});

test('логаут: state отдаёт башню без me; claim/drop отклонены', async () => {
  const { core } = makeCore();
  const st = await core.state(null);
  assert.equal(st.me, null);
  assert.ok(st.tower);
  assert.equal((await core.claim(null)).reason, 'login_required');
  assert.equal((await core.drop(null, 'x', 0)).reason, 'login_required');
});

test('анти-гриф end-to-end: свежая башня не роняется одним максимально злым дропом', async () => {
  const { core } = makeCore();
  const c = await core.claim('grief');
  const d = await core.drop('grief', c.token, 1e9);
  assert.equal(d.collapsed, false);
});

test('память кривизны: crook = средний |промах| / oMax; ровный крен не обнуляет её', async () => {
  const { core, kv } = makeCore();
  assert.equal((await core.state(null)).tower.crook, 0);
  const mk = (o) => ({ dx: 0, o, u: 'x', ts: 1 });
  await kv.set('tower_current', { id: 1, blocks: [mk(15), mk(-15), mk(15), mk(-15)], L: 0, createdAt: 1, lastEventSeq: 4 });
  const s = await core.state(null);
  assert.equal(s.tower.crook, 0.5);               // средний |o|=15, oMax=30 → 0.5, хотя L=0!
  const claim = await core.claim('u');
  assert.equal(claim.frozen.crook, 0.5);          // строителю уходит та же кривизна
});
