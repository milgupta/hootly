# PRD — "Hootly" (working title): The AI Study Platform Students Actually Trust
**Owner: Milan · v1.0 · August 6, 2026**
Companion docs: `01_Competitive_Analysis.md` (evidence base) · `03_Design_System.md` (visual spec)

---

## 1. One-liner

Upload anything from your class — slides, PDFs, lectures, photos of handwritten notes — and Hootly turns it into a complete, source-grounded study system: notes, flashcards, quizzes, practice exams, and a tutor that never makes things up without telling you.

## 2. Positioning: the trust + polish play

Every competitor won on TikTok distribution and is now bleeding 1-star reviews over four things: surprise billing, hidden free limits, lost data, and hallucinating AI. We take the opposite position on all four, loudly:

1. **Honest billing** — public pricing page, published free-tier limits, cancellation in two clicks via Stripe's customer portal, pro-rated upgrades. "Cancel in 10 seconds. Seriously." is marketing copy, not legal risk.
2. **Your stuff never disappears** — durable storage, soft-delete with 30-day recovery, autosave everywhere, visible sync state.
3. **AI that shows its work** — every generated note, card, and answer cites the exact source passage it came from. If it's not in your materials, it's labeled as outside knowledge.
4. **Actually beautiful** — calm, white, purple-accented, one clear next action per screen (full spec in the design system doc).

Tagline directions: "Study smarter, sleep sooner." / "The night owl's unfair advantage." / "Locked in."

## 3. Brand

**Recommended name: Hootly** — short, friendly, verb-able ("just hootly it"), owl-native, and clearly differentiated from the two dog brands. Alternates if trademark/domain diligence fails: **NightOwl** (strongest identity match with late-night studying, but crowded trademark space), **Owlio**, **StudyOwl** (descriptive/SEO-safe but derivative). Run a trademark + domain check before committing; .ai/.app/.study TLDs are all acceptable for this audience.

**Mascot: Ollie the Owl** — our logo, tutor avatar, and content engine. Design brief: round-bodied, big-eyed owl; white/cream body, purple wing and brow accents (brand purple #7C3AED family); drawn in multiple renderings like StudyFetch does with Spark.E (validated pattern): a clean geometric mark for the logo, an animated SVG/Lottie version for the app (idle blink, head-tilt when thinking, tiny wing-flap on success), a pixel-art sticker for onboarding, and a storybook illustration for the paywall and marketing. Ollie appears at every emotional moment: welcome, generation theater, empty states, streak milestones, and inside Stripe checkout. Owl associations we lean on: wisdom, night-owl study sessions, "wise choice" microcopy.

## 4. Users & goals

**Primary persona — "Crunch-time college student":** 18–24, discovers us on TikTok/IG the week of an exam, uploads a semester of slides at 11pm, needs maximum value in the first 5 minutes, price-sensitive, cancels aggressively. **Secondary:** high-schoolers (AP/IB), grad/med/professional-cert students (higher willingness to pay, higher accuracy expectations).

**Business goals (first 12 months):** activation (signup → first study artifact generated) ≥ 60%; week-1 retention ≥ 35%; free→paid conversion ≥ 6%; refund/chargeback rate < 0.5% (the trust position, measured); App-store-independent: web-first launch.

**North-star metric:** weekly studied minutes per active user (tracked in PostHog).

## 5. Feature specification

Priorities: **P0 = launch**, **P1 = fast-follow (0–3 months post-launch)**, **P2 = later/validate first**. Every AI feature carries the safeguard layer from §8.

### P0 — Launch (the core loop, done excellently)

**F1. Ingestion pipeline.** Upload PDF, PPTX, DOCX, TXT, images (incl. handwritten — GPT-4o vision OCR), audio (MP3/M4A), video (MP4), YouTube links, pasted text, or "type a topic" from presets. Quizlet import (CSV/export poaching — validated by StudyFetch). Published limits per plan, shown *before* upload, with clear per-file progress, and a named failure state for every error ("This PDF is image-only — we ran OCR, check page 12"). **Never silently drop a file** (Turbo's 5-PDFs-2-processed failure is a review magnet). Every upload chunked, embedded (pgvector), and page/timestamp-indexed for citations.

**F2. Courses (study sets).** One course = materials + exam date + generated artifacts + progress. Archive, rename, delete (soft-delete, 30-day recovery). Exam-date-driven prioritization (Ask Maeve's model, done better).

**F3. AI notes.** Three depth levels (Quick recap / Standard / Comprehensive). Structured headings, tables, LaTeX math rendering, code blocks. **Every section carries source chips** (“Slides wk3, p.14”) that open the source side-by-side. Regenerate per-section, not whole-doc. Export to PDF (paid).

**F4. Flashcards + spaced repetition.** Auto-generated per topic; edit/add/favorite/shuffle; FSRS scheduler; three mastery states (Learning / Reviewing / Mastered); custom generation prompts ("focus on definitions only" — Turbo's praised differentiator); cloze + basic + reversed types. Daily review queue is the retention hook.

**F5. Quizzes & practice exams.** Quizzes: MCQ, true/false, fill-in-blank, short answer, with **the correct answer always shown** plus a why-explanation citing the source (StudyFetch's most-hated quiz behavior is hiding the right answer). Practice exams: full-length, timed, difficulty mix, modeled on the course's real exam format when a past exam/syllabus is uploaded — **exam realism is Ask Maeve's single praised edge; we make it a headline feature.** Wrong answers auto-feed the flashcard queue.

**F6. AI tutor chat ("Ask Ollie").** Chat grounded in course materials via RAG. Cites passages inline; distinguishes "from your materials" vs "general knowledge" visually. Socratic mode toggle (guide-me vs just-answer). Math rendered properly. Persistent history per course (StudyFetch loses chat history — we never do). Streaming responses with Ollie thinking animation.

**F7. Study plan.** Generated from materials + exam date + self-rated familiarity (New / Some background / Know it well). One recommended next action on the dashboard at all times ("Today: 15 cards + Topic 3 quiz"). Re-plans as the exam approaches.

**F8. Onboarding + generation theater.** Full spec in §7.

**F9. Billing (Stripe).** Public pricing page. Free tier with published limits. Monthly + annual (annual pre-selected with honest savings math). Stripe Checkout + Customer Portal (self-serve cancel, plan switch, invoices). 7-day full-refund policy, self-serve. .edu detection → student discount. Dunning emails. No dark patterns — this is the brand.

**F10. Accounts & data (Supabase).** Google OAuth + email magic link. RLS on every table. Soft-delete + 30-day trash. GDPR/CCPA export + delete account self-serve. Autosave with visible "Saved" state.

**F11. Analytics (PostHog).** Full event taxonomy (doc 07 §2.2), funnels for onboarding and paywall, session replay (all sessions, inputs masked), feature flags for pricing/paywall experiments, surveys for cancel-reasons.

### P1 — Fast-follow

**F12. Live lecture recording → notes.** Browser-based recording with live transcript (Whisper), multi-speaker diarization (both competitors fail multi-speaker — differentiator), language auto-detect (StudyFetch garbles non-preselected languages). Local buffer until upload confirmed — **a recording must be unlosable.**
**F13. Audio recap (podcast mode).** OpenAI TTS two-voice conversational recap, 10–30 min, per topic or course. Turbo-validated commute use case.
**F14. Glossary.** Auto-extracted key terms per course (Ask Maeve parity; cheap to build on existing pipeline).
**F15. Focus mode.** Pomodoro + optional lo-fi + streaks. Streaks are the only gamification at launch (see cuts, §6).
**F16. Sharing.** Read-only share links for note/card sets (viral loop); duplicate-into-my-account CTA for recipients (top-of-funnel).
**F17. Mobile PWA hardening,** then native apps only when web retention proves out. Web/app parity is a stated complaint about Turbo; we don't ship a second platform until the first is excellent.

### P2 — Validate before building

**F18. Voice tutor calls** (real-time speech-to-speech Ollie) — expensive per-minute; validate demand via waitlist.
**F19. Essay feedback** — rubric-based feedback (not grading — integrity posture), for humanities segment.
**F20. Group study / collaboration** — real Turbo strength but heavy; needs multiplayer infra.
**F21. LMS integration (Canvas)** — unlocks institutional lane later; not a v1 student need.
**F22. Past-exam / content library** — crowdsourced + SEO surface (Ask Maeve's Knowledge Hub); legal review required for shared course content.

## 6. Proposed cuts from the parity surface — NEEDS MILAN'S APPROVAL

Evidence-based recommendation to **not** build these, at least for v1:

| Cut | Competitor evidence |
|---|---|
| **Arcade / study games** | StudyFetch's games ship broken ("blank screen" reviews), add dashboard clutter, and no reviewer cites them as a retention driver. High build cost, low praised value. |
| **Currency-based gamification (Bones/XP/shop/leaderboards)** | Confirmed confusion in the video teardown — currency soup dumped with zero explanation. We keep **streaks only** (universally understood, cheap). |
| **AI explainer videos** | StudyFetch sells these as separate $9.99–19.99 add-on subs; expensive to generate, gimmicky, no strong praise found anywhere. |
| **iMessage tutor** | Cute differentiator for StudyFetch but unmeasurable value, iOS-only, high maintenance. |
| **Essay grader (as "grading")** | Integrity liability + invites "AI did my homework" brand damage; if built later, ship as *feedback*, not grades (F19). |
| **Separate browser extension** | No competitor has a successful one; zero user demand found. |
| **Offline mode (v1)** | Nobody has it; genuinely hard; defer until native apps. |

Everything else competitors have is either P0/P1 above or explicitly P2.

## 7. Onboarding flow (spec)

Design rules: progress indicator on every step (StudyFetch has none), one question per screen, every step skippable where sane, URL-driven steps (`?step=`) for resumability and PostHog funnels, skeleton-prefetch the next screen during OAuth so there is **zero unbranded dead time** (StudyFetch loses ~15s to dark Google screens).

1. **Signup** — Google or email magic link. ".edu email? Student discount applies automatically." No credit card.
2. **Who are you** — Student / Teacher / Professional (2×2 cards, Ollie waves).
3. **Studying for** — College / Grad school / High school / Med school / Professional cert / Standardized tests / Other — each with exam-name sublabels ("NCLEX, Bar, CPA, AWS…"). (Stolen: instant self-identification.)
4. **First course** — drop zone (all formats) + Import Quizlet + Paste notes + photo of handwritten + preset topic chips + "I have nothing yet" escape hatch. Exam date (optional, skippable).
5. **Calibration** — "How well do you know this?" New / Some background / Know it well.
6. **Generation theater** — the star moment (stolen from StudyFetch and upgraded): Ollie "builds" the course live — topics check themselves off, the study plan typewriters in, tool tiles pop in, cards flip to "✓ Done", with real progress (no fake waits). Ends on "Your study plan is ready."
7. **VALUE BEFORE PAYWALL** — user lands in the course and completes one real action free: flips 5 flashcards or answers a 3-question mini-quiz. *Then*:
8. **Paywall (soft, skippable)** — honest framing: full published feature table, annual vs monthly with real math, "Cancel anytime in 2 clicks — here's how", 7-day refund badge, Ollie illustration. Skip keeps a functional free tier (published limits, no invisible walls: meters show "2 of 3 free uploads used" *before* the action).
9. "How did you hear about us?" — **after** first value, one tap, skippable.

## 8. AI system & the safeguard layer (Milan's explicit requirement)

**Models (OpenAI API):** GPT-4o/4.1 class for tutor + generation; 4o-mini class for bulk generation (cards, glossary) with quality evals; Whisper for transcription; TTS for recaps; text-embedding-3 for RAG. Model choice per task is config-driven so we can swap as OpenAI ships.

**RAG grounding:** all generation runs over retrieved chunks from the user's own materials (Supabase pgvector). Chunks carry source metadata (file, page/timestamp) → every output cites. Retrieval confidence below threshold → the UI says "I couldn't find this in your materials" instead of guessing.

**Safeguard layers (every AI feature passes all five):**
1. **System prompt contract** — every prompt includes an app-alignment preamble. Template:
   > You are Ollie, Hootly's study tutor. You help students LEARN — you never complete graded work for them (essays to submit, take-home exam answers, assignment solutions to copy). Ground every claim in the provided source material and cite chunk IDs. If the sources don't cover the question, say so explicitly before using general knowledge, and label it. Refuse requests unrelated to studying (write my Tinder bio, medical/legal advice, harmful content) with a friendly one-line redirect back to studying. Match the student's level. Be encouraging, never condescending. Output only in the requested JSON schema when one is specified.
2. **Input gate** — OpenAI Moderation API on user prompts + a lightweight topical classifier; off-topic/abusive prompts get Ollie's friendly redirect, logged to PostHog (`ai_guardrail_triggered`).
3. **Structured output validation** — all generation (cards, quizzes, plans) uses JSON-schema-enforced outputs; malformed → auto-retry → graceful error. No raw-markdown-leaking-into-UI bugs (StudyFetch ships these).
4. **Groundedness check** — for notes/quiz answers, a cheap second-pass model verifies each claim maps to a cited chunk; unverifiable claims get flagged or stripped. Quiz answer keys are validated (the answer must be derivable from the cited source) before a quiz is served.
5. **Academic integrity posture** — Socratic default for "solve this for me" homework patterns (guides, doesn't dump answers; user can still toggle direct answers for self-study), no essay-writing mode, visible integrity policy. This is also institutional-sales insurance (StudyFetch's "learning, not cheating" positioning is why College Board funded them).

**Eval harness:** golden set of (material, expected artifact) pairs per feature; run on every prompt/model change; track accuracy, citation coverage, refusal correctness. Hallucination complaints are the #2 review killer in this market — we measure instead of hoping.

## 9. Tech architecture

### 9.1 Stack
**Next.js (Vercel) + Supabase (Postgres, Auth, Storage, RLS, pgvector, Realtime) + Stripe (Checkout, Customer Portal, webhooks) + PostHog (product analytics, flags, replays, surveys) + OpenAI API.** Background jobs (ingestion, generation) via a queue (e.g. Inngest/QStash) — long AI jobs never block requests and survive restarts; job status streams to the client (powers generation theater with *real* progress).

### 9.2 Data model (core tables — full SQL is normative in doc 04)
`profiles` · `courses` (exam_date, familiarity) · `materials` (file meta, status, error_detail) · `chunks` (embedding, source page/ts) · `notes` / `note_sections` (source_chunk_ids) · `flashcards` (FSRS state) + `card_reviews` · `quizzes` / `quiz_questions` / `quiz_attempts` / `attempt_answers` · `chat_threads` / `chat_messages` · `study_plan_items` · `subscriptions` (Stripe mirror) · `usage_counters` (user-visible meters) · `stripe_events` · soft-delete via `deleted_at` columns (30-day trash). RLS everywhere; single `materials` bucket with per-user path prefixes.

### 9.3 PostHog event taxonomy (illustrative — the canonical dictionary is doc 07 §2.2)
`signup_completed`, `onboarding_step_viewed/completed` (step name), `material_upload_started/succeeded/failed` (format, size, error), `generation_started/completed` (artifact type, duration, tokens), `first_artifact_generated` (activation event), `card_reviewed`, `quiz_completed` (score), `tutor_message_sent` (grounded: y/n), `ai_guardrail_triggered` (layer, reason), `paywall_viewed/plan_selected/checkout_completed`, `limit_meter_viewed/limit_hit`, `cancel_started/completed` (reason survey), `share_link_created/opened`. Funnels: signup→activation; paywall view→pay; upload→first review session. Flags: paywall placement, pricing, model tiers.

### 9.4 Stripe rules (trust position, encoded)
Products: Free / Plus monthly / Plus annual. Customer Portal enabled for cancel + plan switch (two clicks from Settings — no email-to-cancel, no retention maze). Webhooks reconcile `subscriptions`; grace period on failed payments; refunds ≤ 7 days self-serve via a button. Price displayed with billing frequency stated twice (StudyFetch's "$8/mo (billed $96 yearly)" pattern, kept honest). Usage meters visible in Settings → no surprise walls.

## 10. Pricing (launch hypothesis — A/B via PostHog flags)

**Free:** 1 course, 3 material uploads, 50 cards, 2 quizzes, 20 tutor messages/mo — **all published on the pricing page and metered visibly in-app.**
**Plus:** $6.99/mo annual ($83.88/yr) or $12.99/mo monthly — unlimited courses/uploads/cards/quizzes/tutor, lecture recording, audio recaps, PDF export, priority processing. Undercuts StudyFetch mobile ($19.99) and Turbo monthly ($19.99); sits near Ask Maeve annual while offering far more. Student-verified .edu: 20% off. No weekly plan (predatory-pattern optics), no "50% off forever" gimmicks.

## 11. Non-functional requirements

Reliability: 99.9% uptime target; zero-data-loss design (durable object storage, DB backups, soft-delete everywhere; a lecture recording buffers locally until server-confirmed). Performance: dashboard TTI < 2s; upload → first visible artifact < 60s for a 50-page PDF; streaming everywhere AI responds. Privacy/compliance: GDPR + CCPA self-serve export/delete; COPPA stance = 16+ at launch; SOC 2 roadmap post-revenue; user content never used to train third-party models (state it plainly — trust marketing). Accessibility: WCAG 2.1 AA, `prefers-reduced-motion` respected (see design system).

## 12. Milestones

**M0 (weeks 1–2):** design system implemented, landing page + waitlist live, Ollie v1 illustrated.
**M1 (weeks 3–8):** P0 build — ingestion, notes, cards, quizzes, tutor, plan, onboarding, Stripe, PostHog. Private beta with ~50 students (UMich network is the obvious beta pool).
**M2 (weeks 9–12):** exam-realism practice tests, polish pass, public launch + TikTok creator program (paid UGC works in this market — but never scripted "it's free" overclaims; that manufactured every competitor's 1★ backlash).
**M3 (months 4–6):** P1 (lecture recording, recaps, glossary, focus, sharing), pricing experiments, retention tuning.

## 13. Key risks

OpenAI cost per heavy user (mitigate: model tiering, caching, per-plan metering) · TikTok CAC volatility (mitigate: SEO comparison pages + share loops — both validated by competitors) · feature-breadth trap (mitigate: the §6 cut list; every P2 needs evidence before build) · incumbent copies "trust" messaging (mitigate: they can't easily — their revenue depends on the dark patterns; our whole funnel is the proof).
