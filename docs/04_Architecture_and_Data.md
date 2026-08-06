# 04 — Architecture & Data Spec (build-ready)
**Hootly · v1.0 · Aug 2026.** This doc is normative: build exactly this unless a conflict with the PRD is found — then flag, don't improvise.

## 1. Stack (pinned decisions)

- **Next.js 15+ (App Router, TypeScript strict, RSC)** deployed on Vercel.
- **Tailwind CSS v4** with tokens from `03_Design_System.md` §9 mapped into `@theme`. No component library; build our own primitives in `components/ui/` (Radix primitives allowed for a11y: dialog, dropdown, tabs, tooltip, popover).
- **Supabase**: Postgres 15 + `pgvector`, Auth (Google OAuth + email magic link), Storage, Realtime (job progress). Access via `@supabase/ssr` server clients; service-role key only in server code/jobs.
- **Inngest** for background jobs (ingestion + generation). Free tier is fine for v1.
- **Stripe**: Checkout + Billing Portal + webhooks (spec in doc 07).
- **PostHog**: `posthog-js` (client) + `posthog-node` (server) (spec in doc 07).
- **OpenAI SDK** (`openai` npm). Model names come from env, never hardcoded (defaults in doc 06).
- Validation: **zod** everywhere (forms, API inputs, AI outputs). FSRS: **`ts-fsrs`** package. Streaming chat: **Vercel AI SDK (`ai` package)** — a pinned dependency, not just a pattern. PDF export: **`@react-pdf/renderer`** (server route). Transcode/chunk audio: **`ffmpeg-static`** in Inngest steps. YouTube: **`youtubei.js`** captions only (no audio download in v1). Quizlet import: paste-based parser (tab/comma `term<TAB>definition` lines — Quizlet's own export format). Icons: **lucide-react**. Fonts: Inter variable via `next/font`. LaTeX: `katex`. Markdown render: `react-markdown` + `remark-gfm` + sanitization. Errors: **Sentry**.
- Testing: Vitest (unit: limits, FSRS wrapper, zod schemas, webhook handlers) + Playwright (smoke: signup→onboard→generate→review→paywall→cancel).

## 2. Repo layout

```
/app
  /(marketing)/            # /, /pricing, /legal/*
  /(auth)/login, signup    # auth screens
  /onboarding              # ?step= driven
  /(app)/                  # authed shell: sidebar layout
    home/
    courses/[courseId]/
      page.tsx             # course home
      notes/[noteId]/
      cards/               # manage
      review/              # SRS session
      quiz/[quizId]/
      exam/[examId]/
      chat/
      plan/
    settings/              # ?tab=account|billing|usage|privacy
    trash/
  /api/
    webhooks/stripe/route.ts
    inngest/route.ts
    checkout/route.ts
    portal/route.ts
    refund/route.ts
    chat/route.ts          # streaming tutor
    pdf/note/[noteId]/route.ts
  /s/[slug]/               # public share page (admin-client fetch)
/components/ui/            # Button, Card, Input, Modal, Toast, Meter, Skeleton, Tabs, EmptyState, ProgressBar, SourceChip
/components/ollie/         # OllieMark, OllieAnimated (blink/think/success), OlliePixel, OllieStory
/lib/
  supabase/ (server.ts, client.ts, admin.ts)
  ai/ (openai.ts, prompts/, schemas/, rag.ts, guardrails.ts, groundedness.ts)
  billing/ (stripe.ts, plans.ts, limits.ts)
  analytics/ (posthog.ts, events.ts)   # typed event helpers — ALL capture goes through events.ts
  fsrs.ts
/inngest/ (client.ts, functions/: ingest-material.ts, build-course.ts, generate-notes.ts, generate-cards.ts, generate-quiz.ts, generate-exam.ts, generate-plan.ts, export-account.ts, roll-plan-forward.ts, purge-trash.ts)
/supabase/migrations/
/tests/
```

## 3. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL_TUTOR=gpt-4.1        # substitute current best general model
OPENAI_MODEL_BULK=gpt-4.1-mini    # cards/quiz/glossary bulk generation
OPENAI_MODEL_CHECK=gpt-4.1-mini   # groundedness + classifier
OPENAI_MODEL_EMBED=text-embedding-3-small
OPENAI_MODEL_TRANSCRIBE=whisper-1
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
SENTRY_DSN
AI_DAILY_TOKEN_CEILING_FREE=500000 / AI_DAILY_TOKEN_CEILING_PLUS=3000000
```
Note: image OCR uses `OPENAI_MODEL_TUTOR` (vision-capable) — no separate OCR model var.

## 4. Database schema (complete SQL — migration 0001)

Conventions: `uuid` PKs (`gen_random_uuid()`), `created_at/updated_at timestamptz default now()`, soft delete via `deleted_at timestamptz` (NULL = live). All user tables have RLS ON with owner policies; jobs use service role.

```sql
create extension if not exists vector;

-- profiles (mirrors auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  study_level text check (study_level in ('college','grad','high_school','med','professional_cert','standardized_test','other')),
  user_type text check (user_type in ('student','teacher','professional')),
  is_edu boolean default false,                     -- email ends with .edu
  referral_source text,                             -- how_did_you_hear, nullable
  onboarding_completed_at timestamptz,
  deletion_requested_at timestamptz,                -- account deletion grace period (30 days)
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  emoji text default '📚',
  exam_date date,
  familiarity text check (familiarity in ('new','some','well')) default 'new',
  archived_at timestamptz, deleted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('pdf','pptx','docx','txt','image','audio','video','youtube','pasted','topic','quizlet')),
  title text not null,
  storage_path text,                                -- null for youtube/pasted/topic
  source_url text,                                  -- youtube
  byte_size bigint,
  raw_text text,                                    -- pasted/quizlet source text (also feeds split-pane source viewer)
  page_count int, duration_seconds int,
  status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
  error_code text,                                  -- machine-readable, e.g. 'ocr_needed','file_too_large','yt_unavailable'
  error_detail text,                                -- human sentence shown in UI
  deleted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  idx int not null,                                 -- order within material
  content text not null,
  page int, start_seconds int, end_seconds int,     -- source locator (page OR timestamps)
  embedding vector(1536),
  token_count int
);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_course_idx on chunks (course_id);

create table notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  depth text not null check (depth in ('quick','standard','comprehensive')),
  topic_mode boolean default false,                 -- generated from general knowledge (no chunks)
  status text not null default 'queued' check (status in ('queued','generating','ready','failed')),
  deleted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table note_sections (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  idx int not null,
  heading text not null,
  body_md text not null,                            -- markdown + KaTeX
  source_chunk_ids uuid[] not null default '{}',
  grounded boolean default true                     -- false = failed groundedness, shown with badge
);

create table flashcards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'basic' check (kind in ('basic','reversed','cloze')),
  front text not null, back text not null,
  source_chunk_ids uuid[] default '{}',
  favorited boolean default false,
  suspended boolean default false,
  -- ts-fsrs state (full Card round-trip: ts-fsrs@5.x requires elapsed/scheduled/learning_steps too)
  fsrs_due timestamptz default now(), fsrs_stability real, fsrs_difficulty real,
  fsrs_elapsed_days int default 0, fsrs_scheduled_days int default 0, fsrs_learning_steps int default 0,
  fsrs_reps int default 0, fsrs_lapses int default 0, fsrs_state smallint default 0,
  fsrs_last_review timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index flashcards_due_idx on flashcards (user_id, course_id, fsrs_due) where deleted_at is null and suspended = false;
-- UI state mapping (normative): Learning = fsrs_state in (0 New, 1 Learning, 3 Relearning);
-- Reviewing = fsrs_state 2 with fsrs_scheduled_days < 21; Mastered = fsrs_state 2 with fsrs_scheduled_days >= 21.

create table card_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references flashcards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),  -- Again/Hard/Good/Easy
  reviewed_at timestamptz default now(),
  elapsed_ms int
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'quiz' check (kind in ('quiz','exam')),
  title text not null,
  topic text,
  topic_mode boolean default false,                 -- generated from general knowledge (no chunks)
  time_limit_seconds int,                           -- exams only
  status text not null default 'queued' check (status in ('queued','generating','ready','failed')),
  deleted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  idx int not null,
  qtype text not null check (qtype in ('mcq','true_false','fill_blank','short_answer')),
  topic text,                                       -- powers per-topic results + tutor miss context
  prompt text not null,
  options jsonb,                                    -- mcq: ["A...","B..."]; tf: null
  answer text not null,                             -- canonical correct answer (always shown after attempt)
  explanation text not null,
  source_chunk_ids uuid[] not null default '{}',
  difficulty smallint check (difficulty between 1 and 3)
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz default now(), completed_at timestamptz,
  auto_add_misses boolean default true,
  score_pct real
);

create table attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  answer text, is_correct boolean,
  flagged boolean default false,                    -- exam "flag for review"
  answered_at timestamptz default now()
);

create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'New chat',
  socratic boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content_md text not null,
  citations jsonb default '[]',                     -- [{chunk_id, material_title, page, start_seconds}]
  used_general_knowledge boolean default false,
  created_at timestamptz default now()
);

create table study_plan_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  idx int not null,
  title text not null,
  kind text not null check (kind in ('review_cards','take_quiz','read_note','take_exam','custom')),
  topic text,                                       -- AI emits topic; target resolved lazily
  target_id uuid,                                   -- resolution rule: filled when a matching artifact exists or is generated on first click ("Continue studying" generates it if missing, respecting limits)
  due_date date,
  completed_at timestamptz
);

create table subscriptions (
  user_id uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan text not null default 'free' check (plan in ('free','plus')),
  interval text check (interval in ('month','year')),
  status text default 'active',                     -- mirrors Stripe status
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  updated_at timestamptz default now()
);

create table usage_counters (
  user_id uuid not null references profiles(id) on delete cascade,
  metric text not null check (metric in ('courses','uploads','cards_generated','quizzes_generated','tutor_messages')),
  period_start date not null,                       -- month bucket for tutor_messages; '1970-01-01' for lifetime metrics
  count int not null default 0,
  primary key (user_id, metric, period_start)
);

create table share_links (          -- P1, table now to avoid migration churn
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('note','cards')),  -- 'cards' = the course's flashcard deck, read-only
  resource_id uuid not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table stripe_events (                        -- webhook idempotency
  id text primary key,
  received_at timestamptz default now()
);

-- updated_at maintenance
create extension if not exists moddatetime;
-- for each table with updated_at:
--   create trigger set_updated_at before update on <T> for each row execute procedure moddatetime(updated_at);

-- signup trigger: profile + free subscription rows
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, is_edu)
  values (new.id, new.email, new.email ~* '\.edu$');
  insert into subscriptions (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();

-- vector retrieval RPC (called by lib/ai/rag.ts with service role)
create or replace function match_chunks(p_course_id uuid, p_query vector(1536), p_top_k int default 12, p_floor real default 0.25)
returns table (id uuid, material_id uuid, content text, page int, start_seconds int, end_seconds int, similarity real)
language sql stable as $$
  select c.id, c.material_id, c.content, c.page, c.start_seconds, c.end_seconds,
         1 - (c.embedding <=> p_query) as similarity
  from chunks c
  where c.course_id = p_course_id and 1 - (c.embedding <=> p_query) >= p_floor
  order by c.embedding <=> p_query limit p_top_k
$$;

-- exam integrity: clients query this view during an attempt; answer/explanation only after completion
create view quiz_questions_take with (security_invoker = true) as
  select q.id, q.quiz_id, q.user_id, q.idx, q.qtype, q.topic, q.prompt, q.options, q.difficulty
  from quiz_questions q;
-- full quiz_questions reads go through a server action that checks the attempt is completed (kind='exam' only; kind='quiz' reveals per-question immediately).
```

**RLS — two classes of tables (C-critical: billing/limits/AI-output tables must NOT be client-writable):**
```sql
-- Class A: user-editable (courses, materials, notes, flashcards, chat_threads, study_plan_items,
--          quiz_attempts, attempt_answers, card_reviews, chat_messages, share_links):
alter table <T> enable row level security;
create policy "own all" on <T> for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Class B: server-written only (subscriptions, usage_counters, chunks, note_sections,
--          quiz_questions, quizzes.status transitions, stripe_events):
alter table <T> enable row level security;
create policy "own read" on <T> for select using (user_id = auth.uid());
-- no insert/update/delete policies → only service-role (jobs, webhooks, server actions using admin client) can write.
-- stripe_events: no policies at all (service-role only).
-- profiles: select/update own row using (id = auth.uid()), but a column grant prevents clients updating is_edu/deletion_requested_at.
```
**Storage RLS (`materials` bucket):** owner-prefix policy — `(bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)` for select/insert; delete via service role only (trash flow controls real deletion).
**Soft-delete semantics (cascade + restore):** soft-deleting a course stamps `deleted_at` on the course AND all children (materials, notes+sections, flashcards, quizzes+questions, threads, plan items) in one transaction with the SAME timestamp. Trash lists top-level items only (a deleted course shows as one row; individually deleted children show as their own rows). Restoring an item restores it and its children with the matching timestamp; restoring a child whose parent course is deleted restores the parent course too (children keep their own earlier `deleted_at` if separately deleted). Normal queries always filter `deleted_at is null`. Nightly `purge-trash` cron hard-deletes rows (and storage objects) past 30 days. "Empty trash" = server action that hard-deletes the user's trashed rows now (double-confirm in UI).

**Account deletion:** `deleteAccount` action (typed-confirm) sets `profiles.deletion_requested_at`, cancels any Stripe sub immediately, signs the user out; login during grace shows a restore banner ("Your account is scheduled for deletion on {date} — Restore?"). A daily cron purges accounts past 30 days (delete `auth.users` row → cascades everything; then storage prefix).

**Storage:** bucket `materials`, path `userId/materialId/original.<ext>`; private; signed URLs (60 min) for viewing. 

## 5. Plan limits (single source of truth: `lib/billing/limits.ts`)

```ts
export const LIMITS = {
  free: { courses: 1, uploads: 3, cards_generated: 50, quizzes_generated: 2, tutor_messages: { limit: 20, per: 'month' } },
  plus: { courses: Infinity, uploads: Infinity, cards_generated: Infinity, quizzes_generated: Infinity, tutor_messages: { limit: Infinity, per: 'month' } },
} as const;
```
**Per-metric semantics (normative — encode in `limits.ts` and pricing copy):**
- `courses` = **live count** (non-deleted, non-archived). Deleting your course frees the slot. Pricing copy: "1 active course".
- `uploads`, `cards_generated`, `quizzes_generated` = **lifetime counters**, incremented on successful generation/ingestion, **never decremented** (deleting artifacts doesn't refill quota — prevents farming). Manually created cards do NOT count (only AI generation costs quota); Quizlet-imported cards DO count (they're bulk value). Pricing copy: "3 file uploads · 50 AI-generated flashcards · 2 AI quizzes".
- `tutor_messages` = monthly bucket (`period_start` = first of month), resets monthly; key in `limits.ts` is `tutor_messages` (matching the metric name) with a `per: 'month'` attribute.
- The onboarding warm-up quiz (3 questions) and the onboarding study-set build are **exempt** from `quizzes_generated`/`cards_generated` metering up to defaults (the free limits start counting AFTER first-value — trust rule; implement via a `metered:false` flag on onboarding-triggered jobs; onboarding upload DOES count toward the 3).
- Free audio/video uploads capped at 30 minutes duration (`audio_too_long` error, published on /pricing).

Enforcement is server-side (admin client) before job enqueue; the client shows meters (design system §4) sourced from `usage_counters` + live course count. **Rule: the UI must show remaining quota on the button/surface BEFORE the user acts** (e.g. upload modal footer: "2 of 3 free uploads left"). Hitting a limit opens the paywall modal with the specific meter highlighted — never a dead error.

## 6. Background jobs (Inngest functions)

| Function | Trigger event | Steps (each an Inngest step for retry/resume) | Emits progress |
|---|---|---|---|
| `ingest-material` | `material/uploaded` | 1 download 2 extract text by kind: pdf-parse / mammoth (docx) / pptx via jszip+xml / vision OCR for images (TUTOR model) / audio+video: ffmpeg-static → 64kbps mono m4a → split ≤20-min segments (whisper's 25MB API cap) → whisper each → stitch with timestamps / youtube: captions via youtubei.js ONLY (no captions → `yt_no_captions` hard error in v1, copy: "This video has no captions — download the audio and upload it instead.") / pasted+quizlet: read `raw_text` 3 chunk (~800 tokens, 15% overlap, keep page/ts locators) 4 embed (batch 64) 5 insert chunks 6 status→ready. **Quizlet branch also**: parse `term<TAB>definition` lines → insert as flashcards directly (counts toward `cards_generated`). **`kind='topic'`**: no extraction — material row is a marker; generation runs in topic mode (doc 06 §1.1). | `materials.status`, chunk % via Realtime `job:{materialId}` |
| `build-course` (orchestrator) | `course/build` (onboarding "Build my study set" + "Generate all" on empty course) | 1 wait for ingestion of the course's queued materials 2 fan out: `generate-notes` (depth=standard) → on outline done, emit theater stage `topics` (one event per section heading) 3 `generate-plan` → emit `plan_item` per item 4 `generate-cards` (count=20) + warm-up `generate-quiz` (n=3, metered:false) → emit `tool` events (Notes/Cards/Quiz/Tutor tiles) 5 emit `{done:true}` | all theater stages on `job:{courseId}` |
| `generate-notes` | `notes/requested` | outline → sections (parallel, BULK model) → groundedness pass → insert sections → status→ready | section-by-section |
| `generate-cards` | `cards/requested` | per-topic batches → zod validate → dedupe (cosine > 0.95 on front text) → insert | count so far |
| `generate-quiz` | `quiz/requested` | questions (BULK, default n=10) → answer-key verification (CHECK, doc 06 §6) → insert | – |
| `generate-exam` | `exam/requested` | same (TUTOR, default n=40, `time_limit_seconds = n*90` unless syllabus states otherwise) + format inference from syllabus/past-exam chunks | – |
| `generate-plan` | `plan/requested` | topics + exam_date + familiarity → plan items | – |
| `export-account` | `account/export` | gather user JSON + files → zip to storage → email signed link (Resend) | – |
| `roll-plan-forward` | cron `0 7 * * *` | move overdue incomplete plan items to today, annotate "moved from {day}" | – |
| `purge-trash` | cron `0 6 * * *` | hard-delete >30-day soft-deleted rows + storage; purge accounts with `deletion_requested_at` past 30 days | – |

Job failures set `status='failed'` + `error_code/error_detail` and MUST leave prior artifacts untouched (regeneration never deletes the old version until the new one is ready — data-durability rule).

## 7. Server actions / API surface

Server Actions (in `app/**/actions.ts`, all zod-validated, all check auth + limits + emit PostHog):
`createCourse, updateCourse, softDelete(resource — cascades per §4), restore(resource), emptyTrash, requestUpload(signedUrl flow), confirmUpload→emit material/uploaded, buildCourse→emit course/build, requestNotes/Cards/Quiz/Exam/Plan, regenerateNoteSection(sectionId), reviewCard(rating)→ts-fsrs schedule, createCard/updateCard/suspendCard, startQuizAttempt, submitAnswer(answer, flagged?), completeAttempt (exams: reveals answers), setAutoAddMisses(quizId, bool — persisted on quiz_attempts.auto_add_misses… add boolean column), sendTutorMessage (streams via `/api/chat`, Vercel AI SDK), updateProfile, setSocratic, createShareLink, requestExport→emit account/export, deleteAccount(typedConfirm)`.
Route handlers: `/api/checkout`, `/api/portal`, `/api/refund`, `/api/webhooks/stripe`, `/api/inngest`, `/api/chat` (streaming tutor), `/api/pdf/note/[noteId]` (Plus-gated, @react-pdf/renderer), `/s/[slug]` (public share page — server-rendered with admin client; `resource_kind: 'note' | 'cards'` where `cards` = the course's flashcard deck read-only; P1 but route reserved).
Mechanism notes: course emoji auto-suggest = tiny BULK-model call on course name (fallback 📚); tutor suggested-question chips = 3 questions generated from note headings at thread creation (cached on thread).

## 8. Realtime & generation theater contract

Client subscribes to `supabase.channel('job:'+id)` — **private channels** (Supabase Realtime authorization: channel name must embed a resource id the user owns; verify via RLS-checked query in the auth hook). The `build-course` orchestrator emits `{stage: 'topics'|'plan_item'|'tool', payload, done}`; the generation-theater screen renders each stage exactly as specced in doc 05 §4.6. **No fake timers anywhere** — animation is driven by real events; if a job outruns animation, events queue and play at ≤150ms intervals.

## 9. Error codes (canonical, used in UI copy)

`file_too_large` ("Max 100MB — this file is {size}.") · `unsupported_format` · `ocr_needed→auto-ran` (info, not error) · `yt_unavailable` ("This video is private or region-locked.") · `yt_no_captions` ("This video has no captions — download the audio and upload it instead.") · `audio_too_long` ("Free plan covers recordings up to 30 minutes — this one is {mm}:{ss}.") · `extract_empty` ("We couldn't find readable text. Try a clearer scan.") · `insufficient_material` ("Not enough material on this topic yet." — dialog offers two recovery actions: "Add materials" and "Generate from general knowledge instead" → re-runs the request in topic mode with the 📖 badge) · `ai_invalid_output` ("Generation hiccuped — retry.") · `ai_overloaded` ("Our AI is busy — retrying automatically.") · `limit_reached` (opens paywall) · `payment_failed`. Every error surface = message + one recovery action.
