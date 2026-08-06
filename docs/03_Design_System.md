# Hootly Design System — "Calm Focus"
**v1.0 · August 6, 2026 · Companion to the PRD**

The one-sentence brief: a white, airy product where purple does the talking, black does the reading, color only ever means something, and nothing moves unless the motion tells the user something. The explicit goal is to be visibly, obviously *not* a vibecoded app — every rule below exists to kill a specific vibecoded tell.

---

## 1. Color

### Core palette
| Token | Hex | Use |
|---|---|---|
| `bg` | `#FFFFFF` | App background. The main theme IS white — protect it. |
| `bg-subtle` | `#FAFAFC` | Alternate section bands, sidebar, table stripes (barely-there cool gray, never beige) |
| `surface` | `#FFFFFF` | Cards — separated from bg by border + shadow, not by gray fills |
| `border` | `#EAEAF0` | Hairline borders, 1px |
| `ink` | `#17171C` | Primary text — near-black, never pure #000 (harsh) and never gray-on-gray |
| `ink-secondary` | `#5C5C6B` | Supporting text. Minimum body-text color — nothing lighter than this for sentences |
| `ink-tertiary` | `#9494A6` | Timestamps, meta, placeholders only |
| `primary` | `#7C3AED` | THE purple (violet-600). Primary buttons, active nav, links, focus rings, progress, Ollie's accents |
| `primary-hover` | `#6D28D9` | Hover/pressed |
| `primary-soft` | `#F3EEFD` | Selected states, active-nav pill fills, tag backgrounds |
| `primary-border`| `#DDD0F9` | Borders of selected cards/inputs |

### Semantic (color always means something)
| Token | Hex | Use |
|---|---|---|
| `danger` | `#DC2626` | Destructive actions ONLY — delete buttons, irreversible warnings, error text. Red never decorates. |
| `danger-soft` | `#FEF1F1` | Delete-confirm surfaces, error banners |
| `success` | `#188A4C` | Correct answers, "Saved", mastery |
| `success-soft`| `#EBF7F0` | Correct-answer fills |
| `warning` | `#B45309` | Approaching limits, "exam in 3 days" |
| `warning-soft`| `#FDF5EC` | Warning fills |
| `info-soft` | `#EEF4FE` | Neutral callouts (with `#1D5BD6` text) |

Rules: purple is the only brand color — no rainbow dashboards (StudyFetch's pastel-per-feature tiles read as clutter). Semantic colors appear only when their meaning applies. Black text on white passes AAA; `ink-secondary` on white passes AA. Never place text on a gradient.

### Gradients (subtle, flavor-only)
Gradients are seasoning, not paint. Exactly three are allowed:
1. **Hero glow** — a radial blush behind hero/empty-state art: `radial-gradient(60% 50% at 50% 0%, #F3EEFD 0%, transparent 70%)`. Max ~8% perceived tint.
2. **Card sheen** — feature/paywall cards may use `linear-gradient(180deg, #FDFCFF 0%, #F7F4FE 100%)` — white-to-faint-lavender, nothing stronger.
3. **Primary button depth** — `linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%)` for a barely-there premium feel.
Banned: purple→pink→orange hero washes, angled multicolor meshes, gradient text on body copy, gradients under any paragraph. If a screenshot in grayscale shows banding, the gradient is too loud.

## 2. Typography

**Family:** Inter (variable) for UI + body; optional display face for marketing H1s only (e.g. General Sans / Cal Sans). `JetBrains Mono` for code. Load two weights of Inter (400–500 range and 600–700 range) — not six fonts.

| Style | Size / line-height | Weight | Use |
|---|---|---|---|
| Display | 44/52 | 700, -2% tracking | Marketing hero only |
| H1 | 28/36 | 700, -1% | Page titles |
| H2 | 20/28 | 600 | Section titles |
| H3 | 16/24 | 600 | Card titles |
| Body | 15/24 | 400 | Default UI + reading text |
| Body-strong | 15/24 | 600 | Emphasis (not bold whole sentences) |
| Small | 13/20 | 400–500 | Meta, labels, table density |
| Micro | 12/16 | 500, +2% tracking, uppercase optional | Overlines, badges |

Rules that kill vibecoded typography: body text never below 14px or above 16px; **reading measure 60–75ch max** (`max-width: 68ch` on notes/articles — full-width paragraphs are the #1 vibecoded tell); line-height ≥ 1.5 on body; one H1 per page; no font-weight 300 on white; no letter-spacing on lowercase body; real apostrophes ('), en-dashes, and tabular numerals (`font-variant-numeric: tabular-nums`) on stats/timers.

## 3. Layout, spacing, radius, elevation

**Spacing:** 4px base scale — 4/8/12/16/20/24/32/40/48/64. Card padding 20–24. Section gaps 32–48. Consistent gutters (24 desktop, 16 mobile). Whitespace is the luxury signal — when in doubt, add 8px, don't remove.

**Grid:** app shell = fixed 260px sidebar (`bg-subtle`, 1px border-right) + fluid content with `max-width: 1200px` centered; content column for reading = 68ch. 12-col grid on marketing.

**Radius scale (rounded, never blobby):** inputs & small controls **10px**, buttons **10px** (pill allowed for chips/tags), cards **16px**, modals & large surfaces **20px**, hero art containers **24px**, avatars/Ollie circle. One radius per component class — mixing 6/10/14/22 randomly is a vibecoded tell. Never fully-round rectangular buttons.

**Elevation (shadows are whispers):**
- `shadow-xs`: `0 1px 2px rgb(23 23 28 / 5%)` — resting cards (with border)
- `shadow-md`: `0 4px 12px rgb(23 23 28 / 7%)` — hover lift, dropdowns
- `shadow-lg`: `0 12px 32px rgb(23 23 28 / 10%)` — modals, command palette
Banned: colored glow shadows, `0 25px 50px` hero drops, shadow without border on white (mushy edges).

## 4. Components

**Buttons.** Primary: purple gradient fill, white text, 10px radius, 40px height (44 touch), 600 weight, hover = `primary-hover` + `shadow-md` + translateY(-1px), pressed = translateY(0)/scale(0.98). Secondary: white, `border`, ink text. Ghost: text-only purple. **Destructive: red fill, reserved for the final destructive step** — a delete flow is ghost/secondary at first touch, red only at confirm. Focus: 2px `primary` ring at 2px offset, always visible on keyboard nav.

**Cards.** White, 1px `border`, 16px radius, `shadow-xs`; hover (if clickable): border → `primary-border`, `shadow-md`, 150ms. Selected: `primary-soft` fill + `primary-border` + small check.

**Inputs.** 10px radius, 1px border, 40px height, white; focus = purple border + soft ring; error = `danger` border + 13px message below (never placeholder-only labels).

**Modals.** 20px radius, `shadow-lg`, scrim `rgb(23 23 28 / 40%)`; enter: fade + scale 0.98→1, 180ms. Destructive modals: Ollie looks concerned; confirm button is the only red thing on screen; requires typing nothing (two clicks max) but shows exactly what's deleted + "recoverable for 30 days." **Single exception:** account deletion uses typed-confirm ("DELETE") — it's the one action with no 30-day undo surface in-app.

**Toasts.** Bottom-center, white, border, `shadow-md`, icon-colored by semantics, auto-dismiss 4s, "Undo" action where possible (undo > confirm dialogs for reversible actions).

**Empty states.** Every empty screen = small Ollie illustration + one sentence + one primary action. No dead ends anywhere.

**Meters (trust UI).** Free-plan usage meters: thin purple progress bars with "2 of 3 uploads used" labels, visible in-context *before* the user hits an action — never a surprise wall.

**Charts/stats (progress screens):** purple as the single data hue with opacity ramps; `bg-subtle` gridlines; tabular numbers; no 3D, no rainbow.

## 5. Motion — "subtle or nothing"

Purpose-first: motion confirms an action, directs attention, or explains a spatial change. Anything else is off.

| Pattern | Spec |
|---|---|
| Micro-interactions (hover, press, toggle) | 120–150ms, `ease-out` |
| Enter/exit (dropdowns, toasts, modals) | 180–220ms, `ease-out`, fade + 4–8px translate or 0.98 scale |
| Page/panel transitions | ≤ 250ms fade-through; never slide whole pages |
| List item add/remove | 200ms height+fade; no cascades > 3 items |
| Card flip (flashcards) | 300ms 3D flip on Y — one of the few "expressive" moments allowed |
| Generation theater | Real progress: checkmark pops (150ms spring), typewriter for plan items (25ms/char), "✓ Done" pill flips. Tied to actual job events, never faked loops |
| Skeletons | Shimmer 1.2s linear; skeletons match final layout exactly (no layout shift) |
| Ollie | Idle blink every 6–10s; head-tilt while AI streams ("thinking"); single wing-flap + 2 confetti-free sparkles on success. Lottie/SVG, ≤ 30KB, never loops obnoxiously |
| Streaming text | Fade-in words, no jitter; auto-scroll pauses on user scroll |

Hard rules: nothing bounces except one spring on success moments; no parallax; no animation > 400ms; no autoplaying looping background animation; `prefers-reduced-motion` swaps everything to opacity-only 100ms; 60fps or cut it (transform/opacity only — never animate layout properties).

## 6. Ollie usage rules

Logo = geometric owl mark (works at 16px favicon); wordmark = "hootly" lowercase, ink, with purple owl-eye tittle optional. In-product Ollie appears at: onboarding steps (pixel-sticker variant), generation theater (animated), tutor avatar (chat), empty states, streak milestones, paywall + Stripe checkout (storybook illustration variant), 404/error pages (apologetic pose). Ollie never blocks content, never exceeds ~96px in-app, never appears twice on one screen, and never talks in system-error voice (errors are factual; Ollie softens, not obscures).

## 7. Voice & microcopy

Friendly-smart, never childish: "Let's build your study plan" not "Yay!! Let's gooo 🎉". Numbers over adjectives ("Saved 2 seconds ago", "3 of 5 free uploads"). Buttons are verbs ("Generate flashcards", never "Submit"). Errors say what happened + what to do next. Delete flows say exactly what's deleted and that it's recoverable for 30 days. One emoji maximum per surface, usually zero. The trust position lives in microcopy: "Cancel anytime in two clicks", "We never train AI on your notes."

## 8. The anti-vibecoded checklist (ship gate)

Run every screen against this before merge; any ❌ blocks ship:

1. Is the background actually white, with gray only where structure demands it?
2. Is there exactly one purple primary action visible above the fold?
3. Does every color on screen mean something (semantic or brand)?
4. Body text: 14–16px, line-height ≥1.5, measure ≤75ch, `ink` or darker than `ink-secondary`?
5. Same radius on every card? Same on every button?
6. All spacing on the 4px scale, with real breathing room (no 3px/17px/23px hacks)?
7. Borders 1px + shadow-xs on cards (no floating mush, no heavy drops)?
8. Gradient audit: ≤8% tint, none under text, grayscale test passes?
9. Every interactive element has hover, focus-visible, active, and disabled states?
10. Every async surface has skeleton (matching layout), empty (with Ollie + action), and error (with recovery) states?
11. All motion ≤400ms, transform/opacity only, reduced-motion respected?
12. Red appears only on destructive/error?
13. Icons from one set (Lucide), one stroke width, optically aligned?
14. Real content tested: 40-character course names, 200-page PDFs, empty everything?
15. Keyboard: full flows completable, focus ring always visible?
16. The squint test: blur your eyes — is the hierarchy (what to read first, what to click) still obvious?
17. The mom test: would a non-technical person know what to do in 5 seconds on this screen?
18. Zero lorem ipsum, zero default-Tailwind-blue, zero unstyled browser controls in production.

## 9. Reference implementation tokens (CSS)

```css
:root {
  --bg:#FFFFFF; --bg-subtle:#FAFAFC; --surface:#FFFFFF; --border:#EAEAF0;
  --ink:#17171C; --ink-2:#5C5C6B; --ink-3:#9494A6;
  --primary:#7C3AED; --primary-hover:#6D28D9; --primary-soft:#F3EEFD; --primary-border:#DDD0F9;
  --danger:#DC2626; --danger-soft:#FEF1F1; --success:#188A4C; --success-soft:#EBF7F0;
  --warning:#B45309; --warning-soft:#FDF5EC; --info:#1D5BD6; --info-soft:#EEF4FE;
  --r-ctl:10px; --r-card:16px; --r-modal:20px; --r-hero:24px;
  --sh-xs:0 1px 2px rgb(23 23 28/5%); --sh-md:0 4px 12px rgb(23 23 28/7%); --sh-lg:0 12px 32px rgb(23 23 28/10%);
  --ease:cubic-bezier(.2,.8,.2,1); --t-fast:150ms; --t-med:200ms;
  --font:'Inter var',system-ui,sans-serif;
}
```
