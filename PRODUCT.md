# PRODUCT.md

Derived from the approved project plan and requirements document, not from a separate
interview. See `CLAUDE.md` for engineering rules and `DESIGN.local.md` for the visual system.

## What this is

A mobile-first PWA that turns job photos and a short description into a professional,
sendable painting quote in under a minute.

MVP scope is exactly one workflow: **job info → scope → price → quote.** It is not a
contractor management platform and will not compete with Jobber, ServiceTitan, or
Housecall Pro on CRM, scheduling, dispatch, or invoicing.

## Who uses it

Residential painting contractors running 1-10 person businesses. Owner-operators who
quote constantly and do their own paperwork.

**The usage scene, which decides most design questions:** a painter standing in a
customer's house or sitting in a truck, holding a phone **outdoors in direct sunlight**,
often with paint on their hands. They want to produce the quote and leave. They are not
sitting at a desk, and they are not design-literate: they are results-literate.

## What they are actually buying

Not "an app that formats my quote nicely." Painters lose money by **under-scoping prep** -
wallpaper that must come off, popcorn ceiling, water damage, a stairwell needing staging,
trim needing caulk before coating. Those are the line items they forget to bill, and each
one is real margin.

The product is a **checklist that catches what you would forget to charge for.** That is
the reason to pay $19/month.

## Non-negotiable product rules

1. The AI never estimates square footage from a photo. It cannot measure reliably from an
   uncalibrated phone camera, and area sets the price. AI supplies surfaces, condition, and
   prep flags; the contractor supplies dimensions; a deterministic engine does the math.
2. The AI never sets a final price. It may propose a clearly-marked placeholder the
   contractor confirms.
3. The price book builds itself through use. Seeded defaults render as "your price?"
   placeholders. Never gate first value behind bulk data entry.
4. Every quote carries "estimate, subject to on-site verification" terms.

## Current surface: the manual quote builder

Auth is deliberately absent. This surface exists so a real painter can be handed a phone
during validation outreach and produce a quote with nothing in the way. AI scope generation
comes after; the manual path stays as the fallback and the edit surface.

**Mode: Operate.** The painter completes a task. Scanability, large targets, and legibility
under glare outrank expression. Brand lives in precision, not decoration.

## Success criteria

- "I have a job" to "I have a quote I can send" in about one minute.
- The painter returns and does it a second time unprompted.
- Key quality signal: per-line-item edit rate. A line most contractors edit means the seed
  price or the prompt is wrong.

## Constraints

- $0 running cost until revenue. Cloudflare free tier throughout.
- Windows development machine, no Apple hardware. iOS verified via WebKit and a borrowed
  device before pilot.
- Money is integer cents, tax is integer basis points, everywhere.
