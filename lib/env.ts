/** Central env access. Missing keys never crash the build — integrations
 *  are fully wired and only the outermost call is stubbed (CLAUDE.md rule 4). */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  modelTutor: process.env.OPENAI_MODEL_TUTOR ?? "gpt-4.1",
  modelBulk: process.env.OPENAI_MODEL_BULK ?? "gpt-4.1-mini",
  modelCheck: process.env.OPENAI_MODEL_CHECK ?? "gpt-4.1-mini",
  modelEmbed: process.env.OPENAI_MODEL_EMBED ?? "text-embedding-3-small",
  modelTranscribe: process.env.OPENAI_MODEL_TRANSCRIBE ?? "whisper-1",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  inngestEventKey: process.env.INNGEST_EVENT_KEY ?? "",
  inngestSigningKey: process.env.INNGEST_SIGNING_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  sentryDsn: process.env.SENTRY_DSN ?? "",
  aiDailyTokenCeilingFree: Number(process.env.AI_DAILY_TOKEN_CEILING_FREE ?? 500_000),
  aiDailyTokenCeilingPlus: Number(process.env.AI_DAILY_TOKEN_CEILING_PLUS ?? 3_000_000),
} as const;

export const hasSupabaseEnv = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasServiceRoleEnv = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
export const hasOpenAIEnv = Boolean(env.openaiApiKey);
export const hasStripeEnv = Boolean(env.stripeSecretKey);
export const hasPostHogEnv = Boolean(env.posthogKey);
export const hasResendEnv = Boolean(env.resendApiKey);
