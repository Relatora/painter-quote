# Painter Quote

Photo and description to a professional painting quote in under a minute.

AI assisted estimating for residential painting contractors running 1 to 10 person
businesses. It owns exactly one workflow, job info to scope to price to quote, and does not
try to be a contractor management platform.

## What it actually sells

Not "an app that formats your quote nicely." Painters lose money by **under scoping prep**:
wallpaper that has to come off, popcorn ceiling, water damage behind a stain, a stairwell
that needs staging, trim that needs caulk before it can be coated. Those are the line items
that get forgotten, and each one is real margin.

The product is a checklist that catches what you would forget to charge for.

## Two rules that shape everything

**The AI never estimates square footage from a photo.** A vision model cannot measure
reliably from an uncalibrated phone camera, and area is the number that sets the price. The
AI supplies surfaces, condition, and prep flags. The contractor supplies dimensions. A
deterministic engine does the arithmetic.

**The AI never sets a final price.** Seeded rates render as clearly marked suggestions that
the contractor confirms, and every confirmation writes back to their price book. A new user
can produce a complete quote on day one without first entering forty line items, and the
price book fills itself in through use.

## Stack

| Layer | Choice |
| --- | --- |
| Client | React, Vite, TypeScript, Tailwind, PWA |
| Platform | Cloudflare Workers |
| Framework | Hono |
| Database | Cloudflare D1 |
| Object storage | Cloudflare R2 |
| Vision | Gemini Flash behind an adapter |

Cloudflare throughout because its free tier permits commercial use and has no cold starts.
Running cost is zero until there is revenue.

## Running it

```bash
npm install
npx wrangler d1 migrations apply painter-quote --local
npm run dev
```

`npm run dev` starts Vite and the Worker together on one origin against the real workerd
runtime, so bindings behave as they do in production. No separate wrangler process.

`DEMO_MODE=1` (the default) stubs the vision call, so the whole UI runs with no API key, no
quota burn, and no network.

```bash
npm test          # pricing engine
npx tsc -b        # typecheck client and worker projects
npm run build
```

## Money

Stored as integer cents, and tax as integer basis points, everywhere. Binary floating point
cannot represent 0.1 exactly and a quote is a document someone pays against.

`src/shared/pricing.ts` is the single definition of what a quote costs. It sits in `shared`
rather than `server` because the editor computes live totals from the same code, and two
implementations of money math would eventually give two answers.

## Status

Photo to quote works end to end: capture job photos, let the AI find the work, confirm what
applies, set quantities and prices, share a link, and the customer opens a real document.

Authentication is deliberately absent so a painter can be handed a phone during validation
with nothing in the way. `DEMO_MODE=1` is the default, so the AI step returns a realistic
sample rather than calling a model, and a demo never depends on a live API call.

See the [open issues](https://github.com/Relatora/painter-quote/issues) for what is next.
