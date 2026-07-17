# WOBBLE docs

The numbering continues the hackathon's shared design sequence (docs 00-11 belong to the
first game, Deducto). WOBBLE's own docs start at 12 - the gap is intentional, nothing is
missing. Source comments reference these by number (e.g. `docs/13 §1`), so the numbers are
stable - don't renumber.

| Doc | What it is |
|-----|-----------|
| [00-hackathon-brief.md](00-hackathon-brief.md) | The hackathon rules, prizes and constraints we designed against. |
| [12-second-game-ideation.md](12-second-game-ideation.md) | How WOBBLE was chosen - the candidate ideas (DIGSITE, SHOVE, ...), scoring, and why the shared tower won. |
| [13-wobble-build-plan.md](13-wobble-build-plan.md) | **Mechanics & math** - the lean/crook model, anti-grief invariant, economy, the Pisa theme. Source of truth for `config.mjs` / `math.mjs`. |
| [14-wobble-plan.md](14-wobble-plan.md) | **Engineering** - architecture, Redis keys, the turn-lock protocol, camera-per-mode, MVP line. Source of truth for `core.mjs`. |
| [15-tower-wars-roadmap.md](15-tower-wars-roadmap.md) | **What's next (post-hackathon)** - subreddit-vs-subreddit Tower Wars: research, scoring, `redis.global`, and the staged roadmap with gates. |
| [DEVPOST-WOBBLE.md](DEVPOST-WOBBLE.md) | The Devpost submission copy (paste-ready English) and the internal submission checklist. |
| [img/](img/) | Gallery assets - the `hero` cover art, screenshots (`build`, `cover_*`, `memorial`, `practice`) and the demo GIF. |

For the game overview, build/deploy commands and structure, see the top-level
[README.md](../README.md). Internal Russian dev notes live in [../DEV.ru.md](../DEV.ru.md).
