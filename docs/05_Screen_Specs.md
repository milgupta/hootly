# 05 — Screen-by-Screen Specs (build-ready)
**Hootly · v1.0.** Every route, its layout, states, interactions, and exact copy. Components/tokens per `03_Design_System.md`; data per doc 04. Copy in quotes is final v1 copy — use verbatim. Every screen must ship its loading (skeleton), empty (Ollie + one action), and error (message + recovery) states — no exceptions.

## Global shell (authed routes)

Fixed left sidebar 260px, `bg-subtle`, 1px border-right: Ollie mark + "hootly" wordmark (→ /home) · nav: Home, My Courses (expandable list of live courses, active = `primary-soft` pill), Trash · bottom: usage meter card (free plan only: "Free plan — 2/3 uploads used" + thin purple meter + ghost button "See plans"), settings gear + avatar. Top bar (content area): breadcrumb, right side: streak flame + count (once streaks exist, P1 — hide until then), "Feedback" ghost button, avatar menu (Settings, Billing, Sign out). Mobile (<768px): sidebar becomes bottom tab bar (Home, Courses, Add, Settings); "Add" opens the upload sheet.

Global components: Toasts bottom-center; command palette deferred (P1); paywall modal (see §9) can open over any screen.

---

## 1. `/` Landing (marketing)

Purpose: TikTok-arrival conversion. White page, hero glow gradient (DS §1).
- Nav: wordmark · "Pricing" · "Log in" (ghost) · "Start free" (primary). Sticky, blurs on scroll.
- Hero: H-display "Turn tonight's panic into tomorrow's A." · sub "Upload your slides, notes, or lectures. Hootly builds your notes, flashcards, quizzes, and a tutor that cites its sources — in about a minute." · primary CTA "Start studying free" + micro under it: "Free plan · No credit card · Cancel anytime in two clicks" · right: Ollie animated (idle blink) atop a stylized course-card mock.
- Social strip: **omit at launch** (no fake logos — brand rule). Reserve the slot; add real university/press mentions only when true.
- 3-step band (cards): "1. Drop your files" / "2. Watch Ollie build your study set" / "3. Study what actually matters" — each with small illustration.
- Feature tabs (like StudyFetch's but 4 not 6): Notes · Flashcards · Practice exams · Tutor. Crossfade 200ms, no text overlap (their bug).
- **Trust band (our differentiator, `primary-soft` background):** H2 "The honest study app." Three columns: "Real free plan — limits published right on the pricing page." / "Cancel in two clicks — Stripe portal, no email maze, no dark patterns." / "AI that cites its sources — every note and answer links to your actual materials." 
- Pricing teaser: two plan cards (mirror /pricing) + link "See full pricing →".
- FAQ accordion (6 items, +/− icons consistent — StudyFetch mixes icons). Final copy:
  1. "Is Hootly actually free?" → "Yes — the free plan is real and its limits are printed on the pricing page: 1 active course, 3 uploads, 50 AI flashcards, 2 AI quizzes, 20 tutor messages a month. You'll never hit a wall we didn't tell you about."
  2. "Is my data used to train AI?" → "No. Never. Your notes are yours."
  3. "How is this different from ChatGPT?" → "Hootly answers from *your* course materials and shows you exactly where every answer came from — page numbers and all. ChatGPT guesses; Ollie cites."
  4. "Will this do my homework for me?" → "No — and that's on purpose. Ollie teaches, quizzes, and explains, but won't write work you'd submit as your own."
  5. "How do I cancel?" → "Settings → Billing → Manage billing → Cancel. Two clicks, no phone calls, no guilt trips. Refunds within 7 days are self-serve too."
  6. "What can I upload?" → "PDFs, PowerPoints, Word docs, photos of handwritten notes, audio and video recordings, YouTube links with captions, pasted notes, and Quizlet exports."
- Footer: minimal — product, pricing, legal, contact, socials. **No SEO link dump, no duplicates.**

## 2. `/pricing`

H1 "Simple, honest pricing." Toggle Monthly/Annual (annual default, badge "Save 46%" — $83.88/yr vs $155.88 at monthly rate; the math is shown on hover). Two cards: **Free** — "$0 · 1 active course · 3 file uploads · 50 AI flashcards · 2 AI quizzes · 20 tutor messages/mo · audio up to 30 min" CTA "Start free". (Semantics per doc 04 §5: course slot frees on delete; generation counters are lifetime; manual cards free.) **Plus** (purple border, "Most popular") — "$6.99/mo billed annually ($83.88/yr)" or "$12.99/mo monthly", "Everything unlimited, lecture recording, audio recaps, PDF export, priority processing" CTA "Get Plus". Under cards: "Students with a .edu email get 20% off automatically." + "Cancel anytime in two clicks. 7-day full refund, self-serve, no questions." Comparison table below (every feature × plan — the published-limits table IS the marketing). FAQ: billing questions incl. "How do I cancel?" answered with the actual 2 steps.

## 3. `/signup` and `/login`

Split screen. Left (white): Ollie mark, H2 "Create your account" / sub "Your all-nighters just got shorter." · "Continue with Google" (secondary, Google icon) · divider "or" · email field + "Send magic link" (primary) · info row (if email ends .edu): "🎓 .edu detected — your 20% student discount will apply automatically." · legal line. Right panel: white with the standard hero-glow gradient (DS §1 gradient #1), storybook Ollie in a library, and the trust row ("✓ Real free plan ✓ Cancel in 2 clicks ✓ AI that cites sources") — **no testimonials anywhere until we have real ones** (brand rule 00 §8). Login mirrors ("Welcome back. Ollie kept your seat warm."). Magic-link sent state: "Check your email — link sent to {email}. It expires in 15 minutes." + "Resend" (disabled 30s with countdown).

## 4. `/onboarding` (steps via `?step=`, PostHog event per step)

Shell: white bg + hero glow; **progress dots top-center ("Step {n} of 5") over the five interactive steps (who, level, course, materials, calibrate) — the building screen (4.6) shows no dots** (it's a payoff, not a step; the PostHog enum still logs it as `building`); "← Back" top-left (except step 1); skips top-right where noted. All option cards: DS selected state; keyboard navigable; auto-advance 250ms after single-select.

- **4.1 `who`** — pixel Ollie waves. H2 "Who's studying?" Cards: Student / Teacher / Professional. (writes `profiles.user_type`)
- **4.2 `level`** — H2 "What are you studying for?" Rows w/ sublabels: College — "Intro courses, majors, finals" · Grad school — "Master's, PhD, quals" · High school — "AP, IB, honors, regular" · Med school — "Pre-clinical, Step 1 & 2, rotations" · Professional certs — "NCLEX, Bar, CPA, PMP, AWS" · Standardized tests — "SAT, ACT, MCAT, GRE, LSAT" · Other. Rows stagger-fade in (40ms apart, 200ms each).
- **4.3 `course`** — H2 "Let's set up your first course." Name input (placeholder "e.g. BIO 172 — Human Physiology") + optional exam date picker ("When's the exam? (optional)") + emoji auto-suggested. CTA "Next".
- **4.4 `materials`** — H2 "Feed Ollie your materials." Dropzone card: "Drop lectures, notes, slides, photos, or recordings — PDF, PPTX, DOCX, TXT, images, audio, video" + "Browse files". Chips: "Import from Quizlet" · "Paste notes" · "Photo of handwritten notes" · "YouTube link". Divider "or" → secondary "💡 Just give me a topic" (opens preset modal: AP Biology, US History, Algebra II, Chemistry, World Literature, Physics + "Type my own"). Escape top-right: "I don't have materials yet →" (creates the course with a `topic` material and runs **topic mode**, doc 06 §1.1 — artifacts carry the "📖 From general knowledge" badge until real materials are added). Upload list rows: filename, size, per-file progress bar, status ("Reading page 14 of 60…"), error rows use doc 04 §9 copy with "Retry"/"Remove". Free meter in footer: "Uploads: {n} of 3 free". CTA "Build my study set" (disabled until ≥1 ready or topic chosen).
- **4.5 `calibrate`** — H2 "How well do you know this already?" Cards: "New to this — I'm starting fresh" / "Some background — I know the basics" / "Know it well — I want to go deeper". (writes `courses.familiarity`)
- **4.6 `building` — GENERATION THEATER.** H2 typewriters in: "Building your study set…" then swaps on completion to "Ready when you are." Driven by the `build-course` orchestrator (doc 04 §6: notes depth=standard + plan + 20 cards + 3-question warm-up quiz — cards/quiz exempt from free metering per 04 §5; the upload itself still counts toward the 3). Three cards build from real job events (doc 04 §8): **Topics** (rows appear + check, 150ms pop) → **Study plan** (numbered items typewriter ~25ms/char) → **Your toolkit** (tiles pop in: Notes, Flashcards, Quiz, Tutor). Card headers flip to "✓ Done" pills. Ollie "thinking" animation top; on completion: single wing-flap + sparkle. CTA appears: "Open my course →". If a job fails: card shows inline error + "Retry" — other cards unaffected. **Never a blank screen between steps** (StudyFetch bug).
- **4.7 First-value moment** — lands IN the course with a spotlight tour (3 tooltips max: plan, tools, tutor) and a pre-opened "Quick warm-up" card: 3-question mini-quiz from their material. On completing it: confetti-free success moment, "Nice. That's 3 questions down. Here's your plan for the week." **THEN** paywall modal (§9, skippable). After paywall dismiss/purchase → one-tap survey "Where'd you hear about us?" (Google / TikTok / Instagram / Friend / YouTube / Reddit / ChatGPT / Other) — skippable, one tap, writes `referral_source`.

## 5. `/home` Dashboard

Greeting: "Good {morning/afternoon/evening}, {first name}." + today line: "Exam in {n} days — today: {plan summary}" or "No exam dates yet." **One primary CTA: "Continue studying" → next incomplete plan item.** Below: Today's plan (≤3 items, checkboxes) · course cards grid (name, emoji, exam countdown badge — `warning-soft` when ≤7 days, progress ring of plan completion, "· {n} cards due") + dashed "New course" card (free plan at limit → card shows lock + "Plus" chip, opens paywall) · "Due for review: {n} cards across {courses}" banner → review session. Empty (no courses): Ollie + "It's quiet in here. Add your first course and Ollie gets to work." + primary "Add a course". Skeleton: 3 card ghosts.

## 6. `/courses/[id]` Course home

Header: emoji + name (inline-rename on click), exam chip ("Nov 12 · 41 days"), overflow menu (Rename / Archive / Delete — Delete is the ONLY red item). Tabs (URL-backed): **Overview · Notes · Flashcards · Quizzes · Tutor · Plan · Materials**.
- **Overview:** "Up next" card (single recommended action, purple left-accent) + mastery bar (Mastered/Reviewing/Learning counts from FSRS states) + tool grid (Notes/Cards/Quiz/Exam/Recap[P1]) each with count + "Generate" if empty + recent activity list.
- **Materials tab:** table (icon, title, kind, size/duration, status chip, added date) + "Add materials" (reuses 4.4 dropzone in a modal). Failed rows: red-text status + "Retry". Deleting a material warns: "Notes and cards made from it stay. New generations won't use it."
- Delete course modal (DS destructive spec): "Delete {name}? Everything inside — notes, {n} cards, {n} quizzes — moves to Trash for 30 days." Buttons: ghost "Cancel" / danger "Delete course". Toast: "Course moved to Trash — Undo".

## 7. Study surfaces

- **7.1 Notes `/notes/[noteId]`.** Reading column 68ch. Title, depth chip, "Regenerate section" on hover per section (sparkle icon), export PDF (Plus; free shows lock chip → paywall). Sections: H2/H3 + markdown + KaTeX. **Source chips** at each section end: "📄 {material} · p.{page}" / "🎧 {material} · {mm:ss}" → click opens right split-pane with the source (PDF page rendered / transcript scrolled to timestamp), chip's chunk highlighted `primary-soft`. Ungrounded content (groundedness fail, `grounded=false` AND `topic_mode=false`): amber left-border + tooltip "Ollie couldn't verify this against your materials." Topic-mode notes (`topic_mode=true`) instead show one neutral header badge: "📖 From general knowledge — add your class materials to make this course-specific." (never the amber treatment). Generating state: sections stream in with skeleton below; "Generating section 3 of 8…"
- **7.2 Flashcards `/cards` (manage).** Toolbar: search, filter (All/Learning/Reviewing/Mastered/Favorites), "New card" (manual), "Generate more" (opens: "Focus on… (optional)" custom-prompt input — e.g. 'definitions only', + count select 10/20/30). Card table rows: front preview, state dot (Learning `warning`, Reviewing `primary`, Mastered `success`), due date, ⭐, overflow (Edit/Suspend/Delete). Inline edit modal. Bulk select → bulk delete (single confirm).
- **7.3 Review `/review`.** Full-screen focus mode (sidebar hidden, Esc exits with confirm if mid-session). Progress "12 / 34" top. Card centered, 3D flip on Space/click (300ms). Rating bar after flip: "Again · Hard · Good · Easy" (keys 1–4) with next-due preview under each ("<10m · 2d · 4d · 8d") from ts-fsrs. Source chip on card back. Session end: summary card "34 reviewed · 29 on track · next session {date}" + Ollie wing-flap + "Back to course". Autosaves after EVERY rating (a closed tab loses nothing).
- **7.4 Quiz take `/quiz/[quizId]`.** One question per screen, progress bar. MCQ options = full-width cards (A–D keys). Submit → instant feedback state: correct = `success-soft` fill + "Correct"; wrong = chosen card `danger-soft`, **correct card outlined `success` and labeled "Correct answer"** (StudyFetch hides it — we never do) + explanation card with source chip + "Add to flashcards" ghost button (pre-checked toggle "auto-add misses"). End: score ring, per-topic breakdown, "Review misses" primary + "Retake" ghost.
- **7.5 Exam `/exam/[examId]`.** Same engine + timer chip (turns `warning` at 20% left, never red-flashes), question palette sidebar (answered/flagged — `attempt_answers.flagged`), "Flag for review", submit confirm ("3 unanswered — submit anyway?"). No per-question feedback until submitted (exam realism — enforced server-side: during an exam attempt the client only ever receives `quiz_questions_take` rows without answers; answers arrive from `completeAttempt`); results page mirrors quiz end + "{n} questions came from {material} — reread p.12–18" insight rows.
- **7.6 Tutor `/chat`.** Thread list left (within content area), chat right. Header toggle: "Socratic mode" switch + tooltip "Ollie guides you to the answer instead of giving it away." Composer placeholder: "Ask anything about {course}…". Streaming: Ollie head-tilt avatar; text fades in word-by-word. Assistant messages: markdown + KaTeX, **inline citation chips [1][2] → hover popover with source excerpt, click opens split-pane**; if `used_general_knowledge`: subtle banner atop message "⚠ Not found in your materials — answered from general knowledge." Guardrail refusal renders as normal friendly message (doc 06 §2 copy). Free meter above composer at ≤5 remaining: "{n} free messages left this month." Empty state: 3 suggested-question chips generated from course topics.
- **7.7 Plan `/plan`.** Week-grouped checklist (item = kind icon + title + linked artifact + due date). Overdue roll forward automatically with subtle "moved from Mon" note. "Rebuild plan" (after exam-date/material changes; confirm: keeps completed items). Completing all items in a week: Ollie sparkle + "Week {n} done. You're ahead of most of your class."

## 8. `/settings` (tabs)

- **Account:** avatar, name, email (read-only + "Contact support to change"), study level, **Danger zone** card (`danger-soft` bg): "Delete account — deletes everything after a 30-day grace period." → typed-confirm modal (type "DELETE") — the one typed-confirm in the app.
- **Billing:** current plan card ("Plus · $6.99/mo billed annually · renews Mar 3, 2027"), primary "Manage billing" → Stripe portal (cancel lives here — 2 clicks total, as advertised), "Refund" self-serve button visible ≤7 days post-charge ("Full refund, no questions. Ollie will miss you."), invoice list (from Stripe). Free plan: upgrade card.
- **Usage:** meters for all five metrics with plan limits + reset date for monthly ones. Plus: "Unlimited — go nuts." 
- **Privacy:** export ("Download everything — we'll email you a link to a zip of your notes, cards, and files. Usually takes a few minutes." → `requestExport`, async job) · marketing email toggle (default OFF) · link to policy · "We never train AI models on your content."

## 9. Paywall modal (single component, `context` prop: onboarding | limit:{metric} | feature:{name})

Two-panel modal (720px, r-modal): left storybook Ollie + three rotating **feature highlights** (not testimonials — none exist yet; swap in real quotes post-launch): "Unlimited uploads — your whole semester in one place." / "Unlimited flashcards, quizzes, and tutor messages." / "Every answer shows its source. No AI guessing." (Only shipped features may appear here — update when P1 features launch.) Right: context headline — onboarding: "Keep the momentum."; limit: "You've used your {n} free {metric}."; feature: "{Feature} is a Plus feature." · plan cards (Annual pre-selected, "Save 46%" badge, honest math shown: "$83.88 billed today") · feature ticks (4 max) · primary "Get Plus" → Stripe Checkout · **ghost "Maybe later" — always present, never shrunken/grayed** · trust row: "✓ Cancel in 2 clicks ✓ 7-day refund ✓ Limits never surprise you". PostHog: `paywall_viewed {context}`.

## 10. `/trash`

Table: item, type, course, deleted date, "days left" countdown chip (`warning` ≤7) + "Restore" per row + "Empty trash" (danger, double-confirm). Empty: "Nothing here. Deleted things wait 30 days before leaving for good."

## 11. System screens

**404:** Ollie looking under a rock. "This page flew off. — The page may have been moved or deleted." + "Go home". **500:** "Something broke on our end. Your data is safe — try refreshing." + "Refresh" + "Contact support". **Offline banner:** "You're offline. We'll sync when you're back." **Maintenance:** scheduled copy + status link.

## 11.5 `/legal/*` pages

Three pages, standard 68ch reading layout: `/legal/terms`, `/legal/privacy`, `/legal/refunds`. Content: generate from a reputable SaaS template (e.g. Termly-style structure), adapted to hard-code our six commitments verbatim — (1) published free-tier limits, (2) cancel anytime effective end of period, (3) 7-day full refund self-serve, (4) user content never used to train AI models, (5) 30-day recovery then permanent deletion, (6) GDPR/CCPA export + delete self-serve. Mark the pages "template — attorney review before launch" in a code comment; do not block the build on legal review.

## 12. Ollie asset spec (for SVG/Lottie production)

Geometry: circle body (1:1.15 w:h), two large circular eyes (~38% of face width, near-black `ink` pupils with white glint dot at 10 o'clock), small triangular `warning`-orange beak, cream body `#FFF9F2`, purple `primary` wing ovals + two purple brow feather tufts, stubby feet. Stroke: 2px `ink` outline, rounded joins. Variants: **Mark** (head only, works at 16px), **Idle** (blink: eyes to 10% height 120ms every 6–10s), **Thinking** (head tilts 8°, eyes look up-left, 3 dots above), **Success** (wing lifts, 2 four-point sparkles `primary`, 600ms one-shot), **Concerned** (brows angle in, for destructive modals), **Pixel** (16×16 grid version for onboarding), **Storybook** (illustrated scene versions for paywall/auth — cozy library, lamp light, books). Max in-app render 96px; one Ollie per screen.
