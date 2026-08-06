# BUILD_REPORT.md — Hootly

Built from the normative spec pack in `docs/` (00–07). One commit per milestone; `git log --oneline` is the progress record.

**Status:** all 12 milestones complete. `npm run build` is clean under strict TypeScript (23 routes). `npm test` is green. No `.env.local` existed during the build, so every external integration is fully written and only its outermost call is guarded — see [Stubs awaiting keys](#stubs-awaiting-keys).

---

## 1. What was built, per milestone

### M1 — Scaffold
Next 15 App Router, TypeScript strict (`noUncheckedIndexedAccess` on), Tailwind v4 with the doc 03 §9 tokens mapped into `@theme` so `bg-primary` / `rounded-card` / `shadow-xs` resolve to spec values. `components/ui/` primitives — Button, Card, Input, Modal, Toast, Tabs, Meter, Skeleton, ProgressBar, EmptyState, SourceChip — each with hover, focus-visible, active, and disabled states. Demo page at `/dev/ui` to eyeball them against the ship gate.

### M2 — Ollie
Hand-authored SVGs per doc 05 §12: `OllieMark` (works at 16px, used as favicon), `OllieAnimated` with the four specced modes (idle blink, thinking head-tilt + dots, success wing-flap + 2 sparkles, concerned brows), `OlliePixel` (16×16 grid), `OllieStory` (cozy-library scene for auth and paywall). Animations are CSS-driven and reduced-motion-safe. Favicon + a generated OG image.

### M3 — Auth + shell
Supabase auth (Google OAuth + email magic link, no passwords), session refresh in middleware, `/auth/callback` routing to onboarding or home. App shell: 260px sidebar with live course list and the free-plan usage meter, top bar with breadcrumb and avatar menu, mobile bottom tab bar under 768px. Settings with all four tabs (Account / Billing / Usage / Privacy) including the typed-confirm account-deletion flow.

### M4 — Data layer
`supabase/migrations/0001_init.sql` is doc 04 §4 verbatim — every table, index, trigger, the `match_chunks` RPC, the `quiz_questions_take` view, both RLS classes, storage bucket policies, and a Realtime broadcast-authorization policy for the private `job:{id}` channels. `0002` adds two columns the screens need that 0001 lacked (`profiles.marketing_emails`, `study_plan_items.moved_from`). `0003` closes an exam-integrity hole (below). `lib/billing/limits.ts` holds the limits verbatim with the doc 04 §5 semantics encoded. Soft-delete with cascade + restore, Trash screen, and the nightly `purge-trash` / daily `roll-plan-forward` crons.

### M5 — Ingestion
`ingest-material` handles every specced kind: PDF (per-page text), PPTX (jszip + XML), DOCX (mammoth), TXT, images (GPT-4o vision OCR), audio/video (ffmpeg → 64kbps mono → ≤20-min segments → Whisper → stitched with timestamps), YouTube (captions only via youtubei.js), pasted text, Quizlet paste-import, and the `topic` marker. Chunking is ~800 tokens with 15% overlap preserving page/timestamp locators; embeddings batch 64. Upload progress is real end to end — XHR transfer progress for the file, then live job-stage broadcasts. Every doc 04 §9 error code renders with its exact copy and a recovery action.

### M6 — Generation
`generate-notes` (outline → parallel sections → groundedness pass), `generate-cards` (with cosine-0.95 dedupe against existing cards), `generate-quiz` / `generate-exam` (with per-question answer-key verification), `generate-plan`, `regenerate-section`, and the `build-course` orchestrator that drives the theater. All prompts in `lib/ai/prompts/` are doc 06 verbatim; all outputs are zod-validated with the one-retry-then-`ai_invalid_output` contract. Artifact UIs: notes reader with 68ch measure, source chips, and a split-pane source viewer; flashcard manager; full-screen review session; quiz and exam engines; study plan.

### M7 — Tutor
Streaming chat over the Vercel AI SDK. Per message: quota check → input gate (moderation + topical classifier behind a cheap regex prefilter) → RAG retrieval → stream → strip the `GENERAL_KNOWLEDGE` marker → resolve `[chunk:ID]` markers into citation chips → persist. Socratic toggle, inline numbered citations with hover excerpts and click-to-split-pane, the general-knowledge banner, and the free-tier meter above the composer at ≤5 remaining.

### M8 — Onboarding
Steps 4.1–4.7 URL-driven via `?step=`, progress dots over the five interactive steps only. The generation theater is driven entirely by real orchestrator events with no fake timers — events queue and replay at ≤150ms intervals so the animation reads cleanly when the backend outruns the eye. First-value moment: spotlight tour → 3-question warm-up quiz → success moment → skippable paywall → one-tap referral survey.

### M9 — Billing
Idempotent `scripts/stripe-setup.ts` creating the catalog, the `edu20` coupon, and a portal configuration with cancellation at period end and **no retention flow**. Checkout with mutually-exclusive discount logic, portal, self-serve refund, and signature-verified webhooks with `stripe_events` idempotency. The paywall modal is a single component driven by a `context` prop, openable from anywhere via a `hootly:paywall` window event.

### M10 — Marketing
Landing, `/pricing` with the published-limits comparison table, and the three legal pages. The social-proof strip is deliberately omitted (brand rule 8 — no fake logos); the slot is reserved with a code comment.

### M11 — Analytics
Every event in the doc 07 §2.2 dictionary is typed in `lib/analytics/events.ts` and captured through it — no inline event strings anywhere. `limit_meter_viewed` fires from the `Meter` component itself, so every metered surface reports it without per-call-site wiring. `share_link_created` / `share_link_opened` are the only unwired events; sharing is P1 and no shipped surface creates a link.

### M12 — Hardening
Unit suite, AI eval harness, Playwright smoke, seed script, accessibility sweep, and the 18-point ship gate applied to every screen.

---

## 2. Test results

**Vitest — 179 tests green** across limits, FSRS, zod schemas, guardrail routing, RAG chunking/citation resolution, and parsers. The webhook-idempotency and AI-eval suites landed alongside; run `npm test` for the current count.

**AI eval harness** (`tests/ai/`) ships three hand-written public-domain fixtures with expected-property files and implements the five doc 06 §8 checks. It runs offline today against recorded fixtures and switches to live API calls automatically when `OPENAI_API_KEY` is present.

**Playwright** (`tests/e2e/smoke.spec.ts`) is split honestly: the always-on section really runs today (marketing, pricing limits, legal, auth screens, the unauthenticated redirect, 404, keyboard focus), and the full signup→checkout→refund journey is written completely but skips loudly while keys are missing.

**Build:** `npm run build` clean, 23 routes, strict TS with no errors.

---

## 3. Bugs found and fixed during the build

1. **Exam integrity was enforceable only by convention.** Doc 04 §4 says full `quiz_questions` reads go through a server action, but the Class B `own read` RLS policy let any signed-in client select `answer` and `explanation` straight from the anon key — a student could read the answers mid-exam with one query. Migration `0003_exam_integrity.sql` revokes that grant and re-grants only the take-view columns. Enforced in the write path too: during an exam attempt `submitAnswer` stores `is_correct = null`, so even a direct read of `attempt_answers` reveals nothing.
2. **The guardrail prefilter missed the most common phrasing.** "Write me an essay" slipped past `SUSPICIOUS` because the pattern required a determiner immediately after "write". Fixed to allow the optional indirect object.
3. **`humanInterval` collapsed every sub-hour interval to `<10m`.** A 45-minute FSRS interval rendered as `<10m` on the rating bar — actively misleading. Now only genuinely sub-10-minute steps get that label.
4. **Client components imported from a `server-only` module.** `Markdown` and `CitedMarkdown` pulled the chunk-marker helpers out of `lib/ai/rag.ts`, which fails the build. The pure helpers moved to `lib/ai/chunk-markers.ts`.
5. **Ten routes shipped without an error boundary and six without a skeleton** — a ship-gate item 10 failure. All now have both, with skeletons hand-matched to their final layout so nothing shifts.

---

## 4. Stubs awaiting keys

No `.env.local` existed during the build. Per the build rules, every integration is complete and only the outermost call is guarded, marked `// TODO(key-needed)` — **39 guards across 27 files**. Copy `.env.example` to `.env.local`, fill it in, and the guards become dead code. Nothing else needs rewriting.

| Missing key | What is currently inert |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Sign-in returns "isn't configured yet"; authed routes redirect to `/login`. Marketing, auth screens, and `/dev/ui` render fully. |
| `SUPABASE_SERVICE_ROLE_KEY` | Jobs, usage counters, trash cascade, and Realtime broadcasts no-op. |
| `OPENAI_API_KEY` | All generation, OCR, transcription, embeddings, the tutor, and both verification passes. The guardrail gate falls back to its regex prefilter rather than failing open entirely. |
| `STRIPE_SECRET_KEY` / `WEBHOOK_SECRET` | Checkout, portal, refund, and webhooks return 503. |
| `NEXT_PUBLIC_POSTHOG_KEY` | All capture silently drops (analytics never breaks a product flow). |
| `INNGEST_EVENT_KEY` / `SIGNING_KEY` | Event sends return false; actions surface "isn't configured yet on this deployment". A local Inngest dev server works without keys. |
| `RESEND_API_KEY` | Export-ready, payment-failed, and refund emails. |

---

## 5. What you still have to do by hand

These are console-only steps no script can perform (doc 07 §5).

**Supabase**
1. Create the project; copy the URL, anon key, and service-role key into `.env.local`.
2. Run the three migrations in order (`supabase db push`, or paste them into the SQL editor).
3. Enable the Google provider under Authentication → Providers and paste the OAuth client ID/secret.
4. Set the magic-link / OTP expiry to **15 minutes** — the UI copy promises exactly that.
5. Confirm the `materials` storage bucket exists and is **private** (migration 0001 creates it, but verify).
6. Turn on Realtime for the database, and confirm the broadcast-authorization policy from 0001 is active.
7. Enable point-in-time recovery — it backs the data-durability promise.
8. Restyle the magic-link email template to the design system; subject: `Your Hootly sign-in link 🦉`.

**Google Cloud**
9. Create OAuth credentials and configure the consent screen as "Hootly", scopes `email` + `profile` only.
10. Add Supabase's callback URL as an authorized redirect URI.

**Stripe** (keep TEST mode until the Playwright checkout test passes)
11. `npm run stripe:setup` — creates the product, both prices, the `edu20` coupon, and the portal configuration.
12. Add the webhook endpoint `POST {APP_URL}/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
13. Only after the smoke test passes end to end: switch to live keys and re-run the setup script against live mode.

**PostHog**
14. Create the prod project; copy the key.
15. Build the three funnels (Activation, Monetization, Upload health) and the three flags (`paywall-onboarding-position`, `pricing-v1`, `annual-badge-copy`) in the UI.
16. Create the cancel-reason and churn-NPS surveys.
17. Verify session-replay input masking is actually on before any real traffic.

**Everything else**
18. Inngest prod environment + keys; register the app URL so the crons fire.
19. Resend domain verification for `hootly.app`.
20. Sentry project + DSN, with PII scrubbing configured.
21. Custom domain, SSL, `robots.txt`.
22. OpenAI org spend limits with alerts at $50 / $200 / $500.
23. A status page (BetterStack) linked from the 500 screen.
24. **Have an attorney review the three legal pages.** They are written as a working template and marked as such in a code comment at the top of each file.
25. Trademark and domain diligence on "Hootly" before launch (doc 02 §3 asks for this explicitly).

---

## 6. Decisions log

Every choice the docs left unspecified is recorded in `DECISIONS.md` — **50 entries**, one line each, covering what was unspecified, what was chosen, and why. The entries worth knowing about without reading the file:

- **Image-only PDFs fail honestly.** Doc 04 §9 lists `ocr_needed→auto-ran` as an info state, but v1 ships no PDF rasterizer, so a scanned PDF surfaces `extract_empty` with the doc's recovery copy rather than silently producing nothing. Standalone image uploads *do* run vision OCR.
- **A documented doc conflict:** doc 04 §4 says course soft-delete stamps `deleted_at` on plan items, note sections, and quiz questions — but those tables have no `deleted_at` column in the same doc's schema. Children are gated by their parent row instead; flagged in a comment in `lib/trash.ts` rather than silently improvised.
- **Quiz misses become flashcards but never charge quota** — they aren't AI generations, and charging for them would break the published-limits promise. Same reasoning: a failed generation's retry is sent unmetered, because the first attempt already spent the quota.
- **Short-answer grading never silently marks you wrong.** Unmatched free text routes to self-assessment with the correct answer shown either way, and an unresolved self-assessment never auto-creates a flashcard.
