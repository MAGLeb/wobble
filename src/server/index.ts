// WOBBLE - Devvit Web server. Тонкая обёртка над GameCore (core.mjs - единая логика с локальной версией).
// /api/* - webview; /internal/* - menu. Вся механика и математика - в core.mjs/math.mjs (покрыты тестами).

import { createServer, getServerPort, context, reddit, redis } from "@devvit/web/server";
import express from "express";
import { GameCore } from "./core.mjs";
import { DevvitKV } from "./kv-devvit.mjs";

const app = express();
app.use(express.json());
const router = express.Router();

// GameCore на Devvit Redis. Хуки: мемориал-пост от апп-аккаунта (runAs не нужен) строго после фиксации.
type Memorial = {
  towerId: number; height: number; culprit: string; title: string;
  buildersCount?: number; perfect?: number;
  hero?: { u: string; saved: number } | null;
  topBuilders?: { u: string; n: number }[];
};

const core = new GameCore(new DevvitKV(redis), {
  onMemorial: async (m: Memorial) => {
    // 1) отдельный мемориал-пост (архив в ленте саба)
    try {
      const subredditName = context.subredditName;
      if (!subredditName) return;
      await reddit.submitCustomPost({
        subredditName,
        title: m.title,
        entry: "default",
        postData: { type: "memorial", towerId: m.towerId },
      });
    } catch (e) { console.error("memorial post failed", e); }
    // 2) хроника в треде самого tower-поста (фидбек 15.07): событие видно там, где играют
    try {
      const postId = context.postId;
      if (!postId) return;
      const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
      const podium = (m.topBuilders ?? []).slice(0, 3)
        .map((b, i) => `${medals[i]} u/${b.u} - ${b.n} storey${b.n > 1 ? "s" : ""}`).join("  \n");
      const hero = m.hero ? `\n\n\u{1F9B8} Best save: u/${m.hero.u} (straightened ${m.hero.saved} lean)` : "";
      await reddit.submitComment({
        id: postId,
        text: `\u{1FAA6} **Tower #${m.towerId} has fallen** at storey ${m.height} - toppled by **u/${m.culprit}**.\n\n` +
          `${m.buildersCount ?? "?"} builders raised it. Top of the podium:\n\n${podium}${hero}\n\n` +
          `**Tower #${m.towerId + 1} begins now.** \u{1F9F1}`,
      });
    } catch (e) { console.error("memorial comment failed", e); }
  },
});

// username: на блоках и в мемориалах - имена, не t2-id; кешируем в redis
async function me(): Promise<string | null> {
  const uid = context.userId;
  if (!uid) return null;
  const key = `uname_${uid}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  const name = (await reddit.getCurrentUsername()) ?? null;
  if (name) await redis.set(key, name);
  return name;
}

router.get("/api/state", async (_req, res) => {
  const user = await me();
  const s: Record<string, unknown> = await core.state(user);
  s.postMeta = context.postData ?? null; // memorial-режим клиента
  res.json(s);
});
router.post("/api/claim", async (_req, res) => res.json(await core.claim(await me())));
router.post("/api/onboarded", async (_req, res) => res.json(await core.setOnboarded(await me())));
router.post("/api/heartbeat", async (req, res) => res.json(await core.heartbeat(await me(), req.body?.token)));
router.post("/api/drop", async (req, res) => res.json(await core.drop(await me(), req.body?.token, req.body?.offset)));
router.get("/api/archive", async (req, res) => {
  const id = Number(req.query.id);
  res.json((await core.archive(id)) ?? { missing: true });
});

router.post("/internal/menu/create-post", async (_req, res) => {
  const subredditName = context.subredditName;
  const post = await reddit.submitCustomPost({
    subredditName: subredditName!,
    title: "\u{1F3DB} WOBBLE - one tower for the whole subreddit. Don't be the one who topples it.",
    entry: "default",
    postData: { type: "tower" },
  });
  res.json({ navigateTo: post.url, showToast: "Tower post created!" });
});

app.use(router);
const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
