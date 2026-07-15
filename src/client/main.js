"use strict";
const store = { get(k){ try { return localStorage.getItem(k); } catch { return null; } },
                set(k,v){ try { localStorage.setItem(k,v); } catch {} } };
window.onerror = (m, s, l, c) => { const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:40%;left:8px;right:8px;z-index:99;background:#fff;color:#900;font:12px monospace;padding:8px;border-radius:8px';
  d.textContent = 'ERR: ' + m + ' @' + l + ':' + c; document.body.appendChild(d); };
/* ================= net ================= */
const qs = new URLSearchParams(location.search);
const ME = qs.get('u'); // null = logged out (в Devvit: context.userId)
const api = (path, body) => {
  const url = path + (path.includes('?') ? '&' : '?') + 'u=' + (ME ?? '');
  if (qs.get('syncboot')){ // скриншот-режим: headless замораживает async после load
    const x = new XMLHttpRequest(); x.open(body ? 'POST' : 'GET', url, false);
    if (body) x.setRequestHeader('content-type', 'application/json');
    x.send(body ? JSON.stringify(body) : null);
    return Promise.resolve(JSON.parse(x.responseText));
  }
  return fetch(url, {
    method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json());
};

/* ================= state ================= */
let S = null;            // последний /api/state
let CFG = null;
let MODE = 'cover';      // cover | build | practice | collapse
let build = null;        // {token, frozen:{h,L}, swct, dropped, anim}
let practice = null;     // {blocks:[], L, h, swct, dropped, anim, fallers, fallT}
let fallers = null, fallT = 0, pendingMemorial = null;
let toastT = 0, lastSeq = -1, popT = 0;
let hoverI = -1;              // подсвеченный ховером этаж (cover)
let shakeT = 0;               // тряска камеры (обвал / посадка)
let dust = [];                // частицы пыли
let dropInT = 1;              // влёт чужого этажа на глазах у зрителя (0→1)
const $ = id => document.getElementById(id);

/* ================= canvas ================= */
const cv = $('c'), ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize(){ const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1);
  W = r.width; H = r.height; cv.width = W * d | 0; cv.height = H * d | 0; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize);

const BW = () => CFG?.blockW ?? 90, BH = () => CFG?.blockH ?? 30;
function rr(x, y, w, h, r){ r = Math.min(r, w / 2, h / 2); ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

let t0 = performance.now();
function sky(){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6fb0d8'); g.addColorStop(.45, '#a9cfe0'); g.addColorStop(.72, '#efe0b4'); g.addColorStop(1, '#e6c78a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const s = ctx.createRadialGradient(W * .78, H * .18, 6, W * .78, H * .18, W * .4);
  s.addColorStop(0, '#fff7e0aa'); s.addColorStop(1, '#fff7e000'); ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  // дрейф облаков - живость cover без фейк-качания (docs/14 §1)
  const t = (performance.now() - t0) / 1000;
  cloud((W * .2 + t * 6) % (W + 200) - 100, H * .16, 1);
  cloud((W * .65 + t * 3.6) % (W + 260) - 130, H * .3, .7);
}
function cloud(x, y, k){
  ctx.fillStyle = '#ffffff8c';
  for (const [dx, dy, r] of [[0,0,22],[18,4,16],[-20,5,15],[6,-9,15]]) {
    ctx.beginPath(); ctx.arc(x + dx * k, y + dy * k, r * k, 0, 7); ctx.fill();
  }
}
function ground(gy){
  const g = ctx.createLinearGradient(0, gy - 6, 0, H);
  g.addColorStop(0, '#8aa757'); g.addColorStop(.15, '#6f9048'); g.addColorStop(1, '#55743a');
  ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = '#b6c98a'; ctx.fillRect(0, gy - 2, W, 3);
}
function storey(cx, cy, w, h, opts = {}){
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(80,60,30,.22)'; rr(-w/2 + 2, h/2 - 3, w, 6, 3); ctx.fill();
  if (opts.base){ ctx.fillStyle = '#c9b78a'; rr(-w * .62, -h/2, w * 1.24, h, 3); ctx.fill();
    ctx.fillStyle = '#b6a374'; ctx.fillRect(-w * .62, h/2 - Math.max(3, h * .22), w * 1.24, Math.max(3, h * .22));
    ctx.restore(); return; }
  const bg = ctx.createLinearGradient(0, -h/2, 0, h/2); bg.addColorStop(0, '#f2e7c9'); bg.addColorStop(1, '#d6c397');
  ctx.fillStyle = opts.ghostFill ?? bg; rr(-w/2, -h/2, w, h, 3); ctx.fill();
  const c = Math.max(2, h * .15);
  ctx.fillStyle = '#f6ecd0'; ctx.fillRect(-w/2 - 2, -h/2, w + 4, c);
  ctx.fillStyle = '#bda87d'; ctx.fillRect(-w/2 - 2, h/2 - c, w + 4, c);
  if (w > 26){ const inner = w * .82, n = Math.max(3, Math.round(inner / 13)), gap = inner / n,
      ow = gap * .52, oh = h * .52;
    ctx.fillStyle = '#a4926a';
    for (let k = 0; k < n; k++){ const ox = -inner/2 + gap * (k + .5); rr(ox - ow/2, -oh * .32, ow, oh, ow * .5); ctx.fill(); } }
  ctx.strokeStyle = '#00000018'; ctx.lineWidth = 1; rr(-w/2, -h/2, w, h, 3); ctx.stroke();
  if (opts.hi){ ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; rr(-w/2, -h/2, w, h, 3); ctx.stroke(); }
  ctx.restore();
}
function crane(sx, sy, s){
  ctx.strokeStyle = '#4a3c28'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sx, Math.max(6, sy - 40 * s)); ctx.lineTo(sx, sy - BH() * s / 2); ctx.stroke();
  ctx.fillStyle = '#5a4a30'; ctx.fillRect(sx - 10, Math.max(4, sy - 40 * s - 4), 20, 5);
  // флажок - живость
  const fl = Math.sin(performance.now() / 300) * 4;
  ctx.fillStyle = '#c8613c'; ctx.beginPath();
  ctx.moveTo(sx + 10, Math.max(4, sy - 40 * s - 2)); ctx.lineTo(sx + 26 + fl, Math.max(8, sy - 40 * s + 2));
  ctx.lineTo(sx + 10, Math.max(12, sy - 40 * s + 6)); ctx.fill();
}

/* ================= cameras ================= */
// cover/collapse: вся башня в кадре, низ на земле (решение пользователя).
// build/practice: крупный план зоны дропа + мини-силуэт (красная команда: тап-скилл читаем).
// земля с резервом под кнопки: башня всегда НАД доком (фидбек юзера 14.07)
const groundY = () => H - Math.max(96, Math.min(150, H * .17));

// «Память кривизны»: кривая история башни делает свип быстрее и РВАНЫМ (вторая гармоника).
// ЕДИНАЯ формула для отрисовки слайда и для дропа - иначе «целился не туда».
function slideOffset(t, crook){
  const c = Math.min(1, crook || 0) * .45;
  const raw = (1 - c) * Math.sin(t) + c * Math.sin(2.7 * t + 1.3);
  return CFG.oMax * Math.max(-1, Math.min(1, raw));
}
const sweepMult = (crook) => 1 + .7 * Math.min(1, crook || 0);
function drawTowerFull(blocks, L, opts = {}){
  const gy = groundY(), top = blocks.length;
  const scale = Math.max(.12, Math.min(1, (gy - 60) / ((top + 2) * BH())));
  const cx = W / 2;
  const lim = curLimit(); const danger = Math.min(1, Math.abs(L) / lim);
  const high = top > 12;
  // качание: текущая опасность + «память кривизны» (кривая башня нервничает всегда)
  const swayAmp = danger * 6 + (opts.crook ?? 0) * 5;
  const sway = high ? Math.sin(performance.now() / 240) * swayAmp * Math.PI / 180 : 0;
  ground(gy);
  ctx.save(); ctx.translate(cx, gy); ctx.rotate(sway); ctx.translate(-cx, -gy);
  storey(cx, gy - BH() * scale * .5, BW() * scale, BH() * scale, { base: true });
  for (let i = 0; i < top; i++){
    let y = gy - (i + 1.5) * BH() * scale;
    const dropK = opts.dropK ?? 1;
    if (i === top - 1 && dropK < 1) y -= (1 - dropK) * (1 - dropK) * 120 * scale; // влёт сверху
    storey(cx + blocks[i].dx * scale, y, BW() * scale, BH() * scale,
      { hi: (opts.hiTop && i === top - 1 && popT > 0) || i === opts.hover });
  }
  ctx.restore();
  return { gy, scale, cx };
}
// Геометрия крупного плана: фундамент виден, пока низ в кадре; слайд ВЫСОКО над башней.
// Возвращает всё, что нужно анимации падения (slideY, targetY, topY).
function buildLayout(top){
  const gy = groundY();
  const K = Math.min(top, Math.max(4, Math.floor((H * .5) / BH())));
  const bottomVisible = top <= K;
  const stackBase = gy - (bottomVisible ? BH() : 0);            // низ видимой пачки (над плинтусом)
  const topY = top ? stackBase - (K - .5) * BH() : gy - BH() * .5; // центр верхнего этажа (или плинтуса)
  const targetY = topY - BH();                                  // куда ляжет новый этаж
  const slideY = Math.max(64, targetY - BH() * 3.2);            // скользящий этаж - высоко над башней
  return { gy, K, bottomVisible, stackBase, topY, slideY, targetY };
}
function drawTowerBuild(frozen, blocks, swct, withSlide, crook){
  const cx = W / 2, top = blocks.length;
  const L0 = buildLayout(top);
  ground(L0.gy);
  if (L0.bottomVisible) storey(cx, L0.gy - BH() * .5, BW(), BH(), { base: true }); // фундамент всегда, пока виден
  for (let k = 0; k < Math.min(top, L0.K); k++){
    const i = top - 1 - k;
    const y = L0.stackBase - (L0.K - k - .5) * BH();
    storey(cx + blocks[i].dx, y, BW(), BH(), {});
  }
  const topDx = top ? blocks[top - 1].dx : 0;
  const slideO = slideOffset(swct, crook);
  const sx = cx + topDx + slideO;
  if (withSlide){
    crane(sx, L0.slideY, 1);
    storey(sx, L0.slideY, BW(), BH(), { ghostFill: '#ffffff42', hi: true });
  }
  if (top > L0.K) miniSilhouette(blocks);
  return { cx, topDx, slideO, ...L0 };
}
function miniSilhouette(blocks){
  const mw = 46, mh = Math.min(H * .5, 30 + blocks.length * 3), x0 = W - mw - 10, y0 = H * .5 - mh / 2;
  ctx.fillStyle = '#f7efd8b0'; rr(x0 - 8, y0 - 10, mw + 16, mh + 20, 10); ctx.fill();
  ctx.strokeStyle = '#b7a577'; ctx.stroke();
  const s = Math.min(3, mh / (blocks.length + 1) / 1.2), bw = 12;
  const maxDx = Math.max(30, ...blocks.map(b => Math.abs(b.dx)));
  for (let i = 0; i < blocks.length; i++){
    ctx.fillStyle = i === blocks.length - 1 ? '#c8613c' : '#a4926a';
    ctx.fillRect(x0 + mw / 2 + blocks[i].dx / maxDx * 12 - bw / 2, y0 + mh - (i + 1) * s * 1.15, bw, s);
  }
}

/* ================= collapse anim ================= */
function startFall(blocks, L){
  const lean = Math.sign(L || 1);
  fallers = blocks.map((b) => ({ dx: b.dx, vx: lean * (18 + Math.random() * 40) + b.dx * .5,
    baseY: 0, vy: -20 - Math.random() * 40, vr: lean * (.03 + Math.random() * .08), rot: 0 }));
  fallT = 0;
}
function drawFall(){
  const gy = groundY(), cx = W / 2, top = fallers.length;
  const scale = Math.max(.12, Math.min(1, (gy - 60) / ((top + 2) * BH())));
  ground(gy);
  for (let i = 0; i < top; i++){ const f = fallers[i];
    ctx.save(); ctx.translate(cx + f.dx * scale, gy - (i + 1.5) * BH() * scale + f.baseY); ctx.rotate(f.rot);
    storey(0, 0, BW() * scale, BH() * scale, {}); ctx.restore(); }
}

/* ================= helpers ================= */
function curLimit(){
  if (!S) return CFG?.limit0 ?? 96;
  return S.tower.limit;
}
function limitFor(h, c){ const t = Math.min(1, h / c.limitRefH); return Math.max(c.limitMin, c.limit0 - (c.limit0 - c.limitMin) * t); }
function fmtMs(ms){ const s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
function toast(t){ $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 2.2; }
let hintTimer = null;
function hint(on, text){ if (text) $('hint').textContent = text; $('hint').style.opacity = on ? 1 : 0;
  clearTimeout(hintTimer); if (on) hintTimer = setTimeout(() => { $('hint').style.opacity = 0; }, 2600); }

/* ================= HUD ================= */
function refreshHud(){
  if (!S) return;
  const t = (MODE === 'practice' && practice) ? { id: 'P', h: practice.h, L: practice.L, limit: limitFor(practice.h, PCFG()) } : S.tower;
  $('towerName').textContent = MODE === 'practice' ? 'PRACTICE' : ('Tower #' + t.id);
  $('h').textContent = t.h;
  $('lv').textContent = Math.round(t.L) + ' / ' + Math.round(t.limit);
  $('lbar').style.width = Math.min(100, Math.abs(t.L) / t.limit * 100) + '%';
  $('leanChip').classList.toggle('alarm', Math.abs(t.L) / t.limit > .8); // тревога у предела
  $('fallen').textContent = S.fallenCount;
  $('graveChip').style.display = S.fallenCount > 0 ? '' : 'none';
  if (S.me){
    $('energy').textContent = '×' + S.me.energy;
    $('regen').textContent = S.me.energy < CFG.energyCap && S.me.msToNext ? '· next ' + fmtMs(S.me.msToNext) : '';
    // «не подряд» видно ДО тапа: таймер прямо на кнопке (фидбек 15.07)
    $('buildBtn').textContent = S.me.repeatMsLeft > 0
      ? '⏳ ' + fmtMs(S.me.repeatMsLeft) + ' · or after next builder'
      : '🧱 BUILD';
  } else {
    $('energy').textContent = '-'; $('regen').textContent = '';
    $('buildBtn').textContent = '🧱 LOG IN & BUILD';
  }
  const last = S.tower.blocks[S.tower.blocks.length - 1];
  if (last && MODE === 'cover'){ $('byline').style.display = '';
    $('byline').textContent = 'storey ' + S.tower.h + ' by u/' + last.u; }
  else $('byline').style.display = 'none';
}

/* ================= modes ================= */
const PCFG = () => ({ ...CFG, ...CFG.practice });

async function poll(){
  if (MODE === 'build' || MODE === 'collapse') return;
  try {
    const s = await api('/api/state');
    const prevH = S?.tower?.h ?? -1, prevId = S?.tower?.id;
    S = s; if (!CFG) CFG = s.cfg;
    if (prevId === s.tower.id && s.tower.h > prevH && prevH >= 0){ popT = 1; dropInT = 0; } // чужой блок влетает на глазах
    if (prevId && prevId !== s.tower.id && MODE === 'cover'){ // башня пала без нас - показать мемориал
      const arch = await api('/api/archive?id=' + prevId);
      if (arch && !arch.missing) showMemorialCard(memorialFromArchive(arch), true);
    }
    // «кто сейчас играет» - виден в cover И в practice (фидбек юзера 14.07)
    if (MODE === 'cover' || MODE === 'practice'){
      if (s.turn){ $('banner').style.display = '';
        $('banner').textContent = '🔨 u/' + s.turn.user + ' is placing storey ' + (s.tower.h + 1) + ' right now'
          + (s.queueLen ? ' · ' + s.queueLen + ' in line' : '') + '…'; }
      else $('banner').style.display = 'none';
    }
    refreshHud();
  } catch (e) { /* сервер недоступен - тихо ретраим */ }
}
setInterval(poll, 1200);

async function startBuild(){
  if (!S || !S.me){ // логаут: CTA (сервер определяет юзера; локально - ?u=)
    showCard(`<div class="kicker">almost</div><h2>Log in to build</h2>
      <p>Your name gets carved on every storey you place - and on the memorial if you topple it. Practice is open without login.</p>
      <div class="row"><button class="btn ghost" id="cPractice">Practice</button>
      <button class="btn" id="cClose">OK</button></div>`);
    $('cPractice').onclick = () => { hideCard(); startPractice(); };
    $('cClose').onclick = hideCard; return;
  }
  const r = await api('/api/claim', {});
  if (r.ok){
    build = { token: r.token, frozen: r.frozen, swct: 0, blocks: S.tower.blocks.slice(), dropped: false, anim: null };
    MODE = 'build'; $('dock').style.display = 'none'; $('banner').style.display = 'none';
    refreshHud(); hint(true, 'TAP when it’s centered');
    build.hb = setInterval(async () => { const h = await api('/api/heartbeat', { token: build.token });
      if (!h.ok && MODE === 'build' && !build.dropped){ exitBuild(); toast('Turn expired'); } }, CFG.lockTtlMs / 3);
  } else if (r.reason === 'no_energy'){
    showCard(`<div class="kicker">out of bricks</div><h2>Next brick in ${fmtMs(r.msToNext ?? 0)}</h2>
      <p>Bricks regrow one per 3 hours (max ${CFG.energyCap}). Keep your eye sharp meanwhile.</p>
      <div class="row"><button class="btn" id="cPractice">Practice while you wait</button>
      <button class="btn ghost" id="cClose">Later</button></div>`);
    $('cPractice').onclick = () => { hideCard(); startPractice(); };
    $('cClose').onclick = hideCard;
  } else if (r.reason === 'consecutive'){
    showCard(`<div class="kicker">one at a time</div><h2>No two storeys in a row</h2>
      <p>Someone else builds next - or your turn unlocks in <b>${fmtMs(r.msLeft ?? 0)}</b>. That’s the anti-villain rule: nobody topples the tower alone.</p>
      <div class="row"><button class="btn" id="cPractice">Practice meanwhile</button>
      <button class="btn ghost" id="cClose">OK</button></div>`);
    $('cPractice').onclick = () => { hideCard(); startPractice(); };
    $('cClose').onclick = hideCard;
  } else if (r.reason === 'busy'){
    $('banner').style.display = '';
    $('banner').className = 'banner';
    $('banner').textContent = r.youAreNext
      ? '⏳ u/' + r.holder + ' is building - you’re NEXT, hold on…'
      : '🧱 u/' + r.holder + ' is building - you’re #' + (r.position ?? '?') + ' in line (' + (r.queueLen ?? 1) + ' waiting)…';
    if (r.position){ // очередь живёт на повторных claim (touch) + автозахват, когда подойдёт
      clearTimeout(startBuild._t); startBuild._t = setTimeout(startBuild, 1200);
    }
  } else if (r.reason === 'already_yours'){ /* повторный тап - игнор */ }
}
function exitBuild(){ clearInterval(build?.hb); build = null; MODE = 'cover'; $('dock').style.display = ''; hint(false); poll(); }

function dropNow(){
  if (!build || build.dropped) return;
  build.dropped = true; hint(false);
  const offset = slideOffset(build.swct, build.frozen.crook); // ЕДИНАЯ формула с отрисовкой
  // ОПТИМИСТИЧНО (фидбек «пролагивает»): падаем сразу по тапу - математика клэмпа = серверной,
  // итоговая позиция известна без ожидания сети; ответ догоняет в полёте
  const localL = build.frozen.L + Math.max(-CFG.oMax, Math.min(CFG.oMax, offset));
  build.anim = { x: localL, res: null, failed: null, settle: 0 };
  api('/api/drop', { token: build.token, offset }).then((r) => {
    clearInterval(build?.hb);
    if (!build || !build.anim) return;
    if (!r.ok) build.anim.failed = r.reason;
    else build.anim.res = r;
  }).catch(() => { if (build?.anim) build.anim.failed = 'network'; });
}
function finishDrop(res){
  if (res.collapsed){
    pendingMemorial = res.memorial; MODE = 'collapse';
    startFall([...S.tower.blocks, { dx: res.L }], res.L); // старые блоки + мой
    clearInterval(build?.hb); build = null;
  } else {
    toast('Storey ' + res.h + ' · yours forever');
    exitBuild();
  }
}

/* ---------- practice ---------- */
function startPractice(){
  practice = { blocks: [], L: 0, h: 0, swct: 0, oSum: 0, dropped: false, anim: null, fallers: null, fallT: 0 };
  MODE = 'practice'; $('dock').style.display = 'none'; $('pdock').style.display = '';
  refreshHud(); hint(true, 'tap when it’s centered');
}
function pCrook(p){ return p.h ? Math.min(1, (p.oSum / p.h) / CFG.oMax) : 0; }
function practiceDrop(){
  const p = practice;
  const o = slideOffset(p.swct, pCrook(p));
  const L = p.L + o, h = p.h + 1, lim = limitFor(h, PCFG());
  p.oSum = (p.oSum ?? 0) + Math.abs(o);
  p.anim = { x: L, res: { L, h, collapsed: Math.abs(L) >= lim } };
}
function finishPracticeDrop(res){
  const p = practice;
  if (res.collapsed){
    p.fallers = true; startFall([...p.blocks, { dx: res.L }], res.L); p.fallT = 0; hint(false);
  } else { p.blocks.push({ dx: res.L, u: 'you' }); p.L = res.L; p.h = res.h; }
  refreshHud();
}
function practiceEndCard(h){
  showCard(`<div class="kicker">practice</div><h2>CRASH! Down at storey ${h}</h2>
    <p>That’s how towers fall. The real one is taller, slower - and it <b>remembers who did it</b>.</p>
    <div class="row"><button class="btn" id="cReal">Build for real</button>
    <button class="btn ghost" id="cAgain">Again</button></div>`);
  $('cReal').onclick = () => { hideCard(); exitPractice(); startBuild(); };
  $('cAgain').onclick = () => { hideCard(); startPractice(); };
}
function exitPractice(){ practice = null; MODE = 'cover'; $('dock').style.display = ''; $('pdock').style.display = 'none'; hint(false); refreshHud(); }

/* ---------- memorial ---------- */
function memorialFromArchive(a){
  const by = new Map(); for (const b of a.blocks) by.set(b.u, (by.get(b.u) ?? 0) + 1);
  let perfect = 0, hero = null, prev = 0;
  for (const b of a.blocks){
    if (Math.abs(b.o ?? 0) <= 2) perfect++;
    const saved = Math.abs(prev) - Math.abs(b.dx);
    if (saved > 2 && (!hero || saved > hero.saved)) hero = { u: b.u, saved: Math.round(saved) };
    prev = b.dx;
  }
  return { towerId: a.id, height: a.fellHeight, culprit: a.culprit,
    lifetimeMs: a.fellAt - a.createdAt, buildersCount: by.size, perfect, hero,
    topBuilders: [...by.entries()].map(([u, n]) => ({ u, n })).sort((x, y) => y.n - x.n).slice(0, 5) };
}
function showMemorialCard(m, passive){
  const hrs = Math.round(m.lifetimeMs / 3600000);
  const stood = hrs < 1 ? 'minutes' : hrs < 48 ? hrs + ' hour' + (hrs > 1 ? 's' : '') : Math.round(hrs / 24) + ' days';
  const builders = m.topBuilders.map(b => 'u/' + b.u + ' ×' + b.n).join(' · ');
  const stats = ['👷 ' + (m.buildersCount ?? m.topBuilders.length) + ' builders', '🎯 ' + (m.perfect ?? 0) + ' perfect drops'];
  if (m.hero) stats.push('🦸 best save: u/' + m.hero.u + ' (-' + m.hero.saved + ' lean)');
  showCard(`<div class="kicker">in memoriam</div>
    <h2>Tower #${m.towerId}</h2>
    <div class="big">${m.height} storeys</div>
    <p>stood ${stood}</p>
    <div class="who">toppled by <b>u/${m.culprit}</b></div>
    <p style="font-size:12.5px">${stats.join(' · ')}</p>
    <p style="font-size:12px;color:var(--muted)">${builders || ''}</p>
    <div class="row"><button class="btn" id="cNew">Tower #${m.towerId + 1} begins - build</button>
    <button class="btn ghost" id="cClose">Close</button></div>`);
  $('cNew').onclick = () => { hideCard(); startBuild(); };
  $('cClose').onclick = () => { hideCard(); };
}
$('graveChip').onclick = async () => {
  const id = S.fallenCount; if (!id) return;
  const a = await api('/api/archive?id=' + id);
  if (a && !a.missing) showMemorialCard(memorialFromArchive(a), true);
};

function showCard(html){ $('card').innerHTML = html; $('veil').classList.add('show'); }
function hideCard(){ $('veil').classList.remove('show'); }

/* ---------- правила (кнопка ❓, фидбек 15.07) ---------- */
function showRules(){
  const cd = CFG ? Math.round(CFG.repeatCooldownMs / 60000 * 10) / 10 : 1.5;
  showCard(`<div class="kicker">how to play</div><h2>WOBBLE</h2>
    <p style="text-align:left;line-height:1.7">
    🏛 <b>One tower</b> for the whole subreddit - it grows storey by storey.<br>
    🎯 Tap <b>BUILD</b>, then tap when the sliding storey is <b>centered</b>.<br>
    📐 Off-centre drops add <b>lean</b>. Past the limit - the whole tower falls.<br>
    🌀 A crooked history makes the tower <b>wobblier</b> and harder to build on - forever.<br>
    🧱 Bricks: <b>1 per 3 hours</b> (max 3). <b>No two storeys in a row</b> - another builder (or ${cd} min) goes between.<br>
    🪦 Topple it - the <b>memorial names you</b>. Build well - be remembered as a hero.</p>
    <div class="row"><button class="btn" id="cPractice">Practice</button>
    <button class="btn ghost" id="cClose">Got it</button></div>`);
  $('cPractice').onclick = () => { hideCard(); startPractice(); };
  $('cClose').onclick = hideCard;
}
$('rulesChip').onclick = showRules;

/* ---------- onboarding (3 coach marks, once) ---------- */
// коуч-марки живут в НЕБЕ (верхняя треть) - башня всегда видна; spot = подсветка элемента
const COACH = [
  ['One tower for the whole community. <b>Tap BUILD</b> to lower your storey - tap again when it’s centered.', () => ({ x: W/2 - 115, y: Math.max(70, H * .13) }), null],
  ['This is the <b>lean bar</b>. Every off-centre storey tilts the tower. At the limit - it all comes down.', () => ({ x: W - 250, y: 96 }), 'leanChip'],
  ['Your name is carved on every storey you place. <b>Topple the tower</b> - and the memorial names you.', () => ({ x: W/2 - 115, y: Math.max(70, H * .13) }), null],
];
let coachI = -1;
function maybeCoach(){
  if (qs.get('nocoach') || store.get('wobble_onboarded') || !S) return;
  coachI = 0; showCoach();
}
function showCoach(){
  document.querySelectorAll('.spot').forEach(el => el.classList.remove('spot'));
  if (coachI < 0 || coachI >= COACH.length){ $('coach').classList.remove('show');
    store.set('wobble_onboarded', '1'); return; }
  const [text, pos, spotId] = COACH[coachI]; const p = pos();
  $('coachText').innerHTML = text;
  const el = $('coach'); el.classList.add('show');
  el.style.left = Math.max(8, Math.min(W - 240, p.x)) + 'px';
  el.style.top = Math.max(8, Math.min(H - 120, p.y)) + 'px';
  if (spotId) $(spotId).classList.add('spot'); // выделяем сам элемент (фидбек: «где lean bar - не ясно»)
  $('coachStep').textContent = (coachI + 1) + ' / ' + COACH.length;
}
$('coachOk').onclick = () => { coachI++; showCoach(); };
$('coachSkip').onclick = () => { coachI = COACH.length; showCoach(); }; // скип = закрыть и запомнить

/* ================= main loop ================= */
let last = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!W || !H) resize();
  ctx.save();
  if (shakeT > 0){ shakeT -= dt; const amp = 13 * Math.max(0, shakeT);
    ctx.translate((Math.random()*2-1)*amp, (Math.random()*2-1)*amp); }
  sky();
  if (MODE === 'cover'){
    if (S){ dropInT = Math.min(1, dropInT + dt * 2.4);
      drawTowerFull(S.tower.blocks, S.tower.L, { hiTop: true, hover: hoverI, crook: S.tower.crook, dropK: dropInT });
      dangerVignette(Math.abs(S.tower.L) / S.tower.limit); }
    if (popT > 0) popT -= dt;
  } else if (MODE === 'build' && build){
    const spd = (CFG.sweepSpeed + build.blocks.length * CFG.sweepRamp) * sweepMult(build.frozen.crook);
    if (!build.dropped) build.swct += spd * dt;
    if (build.anim){
      const a = build.anim;
      const done = drawFallingDrop(build.blocks, a, dt);
      if (done){
        a.settle += dt; // пауза-послевкусие: блок лежит, пыль оседает
        if (a.failed){ toast(a.failed === 'lock_lost' ? 'Turn expired - brick saved' : 'Hmm, try again');
          build.anim = null; exitBuild(); }
        else if (a.res && a.settle > .35){
          const res = a.res; build.anim = null;
          if (!res.collapsed){ build.blocks.push({ dx: res.L, u: 'you' }); }
          finishDrop(res);
        } // иначе ждём ответ сервера - блок уже на месте, заминки не видно
      }
    } else {
      drawTowerBuild(build.frozen, build.blocks, build.swct, true, build.frozen.crook);
      dangerVignette(Math.abs(build.frozen.L) / limitFor(build.frozen.h, CFG));
    }
  } else if (MODE === 'practice' && practice){
    const c = PCFG(), p = practice;
    if (p.fallers){ p.fallT += dt;
      updFall(p.fallT < .5 ? dt * .3 : dt); drawFall();
      if (p.fallT >= .5 && !p.dusted){ p.dusted = true;
        shakeT = Math.max(shakeT, .7); spawnDust(W/2, groundY(), 26, true); }
      if (p.fallT > 1.9){ const hh = p.h + 1; p.fallers = null; practiceEndCard(hh); p.blocks = []; p.L = 0; p.h = 0; }
    } else {
      const spd = (c.sweepSpeed + p.blocks.length * c.sweepRamp) * sweepMult(pCrook(p));
      if (!p.anim) p.swct += spd * dt;
      if (p.anim){
        const done = drawFallingDrop(p.blocks, p.anim, dt);
        if (done){ p.anim.settle = (p.anim.settle ?? 0) + dt;
          if (p.anim.settle > .3){ const res = p.anim.res; p.anim = null; finishPracticeDrop(res); } }
      } else { drawTowerBuild({ h: p.h, L: p.L }, p.blocks, p.swct, true, pCrook(p));
        dangerVignette(Math.abs(p.L) / limitFor(p.h, c)); }
    }
  } else if (MODE === 'collapse'){
    fallT += dt;
    const fdt = fallT < .5 ? dt * .3 : dt;                 // slow-mo в момент перелома
    updFall(fdt); drawFall();
    if (fallT >= .5 && !frame._dusted){ frame._dusted = true;
      shakeT = Math.max(shakeT, .7); spawnDust(W/2, groundY(), 26, true); }
    if (fallT > 2.1){ MODE = 'cover'; $('dock').style.display = ''; frame._dusted = false;
      const m = pendingMemorial; pendingMemorial = null;
      poll().then(() => { if (m) showMemorialCard(m, false); });
    }
  }
  updDrawDust(dt);
  ctx.restore();
  if (toastT > 0){ toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  requestAnimationFrame(frame);
}
function updFall(dt){ if (!fallers) return;
  for (const f of fallers){ f.vy += 640 * dt; f.dx += f.vx * dt; f.baseY += f.vy * dt; f.rot += f.vr; } }

/* ---------- сок: виньетка опасности, тряска, пыль ---------- */
function dangerVignette(danger){
  if (!(danger > .55)) return;
  const a = Math.min(.5, (danger - .55) / .45 * .5);
  const v = ctx.createRadialGradient(W/2, H*.5, Math.min(W,H)*.25, W/2, H*.5, Math.max(W,H)*.72);
  v.addColorStop(0, 'rgba(192,57,43,0)'); v.addColorStop(1, 'rgba(192,57,43,' + a.toFixed(3) + ')');
  ctx.fillStyle = v; ctx.fillRect(-24, -24, W + 48, H + 48);
}
function spawnDust(x, y, n, big){
  for (let i = 0; i < n; i++) dust.push({
    x: x + (Math.random()*2-1) * 26, y: y - Math.random()*6,
    vx: (Math.random()*2-1) * (big ? 90 : 40), vy: -(20 + Math.random() * (big ? 90 : 40)),
    r: 3 + Math.random() * (big ? 9 : 5), life: .6 + Math.random() * .5 });
}
function updDrawDust(dt){
  for (const p of dust){ p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 60*dt; }
  dust = dust.filter(p => p.life > 0);
  for (const p of dust){
    ctx.globalAlpha = Math.max(0, Math.min(.55, p.life));
    ctx.fillStyle = '#d6c396'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Падение нового этажа: строго вертикально, с гравитацией, ровно на вершину башни.
// anim = {x: итоговый dx (клэмп сервера), y: тек. Y, vy, res}; true = приземлился.
function drawFallingDrop(blocks, a, dt){
  const lay = drawTowerBuild({ h: blocks.length, L: 0 }, blocks, 0, false);
  if (a.y === undefined){ a.y = lay.slideY; a.vy = 0; }
  a.vy += 2600 * dt; a.y += a.vy * dt;
  const landed = a.y >= lay.targetY;
  const y = Math.min(a.y, lay.targetY);
  storey(lay.cx + a.x, y, BW(), BH(), { hi: true });
  if (landed && !a.thunked){ a.thunked = true;           // «тук»: лёгкая тряска + пыль
    shakeT = Math.max(shakeT, .16);
    spawnDust(lay.cx + a.x, lay.targetY + BH()/2, 5, false);
  }
  return landed;
}

/* ================= input ================= */
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (MODE === 'build' && build && !build.dropped) dropNow();
  else if (MODE === 'practice' && practice && !practice.anim && !practice.fallers) practiceDrop();
});
addEventListener('keydown', (e) => { if (e.code === 'Space'){ e.preventDefault();
  if (MODE === 'build') dropNow(); else if (MODE === 'practice') practiceDrop(); } });

// «кто поставил этаж»: ховер (десктоп) / тап (телефон) по башне в режиме обложки
let tipTimer = null;
function blockAt(px, py){
  if (MODE !== 'cover' || !S || !S.tower.blocks.length) return null;
  const blocks = S.tower.blocks, top = blocks.length;
  const gy = groundY();
  const scale = Math.max(.12, Math.min(1, (gy - 60) / ((top + 2) * BH())));
  const i = Math.floor((gy - py) / (BH() * scale)) - 1; // этаж i занимает [gy-(i+2)·bh, gy-(i+1)·bh]
  if (i < 0 || i >= top) return null;
  const bx = W / 2 + blocks[i].dx * scale;
  if (Math.abs(px - bx) > BW() * scale * .75) return null;
  return { i, b: blocks[i] };
}
function showTip(px, py, hit){
  const tip = $('blockTip');
  tip.textContent = 'storey ' + (hit.i + 1) + ' · by u/' + hit.b.u;
  tip.style.display = 'block';
  tip.style.left = Math.max(6, Math.min(W - 170, px + 12)) + 'px';
  tip.style.top = Math.max(6, py - 30) + 'px';
  hoverI = hit.i; // подсветка самого этажа (как spot у lean bar)
  clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.style.display = 'none'; hoverI = -1; }, 1800);
}
cv.addEventListener('pointermove', (e) => {
  if (MODE !== 'cover') return;
  const hit = blockAt(e.clientX, e.clientY);
  if (hit) showTip(e.clientX, e.clientY, hit);
  else { $('blockTip').style.display = 'none'; hoverI = -1; }
});
cv.addEventListener('pointerdown', (e) => { // тап по башне на телефоне
  if (MODE !== 'cover') return;
  const hit = blockAt(e.clientX, e.clientY);
  if (hit) showTip(e.clientX, e.clientY, hit);
});
$('buildBtn').onclick = startBuild;
$('tryBtn').onclick = () => { if (MODE === 'practice') return; startPractice(); };
$('pRealBtn').onclick = () => { exitPractice(); startBuild(); };
$('pExitBtn').onclick = () => exitPractice();

/* ================= boot ================= */
resize();
// syncboot=1 - детерминированный первый кадр (скриншот-проверки; в Devvit роль играет postData)
function bootState(){
  if (qs.get('syncboot')){
    try { const x = new XMLHttpRequest(); x.open('GET', '/api/state?u=' + (ME ?? ''), false); x.send();
      return Promise.resolve(JSON.parse(x.responseText)); } catch (e) {}
  }
  return api('/api/state');
}
let loopStarted = false;
function startLoop(){ if (loopStarted) return; loopStarted = true; frame(performance.now()); }
bootState().then(async s => { S = s; CFG = s.cfg; refreshHud(); maybeCoach();
  // dev-хуки для скриншот-проверок (безвредны в проде: без query ничего не делают)
  const dm = qs.get('devmode');
  if (dm === 'build') await startBuild();
  else if (dm === 'practice') startPractice();
  else if (dm === 'memorial' && s.fallenCount) $('graveChip').onclick();
  // мемориал-пост (Devvit): postData помечает пост - открываем карточку павшей башни
  if (s.postMeta && s.postMeta.type === 'memorial' && s.postMeta.towerId){
    const a = await api('/api/archive?id=' + s.postMeta.towerId);
    if (a && !a.missing) showMemorialCard(memorialFromArchive(a), true);
  }
  startLoop(); // первый кадр - синхронно, с уже загруженным состоянием
});
setTimeout(startLoop, 800); // страховка, если state не пришёл