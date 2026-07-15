// Локальный dev-сервер WOBBLE (без Devvit): статика + /api/* на GameCore.
// Юзер имитируется query-параметром ?u=alice (две вкладки = два аккаунта).
// На Devvit этот файл заменяется серверным entry с теми же роутами (context.userId вместо ?u).
// Дев-руты /api/dev/* — ТОЛЬКО локальные (сид башни для скриншотов/тестов), в прод не едут.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { InMemoryKV } from '../src/server/kv.mjs';
import { GameCore } from '../src/server/core.mjs';
import { CONFIG } from '../src/shared/config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 8571);

const kv = new InMemoryKV();
const memorials = [];               // локальный аналог «постов» апп-аккаунта
const flairs = new Map();           // локальный аналог setUserFlair
const core = new GameCore(kv, {
  onMemorial: (m) => { memorials.push(m); console.log('[memorial]', m.title); },
  onFlair: (u, s) => { flairs.set(u, `\u{1F9F1} ${s.placed} storeys · survived ${s.survived}`); },
  onEvent: (e) => { /* в Devvit: realtime.send('tower_'+postId, e) — клиент у нас на поллинге */ },
});

const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };

async function api(req, url, user) {
  const body = req.method === 'POST' ? await new Promise((res) => {
    let d = ''; req.on('data', (c) => d += c); req.on('end', () => res(d ? JSON.parse(d) : {}));
  }) : {};
  switch (url.pathname) {
    case '/api/state':     return core.state(user);
    case '/api/claim':     return core.claim(user);
    case '/api/heartbeat': return core.heartbeat(user, body.token);
    case '/api/drop':      return core.drop(user, body.token, body.offset);
    case '/api/archive': {
      const id = Number(url.searchParams.get('id'));
      return (await core.archive(id)) ?? { missing: true };
    }
    case '/api/dev/seed': { // построить башню высоты N с креном L (только локально!)
      const h = Number(url.searchParams.get('h') ?? 40);
      const L = Number(url.searchParams.get('L') ?? 0);
      const users = ['mira_the_mason', 'stone_cold_sam', 'arch_wizard', 'brick_by_brick', 'leaning_lena'];
      const blocks = Array.from({ length: h }, (_, i) => ({
        dx: L * (i + 1) / h + Math.sin(i * 2.7) * 6, o: 0, u: users[i % users.length], ts: Date.now() - (h - i) * 3.6e6,
      }));
      if (h > 0) blocks[h - 1].dx = L;
      await kv.set('tower_current', { id: ((await kv.get('tower_counter')) ?? 1), blocks, L, createdAt: Date.now() - h * 3.6e6, lastEventSeq: h });
      return { ok: true, h, L };
    }
    case '/api/dev/reset-user': { await kv.del(`energy_${user}`); return { ok: true }; }
    case '/api/dev/memorials': return { memorials, flairs: [...flairs.entries()] };
    default: return null;
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const user = url.searchParams.get('u') || null; // null = логаут
  try {
    if (url.pathname.startsWith('/api/')) {
      const out = await api(req, url, user);
      if (out === null) { res.writeHead(404); return res.end('{}'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(out));
    }
    const file = url.pathname === '/' ? '/src/client/index.html'
      : url.pathname === '/main.js' ? '/src/client/main.js'
      : url.pathname;
    const data = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': MIME[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`WOBBLE local: http://localhost:${PORT}/?u=alice  (вторая вкладка: ?u=bob; логаут: без ?u)  CONFIG.oMax=${CONFIG.oMax}`));
