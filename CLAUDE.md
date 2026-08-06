# CLAUDE.md — Hootly build

This repo is built from the normative spec pack in `docs/`. If you are ever unsure what to do, the answer is in those docs — re-read before improvising.

- Build manual + milestone order + non-negotiable trust rules: `docs/00_BUILD_README.md`
- Doc priority on conflict: 04 (data) > 06 (AI) > 07 (integrations) > 05 (screens) > 03 (design) > 02 (PRD) > 01 (research)
- SQL (docs/04 §4), screen copy (docs/05), and AI prompts (docs/06) are used VERBATIM — never paraphrased.
- Every unspecified choice gets one line in `DECISIONS.md`. Never silently improvise; never stop to ask.
- Progress tracking: one git commit per milestone ("M{n}: …"). To find where the build left off: `git log --oneline`.
- Definition of Done: docs/00 — Playwright smoke, Vitest units, AI eval fixtures (`tests/ai/fixtures/`), strict-TS clean build, seed script, 18-point ship gate (docs/03 §8) passed on every screen.

Product one-liner for context: Hootly — an AI study platform (white/purple design, Ollie the owl mascot) that turns uploaded course materials into cited notes, FSRS flashcards, verified quizzes, and a grounded tutor; brand = honest billing, published limits, unlosable data.
