# 07 — Integrations Spec: Stripe, PostHog, Supabase Auth (build-ready)
**Hootly · v1.0**

## 1. Stripe

### 1.1 Catalog (create via script `scripts/stripe-setup.ts`, idempotent by lookup_key)
- Product **"Hootly Plus"**
  - Price `plus_monthly`: $12.99/mo, lookup_key `plus_monthly`
  - Price `plus_annual`: $83.88/yr, lookup_key `plus_annual`
- Coupon `edu20`: 20% forever, promotion code auto-applied server-side when `profiles.is_edu` (never typed by user).
- NO weekly plans, NO "forever discount" gimmick prices.

### 1.2 Checkout (`/api/checkout`, POST {interval})
`mode:'subscription'`, price by lookup_key, `customer` = existing or create (store `stripe_customer_id`). **Discount logic (mutually exclusive — Stripe rejects both together):** if `profiles.is_edu` → set `discounts: [{coupon: edu20}]`; else → `allow_promotion_codes: true`. `success_url: /home?upgraded=1` (triggers success toast + Ollie sparkle), `cancel_url: back to origin`, `subscription_data.metadata.user_id`, `billing_address_collection:'auto'`. **No trial period** — free tier is the trial (avoids every "trial charged me" complaint in the research).

### 1.3 Customer Portal (`/api/portal`)
Portal configuration (set once via script): cancellation **immediate at period end, no retention flow enabled** (the 2-click promise), plan switch monthly↔annual enabled with proration, invoice history on, payment method update on. Settings→Billing "Manage billing" button → portal session → return_url `/settings?tab=billing`.

### 1.4 Self-serve refund
Settings→Billing shows "Get a refund" button when `now() - latest paid invoice < 7 days`. POST `/api/refund` → full refund via API + subscription cancel now + plan→free + email confirmation + PostHog `refund_selfserve`. No human in the loop.

### 1.5 Webhooks (`/api/webhooks/stripe`, verify signature, idempotency table `stripe_events(id)` )
| Event | Action |
|---|---|
| `checkout.session.completed` | upsert `subscriptions` (plan=plus, ids, interval); PostHog `checkout_completed` |
| `customer.subscription.updated` | mirror status/`cancel_at_period_end`/period_end; if plan switch, update interval |
| `customer.subscription.deleted` | plan→free (limits re-apply next action, existing content NEVER locked or deleted — read stays free forever) |
| `invoice.payment_failed` | status→past_due; banner in app: "Payment failed — update your card. Everything keeps working for 7 days."; dunning handled by Stripe Smart Retries |
| `invoice.paid` | clear past_due |
**Downgrade rule (trust-critical):** free limits gate *creating new things*, never *accessing existing things*. A lapsed user keeps read access + review of all existing cards/notes forever.

## 2. PostHog

### 2.1 Setup
`posthog-js` init in a client provider (EU/US host from env, `person_profiles:'identified_only'`, autocapture ON, session replay ON with `maskAllInputs:true`); `identify(user_id, {plan, study_level, is_edu})` after auth; server events via `posthog-node` in actions/webhooks/jobs (same distinct_id). ALL custom capture flows through typed helpers in `lib/analytics/events.ts` — no inline strings.

### 2.2 Event dictionary (name · when · properties) — **THIS LIST IS CANONICAL**; where 02 §9.3 differs, this wins
- `signup_completed` · after first auth · {method: google|magic_link, is_edu}
- `onboarding_step_completed` · each step · {step: who|level|course|materials|calibrate|building, seconds_on_step}
- `onboarding_finished` · entering first-value moment · {had_materials: bool, material_count}
- `material_upload_started/succeeded/failed` · {kind, bytes, seconds, error_code?}
- `generation_requested/completed/failed` · {artifact: notes|cards|quiz|exam|plan, model, seconds, input_tokens, output_tokens, error_code?}
- `first_artifact_generated` · once per user (ACTIVATION metric) · {artifact}
- `warmup_quiz_completed` · onboarding first-value · {score}
- `card_reviewed` · each rating · {rating, course_id, session_length_so_far}
- `review_session_completed` · {cards, minutes}
- `quiz_completed` / `exam_completed` · {score_pct, n_questions, misses_added_to_cards}
- `tutor_message_sent` · {grounded: bool, socratic: bool, latency_ms}
- `ai_guardrail_triggered` · {layer: moderation|classifier|integrity, decision}
- `groundedness_flagged` · {artifact, pct}
- `limit_meter_viewed` · meter rendered ≤20% remaining · {metric}
- `limit_hit` · blocked action · {metric}
- `paywall_viewed` · {context: onboarding|limit:<metric>|feature:<name>}
- `paywall_dismissed` / `plan_selected` · {interval}
- `checkout_completed` · (server) · {interval, revenue}
- `cancel_completed` · (webhook) · {days_subscribed}
- `refund_selfserve` · {days_since_charge}
- `referral_source_answered` · {source}
- `error_shown` · any error surface · {error_code, screen}
- `share_link_created` / `share_link_opened` · {resource_kind} (P1)
- `auth_paint_measured` · first paint after OAuth callback · {ms} (budget <2000)
- `topic_mode_generated` · topic-mode artifact created · {artifact}

### 2.3 Funnels & flags (create in PostHog UI at M1)
Funnels: Activation (signup→onboarding_finished→first_artifact_generated→review or quiz within 24h) · Monetization (paywall_viewed→plan_selected→checkout_completed, broken down by context) · Upload health (started→succeeded). Flags: `paywall-onboarding-position` (after-warmup vs after-day-1-email), `pricing-v1` (price points), `annual-badge-copy`. Surveys: cancel-reason (shown on `cancel_at_period_end` set), churn NPS.

## 3. Supabase Auth

Google OAuth (web client, consent screen "Hootly", scopes email+profile only) + email magic link (no passwords in v1 — kills reset-flow complaints found in research). Email templates restyled to design system (white, purple button, Ollie mark; subject: "Your Hootly sign-in link 🦉"). On first session: trigger creates `profiles` row + `subscriptions` free row; `is_edu = email ~* '\\.edu$'`. Auth callback prefetches `/onboarding` shell so post-OAuth paint is instant (kills StudyFetch's 15s dead air — measure via `auth_paint_measured {ms}` event, budget <2s). Set Supabase OTP/magic-link expiry to 15 minutes (matches the UI copy) in auth config.

## 4. Transactional email (Resend, minimal set)
Magic link (Supabase SMTP→Resend) · receipt/refund (Stripe native) · "your export is ready" · payment-failed notice. No drip campaigns in v1; marketing email only behind the Privacy toggle (default OFF — trust position).

## 5. Launch config checklist
Custom domain + SSL · Supabase prod project (point-in-time recovery ON — data durability promise) · Stripe live keys + webhook endpoint + portal config script run · PostHog prod project, replay masking verified · OpenAI org limits + usage alerts at $50/$200/$500 · Inngest prod env · Sentry (errors) with PII scrubbing · robots.txt + og images (Ollie) · status page (BetterStack) linked from 500 page.
