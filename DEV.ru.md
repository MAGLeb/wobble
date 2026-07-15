# WOBBLE (вторая игра для хакатона)

**НЕ путать с logic-thread/ (Logic Thread) — это ОТДЕЛЬНОЕ приложение.**

План: docs/14-wobble-plan.md · Механика: docs/13-wobble-build-plan.md · Идеация: docs/12.

## Статус (14.07): локальная сборка ГОТОВА, тесты 16/16

```
Зависимостей ноль. Запуск:  node local/server.mjs     → http://localhost:8571
Игроки:  /?u=alice  /?u=bob  (две вкладки = два аккаунта; без ?u = логаут)
Тесты:   node --test test/
Дев-руты (только локально): /api/dev/seed?h=40&L=20 · /api/dev/memorials
```

Структура (вся логика переносится в Devvit-шаблон):
- `src/shared/` — config + чистая математика крена (ЕДИНАЯ для клиента и сервера)
- `src/server/core.mjs` — GameCore: lock SET NX+token, слот «you're next», энергия 1/3ч,
  дроп, обвал, архив, хуки onMemorial/onFlair/onEvent (в Devvit → submitPost/setUserFlair/realtime)
- `src/server/kv.mjs` — KV-интерфейс (get / set{nx,expiration} / del) = подмножество Devvit Redis
- `src/client/index.html` — все экраны: cover/build/queue/practice/out-of-blocks/collapse/memorial/onboarding
- `local/server.mjs` — dev-сервер (НЕ едет в прод; в Devvit те же роуты в server entry)

Перенос в Devvit: (1) шаблон devvit web; (2) shared/core/kv — как есть; (3) kv → context.redis
(те же 3 метода); (4) хуки → reddit API; (5) client/index.html → webview; (6) ?u= → context.userId;
(7) поллинг → realtime-канал tower_{postId}; (8) postData для мгновенного первого кадра.
