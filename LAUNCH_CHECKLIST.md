# LAUNCH_CHECKLIST.md — Hootly

Everything left between the finished codebase and a live app, in the order it has to happen. Each item says whether it's **[browser]** (a console/dashboard you have to click through) or **[terminal]** (a command you run here).

Work top to bottom — later sections genuinely depend on earlier ones. Stages 1–3 get the app running locally end to end; stage 4 is the full test pass; stages 5–7 are launch.

---

# STAGE 1 — Get the app running locally (~35 min)

Nothing works until Supabase exists. Do this first.

## 1.1 Supabase project [browser]

1. Go to **supabase.com/dashboard** → **New project**. Name it `hootly`, pick a region near your users, and save the database password somewhere safe.
2. Wait for provisioning (~2 min).
3. **Settings → API**. Copy three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` — this one bypasses all row-level security. It must never reach the browser or a git commit.
4. Note your **project ref** (the subdomain in the project URL, e.g. `abcdefgh` in `https://abcdefgh.supabase.co`). You need it in step 1.3.

## 1.2 Create `.env.local` [terminal]

```bash
cp .env.example .env.local
```

Fill in the three Supabase values now. Leave the rest blank — the app runs with partial keys, and each section below fills in more. `.env.local` is already gitignored.

## 1.3 Run the migrations [browser]

**SQL Editor → New query.** Paste and run each file in order, one at a time, confirming success before the next:

1. `supabase/migrations/0001_init.sql` — the whole schema, RLS on every table, the storage bucket, the vector search function, and the Realtime authorization policy
2. `supabase/migrations/0002_screen_support.sql`
3. `supabase/migrations/0003_exam_integrity.sql` — **do not skip this one.** It revokes client access to quiz answer columns. Without it a student can read the answer key mid-exam with a single query.

Then verify: **Table Editor** should list ~18 tables, and **Storage** should show a `materials` bucket marked **private**. If the bucket is public, make it private.

## 1.4 Supabase auth settings [browser]

**Authentication → Sign In / Providers:**

5. **Email** — enable it. Turn **Confirm email** ON. Set **OTP expiry to 900 seconds (15 minutes)** — the UI literally promises "It expires in 15 minutes", so a mismatch here makes the app lie to users.
6. **Google** — enable the toggle. Leave the Client ID/Secret fields open; you'll fill them in step 1.5.

**Authentication → URL Configuration:**

7. **Site URL**: `http://localhost:3000` for now (you'll change this at launch).
8. **Redirect URLs**: add `http://localhost:3000/auth/callback`.

## 1.5 Google OAuth [browser]

9. **console.cloud.google.com** → create a project (or reuse one).
10. **APIs & Services → OAuth consent screen**: External. App name **Hootly**, your support email, your logo if you have one.
11. **Scopes**: add `email` and `profile` only. Nothing else — extra scopes trigger Google's verification review and delay you for weeks.
12. **Credentials → Create Credentials → OAuth client ID → Web application.**
13. **Authorized redirect URI** — this is Supabase's callback, not your app's:
    ```
    https://<your-project-ref>.supabase.co/auth/v1/callback
    ```
14. Copy the Client ID and Client Secret back into Supabase's Google provider (step 1.6) and save.
15. While the consent screen is in **Testing**, only accounts on the test-users list can sign in. Add your own email. Publishing is step 6.2.

## 1.6 Enable Realtime [browser]

16. **Database → Replication** (or **Realtime** depending on dashboard version) — make sure Realtime is enabled for the project. Upload progress and the onboarding generation theater are driven by it; without it those screens sit at zero forever.

## 1.7 OpenAI [browser + terminal]

17. **platform.openai.com** → **API keys** → create a key → paste into `OPENAI_API_KEY`.
18. **Settings → Limits**: set a monthly budget cap and usage alerts at **$50 / $200 / $500**. Do this before your first real upload — a runaway ingestion job on a large video is the expensive failure mode.
19. Confirm your account has access to the models in `.env.local` (`gpt-4.1`, `gpt-4.1-mini`, `text-embedding-3-small`, `whisper-1`). If not, change the values there — model names are config, never hardcoded.

## 1.8 First run [terminal]

```bash
npm run seed
```

Creates a demo account — `demo@hootly.app` / `hootly-demo-2026` — with one fully populated course. It's idempotent, so re-run it any time.

```bash
npx inngest-cli dev -u http://localhost:3000/api/inngest
```

Leave that running in its own terminal. It processes uploads and generation. **Without it, uploads sit at "Queued…" forever** — this is the single most common "why is nothing happening" cause.

```bash
npm run dev
```

Sign in as the demo user and confirm: the dashboard shows the course, notes have clickable source chips, review cards flip and rate, the quiz reveals correct answers.

---

# STAGE 2 — Billing in test mode (~20 min)

## 2.1 Stripe keys [browser]

20. **dashboard.stripe.com** → confirm **Test mode** is ON (the toggle in the top bar). Stay in test mode until stage 4 passes.
21. **Developers → API keys**: copy the **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY`, and the **Publishable key** (`pk_test_…`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

## 2.2 Create the catalog [terminal]

```bash
npm run stripe:setup
```

Creates the Hootly Plus product, both prices ($12.99/mo and $83.88/yr), the `edu20` student coupon, and the billing portal configuration — cancellation at period end with **no retention flow**, which is what makes the "cancel in two clicks" promise true. It's idempotent.

## 2.3 Webhook endpoint [browser]

22. **Developers → Webhooks → Add endpoint.**
23. URL: `https://<your-domain>/api/webhooks/stripe` (for local testing use the CLI in 2.4 instead).
24. Select exactly these five events:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`
    - `invoice.paid`
25. Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

## 2.4 Local webhook forwarding [terminal]

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use the `whsec_…` this prints as your local `STRIPE_WEBHOOK_SECRET`. Leave it running. **Without it, a test checkout succeeds at Stripe but the account never flips to Plus.**

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

---

# STAGE 3 — Supporting services (~25 min)

## 3.1 Inngest [browser]

26. **inngest.com** → create an account and an app.
27. Copy the **Event Key** → `INNGEST_EVENT_KEY` and the **Signing Key** → `INNGEST_SIGNING_KEY`.
28. Register your deployed URL (`https://<your-domain>/api/inngest`) once you deploy in stage 5. This is also what makes the two crons fire: nightly trash purge at 06:00 and plan roll-forward at 07:00.

## 3.2 PostHog [browser]

29. **posthog.com** → create a project. Copy the **Project API key** → `NEXT_PUBLIC_POSTHOG_KEY`. Confirm the host matches `NEXT_PUBLIC_POSTHOG_HOST` (US vs EU cloud differ).
30. **Session Replay** → enable, then **verify input masking is actually on** before any real traffic. The code requests masking, but confirm it in the UI — this is student coursework and payment forms.
31. Create three **funnels**:
    - *Activation*: `signup_completed` → `onboarding_finished` → `first_artifact_generated` → (`card_reviewed` or `quiz_completed`) within 24h
    - *Monetization*: `paywall_viewed` → `plan_selected` → `checkout_completed`, broken down by the `context` property
    - *Upload health*: `material_upload_started` → `material_upload_succeeded`
32. Create three **feature flags**: `paywall-onboarding-position`, `pricing-v1`, `annual-badge-copy`.
33. Create two **surveys**: cancel-reason (triggered when `cancel_at_period_end` is set) and churn NPS.

## 3.3 Resend [browser]

34. **resend.com** → add and verify your sending domain (DNS records — allow up to a few hours for propagation).
35. Create an API key → `RESEND_API_KEY`.
36. Optional but recommended: point Supabase's SMTP at Resend (**Project Settings → Auth → SMTP**) so magic-link emails come from your domain rather than Supabase's shared sender, which lands in spam far more often.
37. Restyle the magic-link template under **Authentication → Email Templates**: white background, purple button, Ollie mark, subject `Your Hootly sign-in link 🦉`.

## 3.4 Sentry [browser]

38. **sentry.io** → create a Next.js project → copy the DSN → `SENTRY_DSN`.
39. Turn on PII scrubbing. Note: the DSN is wired as config but the SDK isn't initialized — see "Known gaps" below.

---

# STAGE 4 — The full test pass

This is the gate before going live.

40. **[terminal]** With every key in `.env.local`, the Inngest dev server running, and `stripe listen` forwarding:
    ```bash
    npm test
    npx playwright test
    ```
    The 7 currently-skipped Playwright tests will now **run** — that's the real signup → onboard → upload → generate → review → quiz → paywall → checkout → cancel → refund journey. They must be green.
41. **[terminal]** `npm run eval:ai` — with `OPENAI_API_KEY` present this stops using recorded fixtures and calls the real API, checking citation coverage, answer-key accuracy, and guardrail routing against live model output.
42. **[browser]** Manually walk the money path once yourself: upgrade with the test card, cancel through the portal (confirm it really is two clicks and there's no retention interstitial), then refund. Verify your notes and cards are still readable after the refund — that downgrade never locks content is the core brand promise.

---

# STAGE 5 — Deploy (~20 min)

43. **[browser]** **vercel.com** → import the repo.
44. **[browser]** Add every `.env.local` variable to Vercel's environment variables. Set `NEXT_PUBLIC_APP_URL` to your real domain — auth callbacks and Stripe redirects are built from it, so a wrong value breaks sign-in.
45. **[browser]** Add your custom domain and let SSL provision.
46. **[browser]** Go back to **Supabase → URL Configuration** and change Site URL to your real domain, adding `https://<your-domain>/auth/callback` to the redirect list.
47. **[browser]** Point the **Inngest** app at `https://<your-domain>/api/inngest`.
48. **[browser]** Add the production **Stripe webhook** endpoint at your real domain and update `STRIPE_WEBHOOK_SECRET` in Vercel.

---

# STAGE 6 — Before you take real money

49. **[browser] Have an attorney review the three legal pages.** `/legal/terms`, `/legal/privacy`, `/legal/refunds` are written as a working template and each carries a `TEMPLATE — ATTORNEY REVIEW BEFORE LAUNCH` comment at the top. They hard-code your six commitments, but they are not legal advice.
50. **[browser] Trademark and domain diligence on "Hootly"** — doc 02 §3 asks for this explicitly and it's still open. NightOwl, Owlio, and StudyOwl are the documented fallbacks.
51. **[browser]** Publish the Google OAuth consent screen (out of Testing) so anyone can sign in.
52. **[browser]** Flip Stripe to **live mode**, swap in live keys, and re-run `npm run stripe:setup` against live mode to recreate the catalog and portal config there.
53. **[browser]** Supabase → **enable point-in-time recovery**. This backs the "your stuff never disappears" promise, and it's a paid-tier feature you have to turn on deliberately.
54. **[browser]** Set up a status page (BetterStack) — the 500 page is designed to link to one.

---

# STAGE 7 — Nice to have

55. **[browser]** Verify OG images render correctly by pasting your URL into a Slack/iMessage/Twitter composer.
56. **[browser]** Submit your sitemap to Google Search Console.
57. **[terminal]** Delete or gate `/dev/ui` before launch — it's a component gallery, harmless but not customer-facing.

---

# Known gaps — deliberate, documented, and yours to decide on

These are complete decisions rather than oversights, but you should know about them:

- **Sentry is configured but not initialized.** `SENTRY_DSN` is read into the env module and the package is in the docs, but no `instrumentation.ts` / client config exists, so nothing reports yet. It needs `npx @sentry/wizard@latest -i nextjs` (~10 min).
- **Image-only (scanned) PDFs fail rather than OCR.** Doc 04 lists OCR-auto-ran as an info state, but v1 ships no PDF rasterizer, so scanned PDFs surface `extract_empty` with an honest "try a clearer scan" recovery. Standalone photo uploads *do* run vision OCR. Adding this means a rasterizer plus per-page vision calls.
- **Share links are P1.** The `share_links` table, the `/s/[slug]` route, and the two typed analytics events all exist but nothing creates a link yet — deliberate per the PRD.
- **Streaks are hidden.** Doc 05 says hide the streak flame until streaks exist (P1). The top bar has no streak UI.
- **No rate limiting on the API routes** beyond the per-user AI token ceiling and plan quotas. Worth adding before a TikTok spike.

---

# Fast reference

| Symptom | Cause |
|---|---|
| Uploads stuck at "Queued…" | Inngest dev server isn't running |
| Checkout succeeds but plan stays free | `stripe listen` isn't forwarding, or wrong `STRIPE_WEBHOOK_SECRET` |
| Generation theater never advances | Realtime disabled in Supabase, or migration 0001's realtime policy missing |
| Sign-in redirects to an error | `NEXT_PUBLIC_APP_URL` doesn't match the Supabase redirect allowlist |
| "Isn't configured yet on this deployment" | That integration's key is still missing from `.env.local` |
| Everything works locally, nothing in prod | Env vars weren't copied into Vercel |

**Time estimate:** ~2 hours of console work to get through stage 5, plus legal review and trademark diligence on their own timelines.
