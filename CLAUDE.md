# Painter Quote — project instructions

Mobile-first PWA that turns job photos plus a text description into a professional
painting quote in under a minute. Target user: residential painting contractors,
1–10 employees.

The full plan lives at `C:\Users\relat\.claude\plans\do-i-need-an-replicated-flask.md`.

## Non-negotiable product rules

1. **The AI never estimates square footage from a photo.** A vision model cannot measure
   reliably from an uncalibrated phone camera, and area is the number that sets the price.
   The AI produces surface inventory, condition, and prep flags. Dimensions come from the
   contractor via presets. The deterministic engine does all arithmetic.
2. **The AI never sets a final price.** It may propose a placeholder, clearly marked, that
   the contractor must confirm. Every confirmation writes back to the price book.
3. **The price book builds itself through use.** Seed defaults are flagged `isDefault` and
   render as "your price?" placeholders. Never gate first value behind bulk data entry.
4. **Every quote carries "estimate, subject to on-site verification" terms.** Mandatory
   before any quote reaches a real customer.

## Architecture

- **Platform:** Cloudflare Workers (free tier permits commercial use; no cold starts)
- **Framework:** Hono — Express-shaped routing running *on* Workers. Not an alternative to
  Cloudflare; a layer on top of it.
- **DB:** Cloudflare D1 (SQLite). All access behind `src/server/repo/` so it stays swappable.
- **Photos:** R2, keys stored on the job row. Client resizes to ≤1024px before upload.
- **AI:** Gemini Flash behind an adapter in `src/server/ai/`.
- **Dev:** `npm run dev` runs Vite and the Worker together via `@cloudflare/vite-plugin`,
  one origin, real workerd runtime with bindings.

**Do not propose Vercel.** Its Hobby tier forbids commercial use, which breaks the day a
contractor pays. **Do not propose MongoDB.** The driver needs TCP sockets Workers lacks,
and the Atlas Data API that bridged that gap is retired.

## Tier testing

Two unrelated things are both called "tier":

- **AI provider tier** — `AI_TIER` + `GEMINI_API_KEY`. Free and paid Gemini differ only by
  billing on the Google Cloud project; same key format, same endpoint, same code. Keep two
  keys, switch by env. No branching code paths.
- **Product subscription tier** — Free / Pro / Business entitlements in
  `src/server/entitlements/`. Dev-only `?tier=` override, gated by `ALLOW_TIER_OVERRIDE`,
  which must be `"0"` in production.

`DEMO_MODE=1` stubs the vision call entirely — the whole UI builds and demos with no API
key, no quota burn, and no network.

## Testing

- `src/server/pricing/` is pure functions and must be exhaustively unit tested. Cover job
  minimum, multi-coat multipliers, and tax rounding. This is the part that must never be wrong.
- Fixtures in `src/server/fixtures/` are shared by tests and the seed command so they cannot drift.
- No Apple hardware available. Use `npx playwright install webkit` for a real WebKit engine
  on Windows; Chrome DevTools emulation only catches layout, not engine bugs.

## Design skills (vendored, gitignored)

`.claude/skills/` is not committed. To restore after a fresh clone:

```bash
curl -sL -o .claude/skills/taste-skill/SKILL.md \
  https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md
```

For **impeccable**, `npx impeccable install` is broken in 3.6.1 — its CLI requests
`/api/download/bundle/claude-code`, but that endpoint only serves `bundle/universal`.
Download `https://impeccable.style/api/download/bundle/universal`, unzip it, and copy the
`.claude/skills/impeccable` and `.claude/agents` folders into place.

Note on scope: **taste-skill declares itself wrong for this app's core UI** ("Not
dashboards, not data tables, not multi-step product UI"). Use it for the marketing/landing
page only. **impeccable** explicitly covers product UI, forms, and onboarding — that is the
one to use on the quote flow.

`.claude/settings.json` (committed) installs impeccable's hooks: a design check after every
Edit/Write on UI files, and a deeper pass on Stop. Delete that file to disable them.

## Conventions

- npm, not pnpm (pnpm is not installed on this machine).
- Commit messages: subject, blank line, body. No AI attribution of any kind.
