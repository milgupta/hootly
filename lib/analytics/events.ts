/** PostHog event dictionary — docs/07 §2.2 IS CANONICAL. All capture flows
 *  through these types; no inline strings anywhere else. */

export interface EventProps {
  signup_completed: { method: "google" | "magic_link"; is_edu: boolean };
  onboarding_step_completed: {
    step: "who" | "level" | "course" | "materials" | "calibrate" | "building";
    seconds_on_step: number;
  };
  onboarding_finished: { had_materials: boolean; material_count: number };
  material_upload_started: { kind: string; bytes?: number };
  material_upload_succeeded: { kind: string; bytes?: number; seconds?: number; chunks?: number; cards?: number };
  material_upload_failed: { kind: string; bytes?: number; seconds?: number; error_code?: string };
  generation_requested: { artifact: Artifact; model?: string };
  generation_completed: {
    artifact: Artifact;
    model?: string;
    seconds?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  generation_failed: { artifact: Artifact; model?: string; seconds?: number; error_code?: string };
  first_artifact_generated: { artifact: Artifact };
  warmup_quiz_completed: { score: number };
  card_reviewed: { rating: number; course_id: string; session_length_so_far: number };
  review_session_completed: { cards: number; minutes: number };
  quiz_completed: { score_pct: number; n_questions: number; misses_added_to_cards: number };
  exam_completed: { score_pct: number; n_questions: number; misses_added_to_cards: number };
  tutor_message_sent: { grounded: boolean; socratic: boolean; latency_ms: number };
  ai_guardrail_triggered: { layer: "moderation" | "classifier" | "integrity"; decision: string };
  groundedness_flagged: { artifact: Artifact; pct: number };
  limit_meter_viewed: { metric: Metric };
  limit_hit: { metric: Metric };
  paywall_viewed: { context: string };
  paywall_dismissed: Record<string, never>;
  plan_selected: { interval: "month" | "year" };
  checkout_completed: { interval: "month" | "year"; revenue: number };
  cancel_completed: { days_subscribed: number };
  refund_selfserve: { days_since_charge: number };
  referral_source_answered: { source: string };
  error_shown: { error_code: string; screen: string };
  share_link_created: { resource_kind: "note" | "cards" };
  share_link_opened: { resource_kind: "note" | "cards" };
  auth_paint_measured: { ms: number };
  topic_mode_generated: { artifact: Artifact };
}

export type EventName = keyof EventProps;
export type Artifact = "notes" | "cards" | "quiz" | "exam" | "plan";
export type Metric = "courses" | "uploads" | "cards_generated" | "quizzes_generated" | "tutor_messages";
