# COWORK_TASKS.md — browser tasks for Hootly setup

Written to be handed to a browser agent. Read the two rules first — they decide what you delegate and what you keep.

---

## Rule 1 — You do these yourself, before handing anything over

A browser agent will refuse these, and it should:

- **Creating accounts and signing in** to Supabase, Google Cloud, Stripe, PostHog, Resend, Inngest, Sentry, Vercel. Password and credential entry is yours.
- **Entering payment details or completing Stripe's business/identity verification.**
- **Any 2FA prompt.**

So: create all eight accounts and leave each dashboard **open and logged in** in a Chrome tab. Then hand over the tasks below.

## Rule 2 — Secrets: you copy, the agent configures

Several tasks below end with "a key is now visible." **Copy those into `.env.local` yourself.** Don't have the agent read them back into a chat transcript — anything it surfaces gets logged.

This matters most for `SUPABASE_SERVICE_ROLE_KEY`, which bypasses every row-level-security policy in your database, and `STRIPE_SECRET_KEY`. Let the agent do the navigation and configuration; you handle the strings.

Where a task produces a key, it's marked **🔑 you copy**.

---

# A. Supabase

Prerequisite: project created, dashboard open.

**A1. Capture the API keys** 🔑 you copy
Settings → API. Three values: Project URL, `anon`/public key, `service_role` key. Also note the **project ref** (the subdomain, e.g. `abcdefgh` in `abcdefgh.supabase.co`) — task B4 needs it.

**A2. Run the three migrations**
Best done by you, not the agent — it's pasting three long SQL files and you want to see each result. SQL Editor → New query. Paste and run **in order**, confirming success before the next:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_screen_support.sql`
3. `supabase/migrations/0003_exam_integrity.sql` — **do not skip.** It revokes client access to quiz answer columns; without it a student can read the answer key mid-exam.

*(Alternative: `supabase db push` from the terminal with the CLI linked.)*

**A3. Verify the schema landed** — agent can do
Table Editor should list roughly 18 tables including `profiles`, `courses`, `materials`, `chunks`, `flashcards`, `quizzes`, `subscriptions`. Storage should show a bucket named `materials`. **Confirm it is Private** — if it's public, make it private. Report anything missing.

**A4. Email auth + the 15-minute expiry** — agent can do
Authentication → the sign-in/providers section. Enable **Email**. Turn **Confirm email** ON. Set **OTP / magic-link expiry to 900 seconds (15 minutes)**.
*This exact number matters: the app's UI says "It expires in 15 minutes." Any other value makes the product lie on its first screen.*

**A5. Enable the Google provider** — agent can do
Same section, enable **Google**. Leave Client ID and Secret empty for now; task B5 fills them.

**A6. URL configuration** — agent can do
Authentication → URL Configuration.
- Site URL: `http://localhost:3000`
- Redirect URLs: add `http://localhost:3000/auth/callback`

*(Both change to the real domain at task G2.)*

**A7. Enable Realtime** — agent can do
Database → Replication (or a Realtime section, depending on dashboard version). Ensure Realtime is enabled for the project.
*Upload progress bars and the onboarding generation theater are driven by this. Without it those screens sit frozen at zero.*

---

# B. Google Cloud — OAuth

The fiddliest section. No shortcuts exist.

**B1. Create or select a project** — agent can do
console.cloud.google.com → create a project named `hootly`.

**B2. OAuth consent screen** — agent can do
APIs & Services → OAuth consent screen → **External**. App name **Hootly**, your support email, developer contact email.

**B3. Scopes — exactly two** — agent can do
Add `email` and `profile`. **Nothing else.** Any additional scope triggers Google's verification review and delays launch by weeks.

**B4. Create the OAuth client** — agent can do 🔑 you copy
Credentials → Create Credentials → OAuth client ID → **Web application**.
Authorized redirect URI — this is **Supabase's** callback, not your app's:
```
https://<project-ref>.supabase.co/auth/v1/callback
```
Substitute the ref from A1. Getting this wrong is the single most common OAuth failure. Client ID and Secret appear on save.

**B5. Paste credentials into Supabase** — agent can do
Back in Supabase's Google provider (A5), paste the Client ID and Secret, save.

**B6. Add yourself as a test user** — agent can do
While the consent screen is in Testing, only listed accounts can sign in. Add your email. (Publishing is task H1.)

---

# C. Stripe — test mode

**C1. Confirm Test mode** — agent can do
dashboard.stripe.com → the Test mode toggle in the top bar must be **ON**. Everything below is test mode; live is task H2.

**C2. Capture API keys** 🔑 you copy
Developers → API keys. Secret key (`sk_test_…`) and Publishable key (`pk_test_…`).

**C3. Webhook endpoint** — agent can do 🔑 you copy
Developers → Webhooks → Add endpoint. URL: `https://<your-domain>/api/webhooks/stripe` (skip until you've deployed — for local work you'll use the Stripe CLI instead).
Select **exactly these five events**:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

The signing secret (`whsec_…`) appears after saving.

**Do NOT create products or prices by hand.** `npm run stripe:setup` creates the product, both prices, the `edu20` coupon, and the billing portal configuration with cancellation-at-period-end and no retention flow. Hand-made ones will conflict.

---

# D. PostHog

**D1. Capture the project key** 🔑 you copy
Project Settings → Project API key. Confirm whether you're on US or EU cloud — it must match `NEXT_PUBLIC_POSTHOG_HOST`.

**D2. Session replay + masking** — agent can do, **you verify**
Enable Session Replay. Then **visually confirm input masking is on.** The app requests it in code, but check it in the UI yourself — this app handles student coursework and payment forms, and a replay of an unmasked checkout is a real problem.

**D3. Three funnels** — agent can do
- **Activation**: `signup_completed` → `onboarding_finished` → `first_artifact_generated` → (`card_reviewed` or `quiz_completed`), 24-hour window
- **Monetization**: `paywall_viewed` → `plan_selected` → `checkout_completed`, broken down by the `context` property
- **Upload health**: `material_upload_started` → `material_upload_succeeded`

*These event names are exact — the app emits them verbatim from a typed dictionary.*

**D4. Three feature flags** — agent can do
`paywall-onboarding-position`, `pricing-v1`, `annual-badge-copy`. Boolean, default off.

**D5. Two surveys** — agent can do
A cancel-reason survey and a churn NPS survey.

---

# E. Resend

**E1. Add and verify your sending domain** — agent can do (partly)
resend.com → Domains → Add. It produces DNS records. **Adding those records happens at your domain registrar**, which may be a different login — do that part yourself. Verification can take a few hours.

**E2. Create an API key** 🔑 you copy

**E3. Point Supabase SMTP at Resend** — agent can do
Supabase → Project Settings → Auth → SMTP. Enter Resend's SMTP credentials.
*Worth doing rather than skipping: you shipped passwordless login with no password fallback. If the magic-link email doesn't arrive, the user has no other way in. Supabase's built-in sender is shared, rate-limited, and lands in spam far more often.*

**E4. Restyle the magic-link email** — agent can do
Authentication → Email Templates → Magic Link. Subject: `Your Hootly sign-in link 🦉`. Body: white background, purple (`#7C3AED`) button, Ollie mark.

---

# F. Inngest

**F1. Create an app** — agent can do
inngest.com → create an app for Hootly.

**F2. Capture both keys** 🔑 you copy
Event Key and Signing Key.

**F3. Register the endpoint** — agent can do (after deploying)
Point the app at `https://<your-domain>/api/inngest`.
*This is also what makes the two crons fire — nightly trash purge at 06:00 and study-plan roll-forward at 07:00. Locally you run the Inngest dev server instead.*

---

# G. Vercel — deployment

**G1. Import and configure** — agent can do 🔑 you paste
Import the repo. Add every variable from `.env.local` to Environment Variables — **you paste the secret values**. Set `NEXT_PUBLIC_APP_URL` to your real domain; auth callbacks and Stripe redirects are built from it, so a wrong value breaks sign-in entirely.

**G2. Domain, then update the callbacks** — agent can do
Add your custom domain, let SSL provision. Then go back and update:
- Supabase URL Configuration → Site URL and redirect list to the real domain
- Inngest → the real `/api/inngest` URL
- Stripe → production webhook endpoint (new signing secret → Vercel)

---

# H. Before real money — you, not an agent

**H1. Publish the Google consent screen** so anyone can sign in.

**H2. Stripe live mode** — requires business identity verification. **Yours to complete.** Then swap in live keys and re-run `npm run stripe:setup` against live mode.

**H3. Enable point-in-time recovery** in Supabase. A paid-tier toggle that backs your "your stuff never disappears" promise.

**H4. Attorney review** of `/legal/terms`, `/legal/privacy`, `/legal/refunds`. Each carries a `TEMPLATE — ATTORNEY REVIEW BEFORE LAUNCH` comment.

**H5. Trademark and domain diligence on "Hootly."** Your PRD asks for this and it's still open.

---

# Delegation summary

| Section | Agent can do | Reserved for you |
|---|---|---|
| A Supabase | A3–A7 | A1 keys, A2 migrations |
| B Google | B1–B6 | — |
| C Stripe | C1, C3 | C2 keys |
| D PostHog | D3–D5, D2 setup | D1 key, D2 visual check |
| E Resend | E1 setup, E3, E4 | E2 key, DNS at registrar |
| F Inngest | F1, F3 | F2 keys |
| G Vercel | G1 structure, G2 | Secret values |
| H Launch | — | All of it |

**Dependencies that will bite:** A1's project ref is required by B4. B4's credentials are required by B5. G2 must happen after G1 or your callbacks point at localhost. Everything in C beyond C1 assumes test mode.
