# Design adaptation: field conditions

`DESIGN.md` (Uber-derived) is the base system. This file records where this product's
constraints override it, and why. Read both.

## Why Uber and not the alternatives

The user is a painter holding a phone **outdoors in direct sunlight**, often with paint on
their hands or gloves on, standing in a customer's house and wanting to leave. That single
fact decided the system:

- **Uber**: `#000000` on `#ffffff` is a 21:1 contrast ratio, the highest available. Display
  type at 36-52px. Pill-shaped interactive elements give large, unambiguous tap targets.
  Built for exactly this: one-handed mobile utility under bad conditions.
- **Linear**: rejected. Its canvas is `#010102`, a near-black dark UI. Dark interfaces in
  direct sunlight are the worst possible choice for outdoor phone use.
- **Stripe**: rejected as a base. Its display type is 300-weight with negative
  letter-spacing, which disappears in glare. But see below.

## Borrowed from Stripe: tabular figures

Stripe's system uses tabular-figure type wherever money and numerics matter. That rule is
correct and is adopted here for **all currency columns**: line item prices, subtotal, tax,
total, both in the app and in the customer-facing quote.

```css
font-variant-numeric: tabular-nums;
```

Without it, proportional digits make price columns fail to align vertically, which reads as
sloppy on a document a contractor is asking someone to pay against.

## Overrides on the base system

| Base | Override | Reason |
| --- | --- | --- |
| Decorative 4:3 editorial illustration | Drop entirely | No brand photography exists, and it costs load time on a truck's cell connection |
| Display type at 52px | Cap at 36px on the app surface | 52px wastes vertical space on a 390pt viewport where every field matters |
| `#5e5e5e` body text | Only on white; never on `canvas-soft` | Fails contrast in glare on tinted surfaces |
| Link blue `#0000ee` | Keep | High contrast and unambiguously a link, which matters for a non-technical audience |

## Minimum touch target

44×44 CSS pixels absolute floor, 56px preferred for primary actions in the capture flow.
The base system's pill radius (999px) is kept: it makes target boundaries obvious.

## Two surfaces, one system

- **App UI** (contractor, phone, daylight): full Uber system, maximum contrast, big targets.
- **Quote document** (customer, any device, often desktop email): same palette, but
  document-like: tighter type scale, tabular figures throughout, generous margins. It must
  read as something a real business sent, not as an app screen.

## Safe areas

`index.html` sets `viewport-fit=cover`, which is required for `env(safe-area-inset-*)` to
report real values. Every fixed-position element must respect the insets, or content sits
under the notch and the home indicator. This cannot be verified on Windows: it is on the
pre-pilot real-iOS checklist.
