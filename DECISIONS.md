# DECISIONS.md — unspecified choices, one line each

- Package manager: npm (repo had no lockfile; npm ships with Node, zero setup).
- Scaffold: manual (not create-next-app) because repo already contained CLAUDE.md/.claude which the CLI refuses; same resulting layout.
- No `.env.local` present at build time → ALL external keys missing; per rule 4 every integration is fully built and only the outermost call is stubbed behind `// TODO(key-needed)` guards (see BUILD_REPORT.md for the list).
- Tailwind v4 tokens: mapped docs/03 §9 CSS vars into `@theme` as `--color-*`/`--radius-*`/`--shadow-*` names so Tailwind utilities (`bg-primary`, `rounded-card`, `shadow-xs`) resolve to spec values.
- Inter loaded via next/font/google with `--font-inter` variable (spec: Inter variable via next/font); JetBrains Mono left as CSS stack fallback (no code-heavy surfaces at launch).
- Typography scale exposed as `.text-h1`-style utility classes in globals.css (docs/03 §2 sizes) rather than Tailwind font-size theme to keep line-height/weight/tracking bundled per spec row.
- Migration split: 0001 is docs/04 §4 verbatim (templates expanded per listed tables); 0002 adds columns screens require but 0001 lacks: profiles.marketing_emails (privacy toggle, 05 §8) and study_plan_items.moved_from ("moved from {day}" note, 05 §7.7 — no column existed for the annotation).
- Doc conflict flagged: 04 §4 says course soft-delete stamps deleted_at on "plan items"/sections/questions, but those tables have no deleted_at column in the schema — children are gated by their parent row instead (comment in lib/trash.ts).
- Soft-delete cascade implemented server-side (admin client) since several child tables are Class B (client can't write them); cascade group = matching timestamp, per 04 §4 restore semantics.
- Realtime private-channel auth implemented as an RLS policy on realtime.messages topics 'job:{materialId|courseId}' (Supabase broadcast-authorization pattern; 04 §8 names the requirement, not the mechanism).
- New-course entry point outside onboarding: dashed dashboard card opens a small name+exam-date modal, then routes to the course's Materials tab with the upload modal open (no dedicated screen specced).
- Course emoji auto-suggest returns 📚 whenever OPENAI_API_KEY is absent or the model reply isn't a bare emoji.
- Uploads metric: every material kind except 'topic' counts toward the 3 free uploads (topic is the "I have nothing yet" escape hatch, not an upload; pasted/YouTube/Quizlet consume real ingestion work so they count).
- Course tab bar mixes views and routes to match doc 04's repo layout: Overview/Notes/Quizzes/Materials are ?tab= views on course home; Flashcards/Tutor/Plan navigate to their own routes (cards/, chat/, plan/).
- Image-only PDFs: doc 04 §9 lists 'ocr_needed→auto-ran' but v1 ships no PDF rasterizer (per-page vision OCR would need one); such PDFs fail honestly as extract_empty with the doc's recovery copy. Standalone image uploads DO run vision OCR.
- Upload progress: real XHR progress for the file transfer (0–40%), then real job-stage broadcasts (extract/chunk/embed) — no fake timers (docs/04 §8).
