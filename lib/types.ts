/** Row types mirroring supabase/migrations/0001 (docs/04 §4). */

export type StudyLevel =
  | "college"
  | "grad"
  | "high_school"
  | "med"
  | "professional_cert"
  | "standardized_test"
  | "other";

export type UserType = "student" | "teacher" | "professional";
export type Familiarity = "new" | "some" | "well";
export type MaterialKind =
  | "pdf"
  | "pptx"
  | "docx"
  | "txt"
  | "image"
  | "audio"
  | "video"
  | "youtube"
  | "pasted"
  | "topic"
  | "quizlet";
export type MaterialStatus = "queued" | "processing" | "ready" | "failed";
export type ArtifactStatus = "queued" | "generating" | "ready" | "failed";
export type NoteDepth = "quick" | "standard" | "comprehensive";
export type CardKind = "basic" | "reversed" | "cloze";
export type QuizKind = "quiz" | "exam";
export type QType = "mcq" | "true_false" | "fill_blank" | "short_answer";
export type PlanItemKind = "review_cards" | "take_quiz" | "read_note" | "take_exam" | "custom";
export type Plan = "free" | "plus";
export type UsageMetric =
  | "courses"
  | "uploads"
  | "cards_generated"
  | "quizzes_generated"
  | "tutor_messages";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  study_level: StudyLevel | null;
  user_type: UserType | null;
  is_edu: boolean;
  referral_source: string | null;
  onboarding_completed_at: string | null;
  deletion_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  exam_date: string | null;
  familiarity: Familiarity;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  course_id: string;
  user_id: string;
  kind: MaterialKind;
  title: string;
  storage_path: string | null;
  source_url: string | null;
  byte_size: number | null;
  raw_text: string | null;
  page_count: number | null;
  duration_seconds: number | null;
  status: MaterialStatus;
  error_code: string | null;
  error_detail: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  material_id: string;
  course_id: string;
  user_id: string;
  idx: number;
  content: string;
  page: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
  embedding: number[] | null;
  token_count: number | null;
}

export interface Note {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  depth: NoteDepth;
  topic_mode: boolean;
  status: ArtifactStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteSection {
  id: string;
  note_id: string;
  user_id: string;
  idx: number;
  heading: string;
  body_md: string;
  source_chunk_ids: string[];
  grounded: boolean;
}

export interface Flashcard {
  id: string;
  course_id: string;
  user_id: string;
  kind: CardKind;
  front: string;
  back: string;
  source_chunk_ids: string[];
  favorited: boolean;
  suspended: boolean;
  fsrs_due: string;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_learning_steps: number;
  fsrs_reps: number;
  fsrs_lapses: number;
  fsrs_state: number;
  fsrs_last_review: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardReview {
  id: string;
  card_id: string;
  user_id: string;
  rating: 1 | 2 | 3 | 4;
  reviewed_at: string;
  elapsed_ms: number | null;
}

export interface Quiz {
  id: string;
  course_id: string;
  user_id: string;
  kind: QuizKind;
  title: string;
  topic: string | null;
  topic_mode: boolean;
  time_limit_seconds: number | null;
  status: ArtifactStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  user_id: string;
  idx: number;
  qtype: QType;
  topic: string | null;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  source_chunk_ids: string[];
  difficulty: 1 | 2 | 3 | null;
}

/** Row shape from the quiz_questions_take view (no answer/explanation — exam integrity). */
export type QuizQuestionTake = Omit<QuizQuestion, "answer" | "explanation" | "source_chunk_ids">;

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  auto_add_misses: boolean;
  score_pct: number | null;
}

export interface AttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  user_id: string;
  answer: string | null;
  is_correct: boolean | null;
  flagged: boolean;
  answered_at: string;
}

export interface ChatThread {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  socratic: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  chunk_id: string;
  material_title: string;
  page: number | null;
  start_seconds: number | null;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content_md: string;
  citations: Citation[];
  used_general_knowledge: boolean;
  created_at: string;
}

export interface StudyPlanItem {
  id: string;
  course_id: string;
  user_id: string;
  idx: number;
  title: string;
  kind: PlanItemKind;
  topic: string | null;
  target_id: string | null;
  due_date: string | null;
  completed_at: string | null;
}

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  interval: "month" | "year" | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

export interface UsageCounter {
  user_id: string;
  metric: UsageMetric;
  period_start: string;
  count: number;
}

/** FSRS UI state mapping (docs/04 §4, normative). */
export type MasteryState = "learning" | "reviewing" | "mastered";
export function masteryState(card: Pick<Flashcard, "fsrs_state" | "fsrs_scheduled_days">): MasteryState {
  if (card.fsrs_state === 2) {
    return card.fsrs_scheduled_days >= 21 ? "mastered" : "reviewing";
  }
  return "learning";
}
