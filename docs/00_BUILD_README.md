# 00 — BUILD README (start here)
**Hootly — AI study platform. Instructions for the coding agent building this.**

## What you're building
A production web app per the seven docs in this folder. The docs are normative — when something is unspecified, follow the design system's principles and the trust rules below; when docs conflict, priority order is: 04 (data) > 06 (AI) > 07 (integrations) > 05 (screens) > 03 (design) > 02 (PRD) > 01 (research). (PostHog event names: doc 07 §2.2 is canonical.) Flag conflicts in code comments, don't silently improvise.

## Reading order
1. `02_PRD.md` — what and why (skim §5–§10 carefully)
2. `03_Design_System.md` — tokens, components, motion, the 18-point ship gate
3. `04_Architecture_and_Data.md` — stack, repo layout, full SQL, jobs, limits
4. `05_Screen_Specs.md` — every route, states, exact copy (use copy verbatim)
5. `06_AI_Prompts_and_Schemas.md` — prompts verbatim, schemas, guardrails, evals
6. `07_Integrations_Spec.md` — Stripe, PostHog, auth wiring
7. `01_Competitive_Analysis.md` — context only (why the trust rules exist)

## Build order (each milestone ends runnable + committed)
1. **Scaffold** — Next 15 + TS strict + Tailwind v4 with `@theme` tokens from 03 §9; `components/ui/` primitives (Button, Card, Input, Modal, Toast, Tabs, Meter, Skeleton, EmptyState, SourceChip) with all interactive states; Storybook-style demo page at `/dev/ui` to eyeball them against the ship gate.
2. **Ollie assets** — SVG mark + variants per 05 §12 (hand-author the SVGs; CSS/SMIL or Lottie for blink/think/success). Favicon, og image.
3. **Auth + shell** — Supabase auth (Google + magic link), profiles trigger, app shell (sidebar, top bar, mobile tabs), settings/account.
4. **Data layer** — run migration 0001 (04 §4), RLS, storage bucket, `limits.ts`, usage counters, Trash + purge cron.
5. **Ingestion** — upload flow (materials tab + modal), Inngest `ingest-material` for pdf/pptx/docx/txt/image(OCR)/audio/video/youtube/pasted/topic/quizlet, Realtime progress, all error codes from 04 §9 rendered.
6. **Generation** — notes/cards/quiz/exam/plan jobs with prompts + schemas + groundedness + answer-key verification from 06. Artifact UIs from 05 §7 (notes with source chips + split-pane, card manager, review session with ts-fsrs, quiz/exam engines, plan).
7. **Tutor** — streaming chat route, citations, Socratic toggle, guardrail pipeline (06 §3), general-knowledge banner.
8. **Onboarding** — steps 4.1–4.7 incl. generation theater driven by real Realtime events, warm-up quiz, referral survey.
9. **Billing** — Stripe catalog script, checkout, portal, webhooks, self-serve refund, paywall modal (05 §9), meters everywhere limits apply.
10. **Marketing** — landing + pricing + legal pages.
11. **Analytics** — typed PostHog events (07 §2.2) wired at every listed point; session replay; `auth_paint_measured`.
12. **Hardening** — Playwright smoke (signup→onboard→upload→generate→review→quiz→paywall→checkout test-mode→portal cancel→refund), Vitest units (limits, fsrs wrapper, webhook idempotency, zod schemas, guardrail classifier routing), a11y pass (keyboard + focus rings + reduced-motion), perf (dashboard TTI <2s), then run the 18-point ship gate (03 §8) on EVERY screen and fix failures.

## Non-negotiable product rules (these are the brand — breaking them is a bug)
1. No surprise walls: remaining quota is visible BEFORE any gated action; `limit_hit` opens the paywall, never an error.
2. Cancel is 2 clicks via Stripe portal; refund ≤7 days is self-serve; downgrade never locks or deletes existing content (read/review stays free forever).
3. Nothing a user makes is ever silently lost: autosave everywhere, soft-delete + 30-day trash, jobs never overwrite old artifacts until new ones are ready, review ratings persist per-rating.
4. AI shows its work: citations on every grounded claim; explicit banner when answering from general knowledge; failed groundedness is flagged, not hidden; quiz always reveals the correct answer + why.
5. Integrity: tutor never writes submittable work; Socratic redirect per 06.
6. Motion subtle (≤400ms, transform/opacity only, reduced-motion respected); red only for destructive/error; white background everywhere.
7. Every async surface has skeleton/empty/error states; every error has a recovery action.
8. No fake numbers, testimonials, or stats anywhere in the UI.

## Definition of done
All 12 milestones complete · Playwright smoke green · eval harness (06 §8) passing on the starter golden set that ships in `/tests/ai/fixtures/` (3 public-domain course texts + expected-property files — create these as part of milestone 12) · ship gate passes on all screens · `npm run build` clean with strict TS · seed script creates a demo account with one populated course.
