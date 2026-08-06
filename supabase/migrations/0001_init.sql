-- Migration 0001 — complete schema per docs/04_Architecture_and_Data.md §4 (normative, verbatim).
-- Conventions: uuid PKs (gen_random_uuid()), created_at/updated_at timestamptz default now(),
-- soft delete via deleted_at timestamptz (NULL = live). RLS ON everywhere; jobs use service role.

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
create trigger set_updated_at before update on profiles for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on courses for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on materials for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on notes for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on flashcards for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on quizzes for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on chat_threads for each row execute procedure moddatetime(updated_at);
create trigger set_updated_at before update on subscriptions for each row execute procedure moddatetime(updated_at);

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
-- full quiz_questions reads go through a server action that checks the attempt is completed
-- (kind='exam' only; kind='quiz' reveals per-question immediately).

-- ============================================================================
-- RLS — two classes (docs/04 §4): Class A user-editable, Class B server-written only.
-- ============================================================================

-- Class A: user-editable
alter table courses enable row level security;
create policy "own all" on courses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table materials enable row level security;
create policy "own all" on materials for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table notes enable row level security;
create policy "own all" on notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table flashcards enable row level security;
create policy "own all" on flashcards for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table chat_threads enable row level security;
create policy "own all" on chat_threads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table study_plan_items enable row level security;
create policy "own all" on study_plan_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table quiz_attempts enable row level security;
create policy "own all" on quiz_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table attempt_answers enable row level security;
create policy "own all" on attempt_answers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table card_reviews enable row level security;
create policy "own all" on card_reviews for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table chat_messages enable row level security;
create policy "own all" on chat_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table share_links enable row level security;
create policy "own all" on share_links for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Class B: server-written only (no insert/update/delete policies → service role only)
alter table subscriptions enable row level security;
create policy "own read" on subscriptions for select using (user_id = auth.uid());

alter table usage_counters enable row level security;
create policy "own read" on usage_counters for select using (user_id = auth.uid());

alter table chunks enable row level security;
create policy "own read" on chunks for select using (user_id = auth.uid());

alter table note_sections enable row level security;
create policy "own read" on note_sections for select using (user_id = auth.uid());

alter table quizzes enable row level security;
create policy "own read" on quizzes for select using (user_id = auth.uid());

alter table quiz_questions enable row level security;
create policy "own read" on quiz_questions for select using (user_id = auth.uid());

-- stripe_events: RLS on, no policies at all (service-role only).
alter table stripe_events enable row level security;

-- profiles: select/update own row; column grants prevent clients touching
-- is_edu / deletion_requested_at / email (server-managed).
alter table profiles enable row level security;
create policy "own read" on profiles for select using (id = auth.uid());
create policy "own update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (display_name, avatar_url, study_level, user_type, referral_source, onboarding_completed_at)
  on profiles to authenticated;

-- ============================================================================
-- Storage: bucket 'materials', path userId/materialId/original.<ext>, private,
-- owner-prefix RLS for select/insert; delete via service role only (trash flow).
-- ============================================================================
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
  on conflict (id) do nothing;

create policy "own prefix select" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own prefix insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
-- no delete/update policies: real deletion only through the trash flow (service role).

-- ============================================================================
-- Realtime: private channels 'job:{id}' — receive only broadcasts for resources
-- the user owns (docs/04 §8). Jobs broadcast via service role.
-- ============================================================================
create policy "receive job broadcasts for owned resources"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    exists (select 1 from public.materials m
            where 'job:' || m.id::text = realtime.topic() and m.user_id = auth.uid())
    or exists (select 1 from public.courses c
               where 'job:' || c.id::text = realtime.topic() and c.user_id = auth.uid())
  )
);
