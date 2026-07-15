# Бриф хакатона «Games with a Hook» — канон для всех игр

> Game-agnostic источник правды. По этому документу чекается **любая** наша игра.
> Стратегия этой игры (WOBBLE) — план [13-wobble-build-plan.md](13-wobble-build-plan.md), идеация [12-second-game-ideation.md](12-second-game-ideation.md).
> Первая игра, Logic Thread, — в отдельном репозитории `logic-thread/` (свой такой же бриф в `logic-thread/docs/`).
> Здесь — только то, что общее и не меняется от игры к игре.

## 0. Факты

- **Организатор:** Reddit + Phaser.
- **Окно:** 17.06 → 15.07.2026. **Дедлайн сабмита: 16 июл 2026, 03:00 GMT+2** (на странице «Jul 16, 2026 @ 3:00am GMT+2»).
- **Формат:** онлайн, публичный. **Devvit Web обязателен** (React / Phaser / three.js / Godot / GameMaker / Unity — любой стек, компилирующийся в Devvit Web).
- **Приз-фонд:** $40 000. Участников на странице: ~2448 (до сабмита обычно доходит 10–18% → ~240–420 работ; см. doc 11).
- **Категории Devpost:** Beginner Friendly · Gaming · Web.
- **Эталонный саб с примерами:** r/GameOnReddit. Поддержка — Devvit Discord (office hours).

## 1. Что просят построить

Новая игра на Devvit через **Interactive Posts**, которая «inspires collective joy».

Главная рамка (дословный смысл брифа) — **retention**:
> «Apps that give redditors a reason to return day after day… progression, daily challenges, fresh content, meaningful choices, social dynamics, or simply the anticipation of what happens next… a compelling loop that builds momentum over time and turns a one-time visitor into a regular player.»

Практические следствия:
- Судят **в основном по демо-посту** (реальная community-игра по ссылке). Демо обязано быть **self-explanatory** — судья должен всё понять, просто играя в пост.
- **Existing projects допускаются**, но игра должна быть *significantly updated during the hackathon period*.
- Планка — **launch-ready polish**; бонус за **хороший mobile-опыт**.

## 2. Официальные критерии судейства (рубрика — по ней бьют ЛЮБУЮ игру)

Дословно со страницы + перевод. Это и есть скоркарта жюри:

1. **Delightful UX** — *«Experiences should be built with exciting layouts and themes. While apps do not need to be perfect, it should be easy and fun to uncover what the app has to offer.»* → легко и **весело** вскрывать, что игра предлагает.
2. **Polish** — *«…as close to publishable as possible and compliant with Devvit Rules. Judges should be able to understand everything… by interacting with example posts. The closer to launch quality, the higher the score.»* → почти релизное качество; всё понятно из самого поста.
3. **Reddit-y** — *«…community and embracing topics people care about… have their own identity, be community-minded, and bring something fresh… The best apps will bring a community together.»* → **человеко-ориентированность и комьюнити, а НЕ тема «про Reddit»** (см. анти-паттерн ниже).
4. **Hook-y** — *«Does your app provide a compelling reason to return regularly? …anticipation, ongoing goals, evolving experiences, or fresh opportunities that encourage users to come back day after day.»* → **самый весомый сквозной критерий всего хакатона.**
5. **[Только Phaser-трек] Phaser Innovation** — *«…creative, effective use of Phaser's tools and workflow that meaningfully elevates gameplay, polish, and technical execution.»*

Судьи: **Reddit Panel** + **Phaser Panel**.

## 3. Призовые треки

| Приз | Сумма | Победителей |
|---|---|---|
| **Best App with a Hook** (главный) | $15 000 | 1 |
| **Best Use of Phaser** | $5 000 | 1 |
| **Best Use of Retention Mechanisms** | $3 000 | 1 |
| **Best Use of User Contributions** (UGC: комменты/посты/рисунки/пазлы/уровни) | $3 000 | 1 |
| **Honorable Mentions** | $1 000 | 10 |
| **Devvit Helper Award** (за помощь другим участникам, Discord/office hours) | $500 | 6 |
| **Feedback Awards** (за developer satisfaction survey) | $200 | 5 |

Сигнал структуры: она клонирует «Daily Games» (янв 2026), где $15k взяла игра **с UGC-контуром**, а чистые дейли-пазлы осели в HM ($1k). Вывод doc 11: главный приз тянет к retention **и** пользовательскому вкладу, а не к одиночному пазлу.

## 4. Анти-паттерны — чего НЕ хотят (чеклист для ЛЮБОЙ игры)

Дословный список «What we're NOT looking for». Прогонять каждую игру через него:

- [ ] **AI Slop** — не должно быть очевидно, что это ИИ, с первого экрана. Требуют: **UI влезает в вьюпорт**, у аппа **уникальная идентичность**, дизайн под живого игрока. (Прямая цитата: «you can even ask your agentic assistant to help hide their involvement».) → удалять моки, заглушки, `confirm()`, «мировые рекорды» из воздуха.
- [ ] **On-the-nose Reddit theming** — «Reddit-y» ≠ игра **про** Reddit/карму/сабреддиты/Snoo/модерацию. Reddit-y = human-first + использование механик саба (comments, flair, feeds, community). Тема «про Reddit» не запрещена, но сама по себе хаком «Reddit-y» не является.
- [ ] **Literal "hook" (рыбалка)** — «hook» = **retentive/replayable**, а не крючок/удочка. Буквальная трактовка — минус.
- [ ] **Common / overdone ideas** — «score worse unless extremely unique»: space shooters, клоны популярных игр, простые платформеры, **collaborative storytelling apps**, **trivia apps**. Если делаешь одно из этого — обязан быть радикально уникальным. ⚠️ Логические/дейли-пазлы соседствуют с этим ведром — нужен явный дифференциатор от «trivia».

## 5. Эталоны (игры, которые реально возвращают — их приводит бриф)

r/honk · r/colorpuzzlegame · r/bunnytrials · r/alignmentchartFills · r/hotandcold · r/dailyguess · r/bridgedit · r/battlebirds · r/kraw · r/LETTERSET.
Сквозные паттерны эталонов (из ресёрча doc 11): бот-пост = сердцебиение (нумерованный daily); UGC трогает **сложность/логику**, не косметику; флаир = публичный леджер прогресса; share-артефакт кодирует **путь**, не ответ; закреплённый бот-коммент с правилами; признание по имени; спойлер-норма «clue, not answer».

## 6. Что сабмитить (Requirements)

1. **App listing** — ссылка на апп на developer.reddit.com.
2. **Demo post** — ссылка на сабреддит + **публичный пост с запущенной игрой**. ⭐ Главный объект судейства — делать максимально self-explanatory.
3. **[Опционально] Developer Platform feedback** — developer satisfaction survey → шанс на Best Feedback prize ($200 ×5).

## 7. Технические ограничения Devvit (шпаргалка, детали — doc 11)

- **Cron-пост** (`scheduler` в devvit.json) — ежедневный нумерованный пост.
- **Redis + sorted sets** — перцентиль = `zRank/zCard`; серии, гистограммы.
- **`setUserFlair`** — флаир-леджер прогресса (рекомендован доками).
- **`runAs:'USER'`** — коммент от имени игрока, **только после ревью-апрува**; паттерн — reply к закреплённому бот-комменту.
- **`showShareSheet`** + deeplink — шеринг артефакта.
- **Спойлер-разметка** `>!…!<`.
- **Inline-webview:** только **tap** (без drag), загрузка **< 1 с**, целевая ширина ~390 px (mobile-first).
- **Ревью аппа: 1–2 рабочих дня.** Без апрува апп ставится только на сабы **< 200 подписчиков** → сабмитить на ревью заранее (жёсткий гейт).

## 8. Переиспользуемый self-check (перед сабмитом ЛЮБОЙ игры)

Прогнать игру по этому листу. «Нет» хотя бы в блоке A/B — красный флаг.

**A. Проходит ли анти-паттерны (раздел 4)?**
- [ ] UI влезает во вьюпорт на телефоне, без слопа/моков/заглушек.
- [ ] Не «про Reddit» буквально; Reddit-механики использованы человеко-ориентированно.
- [ ] Не попадает в overdone-ведро — либо не попадает, либо **радикально уникальна** (сформулируй одним предложением, чем).

**B. Хук виден в ОДНОЙ 3-минутной сессии с телефона?** (принцип doc 11)
- [ ] За 3 минуты судья без контекста понимает, зачем вернуться завтра.
- [ ] Есть видимая причинность / предвкушение / цель, к которой идёшь (не только «сыграл и всё»).
- [ ] Демо-пост self-explanatory; правила — в закреплённом бот-комменте в 2 строки.
- [ ] **Дифференциатор НЕ заперт за длинным заданием.** То, что отличает игру от заезженного жанра, видно/ощущается в первые 20–30 сек — ДО любого «прохождения»/полного решения. (Урок LT 09.07: голос/конверт/трейл были заперты за полным solve → судья за 3 мин видел «ещё один дейли-пазл». WOBBLE это уже держит: башня всегда качается + мемориалы в ленте.)

**C. Скоркарта жюри (раздел 2) — честная оценка X/10 по каждому:**
- [ ] Delightful UX · [ ] Polish · [ ] Reddit-y · [ ] Hook-y · ( [ ] Phaser — если целимся в трек ).

**D. Retention/UGC-билеты (доп. призы) — берём попутно или осознанно скипаем?**
- [ ] Retention Mechanics ($3k): daily/recurring контент, серии, флаир-леджер.
- [ ] User Contributions ($3k): UGC, трогающий **сложность/логику/исход**, а не косметику (иначе — ширма; пример разбора — в доках Logic Thread, отдельный репозиторий).

**E. Гейты процесса:**
- [ ] Сабмит на ревью заранее (1–2 дня форы), иначе апп живёт только на сабе < 200 подписчиков.
- [ ] Прогон на **реальном телефоне** (inline-высота вебвью не документирована).
- [ ] Демо-саб засеян реальными постами/метриками — **без сидирования фейковых чисел** (одно вскрытие = минус доверие ко всему).

## 9. Ссылки

- План WOBBLE: [13-wobble-build-plan.md](13-wobble-build-plan.md) · идеация и скоринг: [12-second-game-ideation.md](12-second-game-ideation.md)
- Devpost-заявка: [DEVPOST-WOBBLE.md](DEVPOST-WOBBLE.md)
- Logic Thread (первая игра) — отдельный репозиторий `logic-thread/`, доки в `logic-thread/docs/`.
