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
const core = new GameCore(new DevvitKV(redis), {
  onMemorial: async (m: { towerId: number; height: number; culprit: string; title: string }) => {
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
