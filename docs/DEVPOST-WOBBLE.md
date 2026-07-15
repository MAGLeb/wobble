# Devpost submission copy - WOBBLE

Paste‑ready English text for the Devpost form. Fill the `<…>` placeholders before submitting.
Deadline: **2026‑07‑15, 18:00 PT** (= 2026‑07‑16 03:00 GMT+2).

---

## Tagline (one line)

WOBBLE - one leaning tower for the whole subreddit. Tap to add your storey, and don't be the one who brings it all down.

> Positioning rule: lead with the **shared communal object + the drama of who topples it**, not "a tower‑stacking game." The hook a 3‑minute judge must feel is *one tower everyone is building together, and a public memorial that names whoever drops it.*

---

## Devpost form - field-by-field (copy each into its field)

- **Project name** (≤60): `WOBBLE - the subreddit's shared tower`
- **Elevator pitch** (≤140): `The whole subreddit builds one leaning tower, one tap per storey. Land yours and your name sticks. Topple it - the memorial names you.`
- **About the project**: paste the **Project Story** block below.
- **Built with** (tags): `Devvit` · `Reddit Developer Platform` · `Devvit Web` · `TypeScript` · `JavaScript` · `Canvas` · `Express` · `Redis` · `Vite` · `Node.js` · `HTML` · `CSS`
- **"Try it out" links**: `https://developers.reddit.com/apps/wobbletower` · `<paste the public demo-post permalink after creating it>` · `<public repo URL - wobble/ is its own repo>`
- **Image gallery**: cover (leaning tower) as hero, then build screen, memorial card, practice/onboarding (see captions below)
- **Video demo link**: optional, <60s, public YouTube/Vimeo - a ~20s clip of a drop + a collapse + the memorial lands hardest
- **Sponsor / Special Prizes**: check **Feedback Awards** *only if* you submit the feedback survey. (Retention / User‑Contributions sub‑prizes are auto‑considered - nothing to tick.)
- **Reddit username**: `ma9leb`
- **developers.reddit.com app page**: `https://developers.reddit.com/apps/wobbletower`
- **Link to test post**: `<paste the public demo-post permalink>` - must be a **Public** subreddit at submission time, <200 members, kept live through judging
- **Nominate a most helpful user**: skip
- **Did you use Phaser?**: **No**

## Project Story - paste into "About the project" (Markdown)

```markdown
## Inspiration
Reddit is at its best when a whole community rallies around one fragile, shared thing. We wanted that feeling - but with skill and stakes. So WOBBLE gives every subreddit a single leaning tower that everyone builds together, one storey at a time, and turns its inevitable collapse into a public event that names the person who caused it.

## What it does
There is one persistent tower per subreddit. Tap BUILD and a storey slides across the top - tap again to drop it. Land it centered and the tower stays steady; miss and it tilts. A lean bar shows how close the community is to disaster, and the taller the tower, the less it forgives. Land your storey and your name is carved on it for as long as the tower stands. Topple it, and the whole thing comes down for everyone - the game auto-posts a memorial ("Tower #14 fell at storey 87 - toppled by u/you") listing its top builders, and a fresh tower begins. Bricks regrow one every 3 hours (max 3), so you come back through the day; Practice mode is always free. Only one person builds at a time - everyone else watches the drop live, and a "you're next" queue keeps it fair. Recognition runs deep: every memorial ranks the fallen tower's top builders and calls out the most perfect drops and the single best save, while your all-time record - storeys placed, towers survived, and towers you've toppled - follows you in your subreddit flair.

## How we built it
Reddit's Developer Platform (Devvit Web) with an Express server and Redis. The shared tower is one canonical record; turns are handled by an atomic Redis SET-NX lock with a random token, so two simultaneous builders can never double-commit. The key trick: the tower's tilt is a single deterministic number (not a physics engine), so every device agrees on the exact state and the exact culprit - real physics is used only for the cosmetic collapse animation, which is recorded once and replayed. The server clamps every drop, which enforces two invariants at once: anti-cheat and anti-grief (no single bad storey can ever topple a fresh tower - proven by unit tests across 500 heights). Memorials are posted by the app account, and unit tests cover the tilt math and the game core.

## Challenges we ran into
- Keeping "one shared tower" consistent across many simultaneous players without a physics-sync nightmare - solved with a turn-lock, a scalar source of truth, and client-side replay.
- Tuning the collapse cadence so towers fall roughly every 60-120 storeys for a mixed-skill crowd - found the right knob with a bot simulation.
- Guaranteeing no lone griefer can knock down the community's tower, while two sloppy builders on a tall one still can.
- A tap-only, sub-second, mobile-first webview inside a Reddit post.

## What we learned
Designing a communal-object game where failure becomes the best content; using Devvit's atomic Redis primitives for fair turn-taking; and balancing a system that is forgiving of one honest mistake but brutal to carelessness.

## What's next
A full all-time leaderboard - top builders, longest-standing towers, and the most (and least) destructive players - plus deeper per-tower stats; real Reddit flair ranks for master builders; tower themes beyond the default Leaning-Tower-of-Pisa look; and shareable memorial cards.
```

---

## Inspiration / What it is

Reddit is at its best when a whole community rallies around one shared, fragile thing. WOBBLE gives every subreddit a single **leaning tower** that everyone builds together - one storey at a time - and turns its collapse into a public event that names whoever caused it. It's the drama of a communal object, but with real skill and real stakes.

## What it does / How to play

- There is **one persistent tower per subreddit**. Tap **BUILD** - a storey slides across the top, tap again to drop it centered.
- Every off‑centre drop **tilts** the tower. A lean bar shows how close the community is to collapse; the taller it gets, the less it forgives.
- **Land it** and your name is carved on that storey for as long as the tower stands.
- **Topple it** and the tower falls for everyone. The game auto‑posts a **memorial** - the tower's height, its top builders, and the one who dropped the fatal storey - and a new tower begins.
- **Bricks** regrow one every **3 hours** (max 3), so you return through the day. **Practice** mode is always free.
- **One builder at a time** - everyone else watches the drop live; a **"you're next"** queue keeps it fair.

## Why it keeps people coming back (category: Best App with a Hook)

- **The tower grows while you're away** - is your storey still standing? Is it load‑bearing now?
- **Bricks regenerate** every few hours - a gentle reason to check back.
- **Collapse is a public event** - a memorial post that pulls the whole subreddit back to see who did it.
- **Named stake** - your name on every storey you place, and on the memorial if you drop it.
- **One shared object** concentrates even a small community in a single place - it's alive even at low traffic.

## How it's built

Reddit Developer Platform - **Devvit Web** (`@devvit/web@0.13.7`) + Express + Redis. The tower's tilt is a **single deterministic number** (no physics engine), so every client agrees on state and culprit; real physics is used only for the collapse animation. Turns use an **atomic Redis SET‑NX lock** (token‑verified, no double‑commit). The server **clamps every drop** - one rule that guarantees both anti‑cheat and the anti‑grief invariant (a fresh tower survives any single bad storey - unit‑tested). Memorials are posted by the app account, and unit tests cover the tilt math + core. Tap‑only, sub‑second, mobile‑first webview.

## Built for this hackathon

Newly created during the submission period (built July 2026, after the June 17 start) - math, multiplayer core, server, webview and the Pisa theme were all made for *Games with a Hook*.

## Testing instructions (for judges)

1. Open the demo post: **<paste the public demo-post permalink>** (public subreddit, kept live through judging).
2. The game runs inside the post. Tap **BUILD** to lower a storey - tap when it's centered. No login needed to try it.
3. Tap **Practice** to feel a full arc solo: build, watch it lean, and it will collapse in ~30 seconds - that's how the real tower falls.
4. Tap the **🪦 fallen‑towers chip** to read a memorial from a tower the community already toppled.

App listing: **developers.reddit.com/apps/wobbletower**

---

## Image gallery - captions & order (up to 15, 3:2; first image = hero)

1. **Cover / the shared tower** - `One leaning tower for the whole subreddit - every storey carries a real member's name. Tap BUILD to add yours.`
2. **Build screen** - `Time your tap: a crane lowers your storey, the mini‑silhouette shows the tower's growing lean. Land it centered - or tilt it further.`
3. **Memorial** - `Topple the tower and the game posts a memorial: its height, its top builders, and the one who brought it down.`
4. **Practice / onboarding** - `Free Practice (and a 3‑step coached intro) let anyone feel a build - and a collapse - in seconds, no bricks spent.`

Notes: 4 screens are enough; optional +1 phone‑width shot to show responsive play. Use only **English** UI in screenshots.

## Demo post title & pinned header

Frame it as the **shared, communal** stakes up front - that's the causality a 3‑minute judge must see.

- **Post title:** `🏛 WOBBLE - one tower for the whole subreddit. Don't be the one who topples it.`
- **Pinned first comment:** two lines - how to play (tap BUILD, tap again when centered) + the stakes (the tower is shared; every storey is someone's; drop it and the memorial names you). Invite people to add a storey and check back to see if it's still standing.

## App listing description (paste in the developer portal)

**WOBBLE - the subreddit's shared leaning tower**

WOBBLE gives your community one tower to build together, one tap at a time. Land your storey and your name stays on it. Miss, and the whole tower leans closer to collapse - topple it, and the game posts a memorial that names you. A fresh tower rises, and it starts again.

- 🏛️ One shared, ever‑growing tower per subreddit
- 🧱 One tap to add a storey - your name carved on it forever
- ⚖️ Real stakes: a fresh tower survives any single bad drop, but a leaning one won't forgive two
- 🪦 Every collapse becomes a memorial post naming the culprit and the top builders
- ⏳ Bricks regrow through the day; free Practice anytime

No player setup - the game runs right inside the post. Add it to your community and start a tower from the subreddit menu.

## Links to fill on the form
- App listing URL: `https://developers.reddit.com/apps/wobbletower`
- Demo subreddit: `<public sub name>` (Public at submission, <200 members, live through judging)
- Demo post permalink: `<paste after creating the tower post>`
- Demo video (optional, <60s, public on YouTube/Vimeo): `<…>`
- Public repo: `<wobble repo URL>`

## Internal notes - DO NOT put on the form
- **Do not** claim *Best Use of Phaser* - no Phaser (deliberate: vanilla Canvas, ported cleanly, keeps polish budget).
- **Best Use of User Contributions is defensible here** (unlike Logic Thread): 100% of the difficulty is player‑generated - every storey a player places *is* the challenge the next builder faces. If asked which sub‑track, name **User Contributions** and **Retention** (brick regen, communal object, memorial loop). Main bet stays **Best App with a Hook**.
- Country of residence everywhere = **Serbia** (never Russia). Payout to a non‑Russian account.
- **Visibility:** the auto‑created `r/wobbletower_dev` is a private playtest sub - judges can't reach it. Create a **Public** sub (<200 members) with the same Reddit account that's logged into devvit, keep it live + <200 through judging.
- **Ban‑safety (learned from Logic Thread's r/LogicThreadDaily ban):** do **not** manipulate votes/subscribers on the demo sub. Multi‑account *gameplay* testing of the tower is fine (it's play, not vote/subscribe manipulation), but keep it light, add real rules + a description.
- The app listing already exists, so a public demo post + the listing link is enough for judges to play - `devvit publish` (review) is optional for submission and can run in parallel.
