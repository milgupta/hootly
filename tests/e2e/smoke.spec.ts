import { expect, test, type Page } from "@playwright/test";
import {
  COURSE_NAME,
  PASTED_MATERIAL_TEXT,
  PASTED_MATERIAL_TITLE,
  TEST_CARD,
  adminClient,
  announceSkipIfUnkeyed,
  createTestUser,
  deleteTestUser,
  examDateInput,
  hasJourneyKeys,
  loginAs,
  missingJourneyKeys,
  stripeIsTestMode,
  type TestUser,
} from "./helpers";

/**
 * Milestone 12 smoke test (docs/00 build order §12):
 *   signup → onboard → upload → generate → review → quiz → paywall →
 *   checkout (Stripe TEST mode) → portal cancel → refund.
 *
 * The repo currently has NO .env.local, so the authed half of that path physically
 * cannot execute — every integration is wired but stubbed behind `TODO(key-needed)`
 * guards. Rather than pretend, this file is split in two:
 *
 *   1. ALWAYS-ON — the surfaces that render with zero keys (marketing, pricing,
 *      legal, auth screens, the unauthenticated redirect, 404, keyboard a11y).
 *      These run today and MUST be green.
 *   2. KEYED — the real end-to-end journey against a live Supabase + Stripe TEST
 *      mode. It is complete and correct, and skips loudly (see the banner printed
 *      at collection time) until the keys exist. A skip is not a pass.
 */

const SKIP_REASON = announceSkipIfUnkeyed();
const RUN_JOURNEY = hasJourneyKeys && stripeIsTestMode;

/* ══════════════════════════════════════════════════════════════════════════
   1. ALWAYS-ON — runs with no keys at all
   ══════════════════════════════════════════════════════════════════════════ */

test.describe("marketing surfaces (no keys required)", () => {
  test("landing renders the hero and the trust band", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /Turn tonight.s panic into tomorrow.s A\./ })
    ).toBeVisible();
    await expect(
      page.getByText(
        /Upload your slides, notes, or lectures\. Hootly builds your notes,\s+flashcards, quizzes, and a tutor that cites its sources/
      )
    ).toBeVisible();

    const heroCta = page.getByRole("link", { name: "Start studying free" });
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute("href", "/signup");
    await expect(
      page.getByText("Free plan · No credit card · Cancel anytime in two clicks")
    ).toBeVisible();

    // Trust band — the differentiator (docs/05 §1). All three columns, verbatim.
    await expect(page.getByRole("heading", { name: "The honest study app." })).toBeVisible();
    await expect(
      page.getByText("— limits published right on the pricing page.")
    ).toBeVisible();
    await expect(
      page.getByText("— Stripe portal, no email maze, no dark patterns.")
    ).toBeVisible();
    await expect(
      page.getByText("— every note and answer links to your actual materials.")
    ).toBeVisible();

    // Brand rule 00 §8: no fake social proof at launch.
    await expect(page.getByText(/trusted by .* students/i)).toHaveCount(0);
  });

  test("landing FAQ accordion opens and publishes the free limits", async ({ page }) => {
    await page.goto("/");

    const question = page.getByRole("button", { name: "Is Hootly actually free?" });
    await expect(question).toHaveAttribute("aria-expanded", "false");

    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByText(
        /1 active course, 3 uploads, 50 AI flashcards, 2 AI quizzes, 20 tutor messages a month/
      )
    ).toBeVisible();

    // Consistent toggle behaviour — clicking again closes it.
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "false");
  });

  test("/pricing publishes the exact free-tier limits and both price points", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1, name: "Simple, honest pricing." })).toBeVisible();

    // Free plan card — every published limit (docs/05 §2, semantics docs/04 §5).
    const freeCard = page.getByRole("heading", { name: "Free", exact: true }).locator("..");
    for (const limit of [
      "1 active course",
      "3 file uploads",
      "50 AI flashcards",
      "2 AI quizzes",
      "20 tutor messages/mo",
      "audio up to 30 min",
    ]) {
      await expect(freeCard.getByText(limit, { exact: true })).toBeVisible();
    }
    await expect(freeCard.getByText("$0", { exact: true })).toBeVisible();

    // Annual is the default (docs/05 §2) — $6.99/mo billed annually at $83.88/yr.
    await expect(page.getByRole("button", { name: "Annual", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByText("$6.99", { exact: true })).toBeVisible();
    await expect(page.getByText("Billed annually ($83.88/yr)")).toBeVisible();
    // The savings badge shows its own arithmetic — an unverifiable saving is not honest.
    await expect(
      page.getByRole("button", { name: /Save 46 percent on annual billing/ })
    ).toBeVisible();

    // Monthly toggle reveals the other real price point.
    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await expect(page.getByText("$12.99", { exact: true })).toBeVisible();
    await expect(page.getByText("Billed monthly")).toBeVisible();

    // The published-limits table IS the marketing.
    await expect(page.getByRole("cell", { name: "20 / month" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Up to 30 min" })).toBeVisible();
    await expect(
      page.getByText("Students with a .edu email get 20% off automatically.")
    ).toBeVisible();
    await expect(
      page.getByText("Cancel anytime in two clicks. 7-day full refund, self-serve, no questions.")
    ).toBeVisible();
  });

  test("/pricing billing FAQ answers 'How do I cancel?' with the real two steps", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const cancelQuestion = page.getByRole("button", { name: "How do I cancel?" });
    await cancelQuestion.click();
    await expect(cancelQuestion).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByText(/no retention offers, no phone call, no email maze/)
    ).toBeVisible();
  });

  for (const [slug, heading] of [
    ["terms", "Terms of Service"],
    ["privacy", "Privacy Policy"],
    ["refunds", "Refund Policy"],
  ] as const) {
    test(`/legal/${slug} renders`, async ({ page }) => {
      const response = await page.goto(`/legal/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText(/^Last updated /)).toBeVisible();
      // The cross-links at the foot of every policy.
      await expect(
        page.getByRole("navigation", { name: "Other policies" }).getByRole("link")
      ).toHaveCount(3);
    });
  }
});

test.describe("auth screens and system routes (no keys required)", () => {
  test("/signup renders the Google button and the magic-link field", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByText("Your all-nighters just got shorter.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();

    // .edu detection is pure client state — it works with no keys.
    await page.getByLabel("Email").fill("ollie@state.edu");
    await expect(
      page.getByText("🎓 .edu detected — your 20% student discount will apply automatically.")
    ).toBeVisible();

    // Trust row, never testimonials (docs/05 §3).
    await expect(page.getByText("Real free plan")).toBeVisible();
    await expect(page.getByText("Cancel in 2 clicks")).toBeVisible();
    await expect(page.getByText("AI that cites sources")).toBeVisible();
  });

  test("/login mirrors signup with its own copy", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await expect(page.getByText("Ollie kept your seat warm.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
  });

  test("an unauthenticated /home redirects to /login", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  });

  test("404 renders its copy and one recovery action", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page flew off." })).toBeVisible();
    await expect(page.getByText("The page may have been moved or deleted.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
  });
});

test.describe("keyboard accessibility (no keys required)", () => {
  test("the landing primary CTA is Tab-reachable and shows a visible focus ring", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Start studying free" });

    // Walk the real tab order from the top of the document.
    let reached = false;
    for (let i = 0; i < 15 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await cta.evaluate((el) => el === document.activeElement);
    }
    expect(reached, "the hero CTA must be reachable with Tab alone").toBe(true);

    // docs/03: .focus-ring:focus-visible → 2px solid primary outline, 2px offset.
    const ring = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
    });
    expect(ring.style).not.toBe("none");
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
    expect(ring.color).not.toBe("rgba(0, 0, 0, 0)");

    // Enter follows the link — no mouse anywhere in this test.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("the pricing interval toggle is operable from the keyboard", async ({ page }) => {
    await page.goto("/pricing");
    const monthly = page.getByRole("button", { name: "Monthly", exact: true });
    await monthly.focus();
    await page.keyboard.press("Enter");
    await expect(monthly).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("$12.99", { exact: true })).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2. KEYED — the real journey. Skips loudly until the keys exist.
   ══════════════════════════════════════════════════════════════════════════

   Prerequisites, all of which the skip banner names when absent:
     · NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
       with supabase/migrations/0001–0003 applied
     · OPENAI_API_KEY (generation) and a running Inngest dev server
       (`npx inngest-cli dev -u http://localhost:3000/api/inngest`)
     · STRIPE_SECRET_KEY in TEST mode, `npm run stripe:setup` already run, and
       `stripe listen --forward-to localhost:3000/api/webhooks/stripe` running so
       checkout.session.completed actually flips the subscription to plus.
*/

const journeyTitle = RUN_JOURNEY
  ? "full journey: signup → onboard → upload → generate → review → quiz → paywall → checkout → portal cancel → refund"
  : `full journey [SKIPPED — missing ${
      missingJourneyKeys().join(", ") || "a Stripe TEST-mode key"
    }]: signup → onboard → upload → generate → review → quiz → paywall → checkout → portal cancel → refund`;

test.describe.serial(journeyTitle, () => {
  test.skip(!RUN_JOURNEY, SKIP_REASON || "Stripe key is not sk_test_ — refusing to run.");

  // Generation is real AI work behind a real queue.
  test.setTimeout(10 * 60_000);

  let user: TestUser;
  let courseId: string;

  test.afterAll(async () => {
    if (RUN_JOURNEY && user?.id) await deleteTestUser(user.id);
  });

  test("signs up, onboards, uploads, and watches the study set build", async ({
    page,
    context,
    baseURL,
  }) => {
    // ── signup ────────────────────────────────────────────────────────────
    // Programmatic: the account is created with the service-role admin API and the
    // session is injected as @supabase/ssr cookies. handle_new_user() gives us the
    // profile + free subscription exactly as a real magic-link signup would.
    user = await createTestUser();
    await loginAs(context, user, baseURL ?? "http://localhost:3000");

    await page.goto("/onboarding");

    // ── 4.1 who ───────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Who's studying?" })).toBeVisible();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();
    await page.getByText("student", { exact: true }).click();

    // ── 4.2 level ─────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "What are you studying for?" })).toBeVisible();
    await page.getByText("College", { exact: true }).click();

    // ── 4.3 course ────────────────────────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "Let's set up your first course." })
    ).toBeVisible();
    await page.getByLabel("Course name").fill(COURSE_NAME);
    await page.getByLabel("When's the exam? (optional)").fill(examDateInput(21));
    await page.getByRole("button", { name: "Next" }).click();

    // ── 4.4 materials — upload (pasted notes: no fixture file, real ingestion) ──
    await expect(page.getByRole("heading", { name: "Feed Ollie your materials." })).toBeVisible();
    // The quota is visible BEFORE the action (non-negotiable rule 1).
    await expect(page.getByText("Uploads: 0 of 3 free")).toBeVisible();

    await page.getByRole("button", { name: "Paste notes" }).click();
    await page.getByLabel("Title (optional)").fill(PASTED_MATERIAL_TITLE);
    await page.getByPlaceholder("Paste your notes here…").fill(PASTED_MATERIAL_TEXT);
    await page.getByRole("button", { name: "Add notes" }).click();

    // Real ingestion progress — no fake timers anywhere (docs/04 §8).
    await expect(page.getByText(PASTED_MATERIAL_TITLE)).toBeVisible();
    await expect(page.getByText("Uploads: 1 of 3 free")).toBeVisible();

    const buildCta = page.getByRole("button", { name: "Build my study set" });
    await expect(buildCta).toBeEnabled({ timeout: 120_000 });
    await buildCta.click();

    // ── 4.5 calibrate ─────────────────────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "How well do you know this already?" })
    ).toBeVisible();
    await page.getByText("Some background — I know the basics").click();

    // ── 4.6 building — generation theater, driven by real job events ───────
    await expect(page.getByRole("heading", { name: /Building your study set/ })).toBeVisible();
    const openCourse = page.getByRole("button", { name: /Open my course/ });
    await expect(openCourse).toBeVisible({ timeout: 8 * 60_000 });
    await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
    await openCourse.click();

    // ── 4.7 first value: tour → warm-up quiz → paywall → referral survey ───
    await expect(page).toHaveURL(/\/courses\/[0-9a-f-]+\?firstvalue=1/);
    courseId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(courseId).not.toBe("");

    await page.getByRole("button", { name: "Skip tour" }).click();

    await expect(page.getByRole("heading", { name: "Quick warm-up" })).toBeVisible({
      timeout: 60_000,
    });
    for (let q = 0; q < 3; q += 1) {
      const options = page.getByRole("dialog").locator("button").filter({ hasNotText: /^Skip$/ });
      await options.first().click();
      // Trust rule 4: the correct answer is ALWAYS revealed.
      await expect(page.getByText("Correct answer").first()).toBeVisible();
      const advance = page.getByRole("button", { name: /Next question|Finish/ });
      await advance.click();
      if ((await advance.count()) === 0) break;
    }

    await expect(page.getByText("Nice. That's 3 questions down.")).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();

    // Paywall AFTER first value — never before (docs/05 §4.7).
    await expect(page.getByRole("heading", { name: "Keep the momentum." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Maybe later" })).toBeVisible();
    await page.getByRole("button", { name: "Maybe later" }).click();

    await expect(page.getByText("Where'd you hear about us?")).toBeVisible();
    await page.getByRole("button", { name: "Friend" }).click();

    // ── generation actually produced artifacts ─────────────────────────────
    const admin = adminClient();
    const [{ count: noteCount }, { count: cardCount }, { count: quizCount }] = await Promise.all([
      admin.from("notes").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      admin.from("flashcards").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      admin.from("quizzes").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    ]);
    expect(noteCount ?? 0).toBeGreaterThan(0);
    expect(cardCount ?? 0).toBeGreaterThan(0);
    expect(quizCount ?? 0).toBeGreaterThan(0);
  });

  test("notes cite their sources and the review session persists every rating", async ({
    page,
  }) => {
    const admin = adminClient();

    // ── generate: the note carries real source chips ──────────────────────
    const { data: note } = await admin
      .from("notes")
      .select("id")
      .eq("course_id", courseId)
      .eq("status", "ready")
      .limit(1)
      .maybeSingle();
    expect(note?.id, "build-course must produce a ready note").toBeTruthy();

    await page.goto(`/courses/${courseId}/notes/${note?.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Trust rule 4: citations on every grounded claim.
    await expect(page.getByRole("button", { name: /Open source:/ }).first()).toBeVisible();

    // ── review: FSRS session, autosave after EVERY rating ─────────────────
    await page.goto(`/courses/${courseId}/review`);
    await expect(page.getByText("Space to flip · 1–4 to rate · Esc to exit")).toBeVisible();

    let rated = 0;
    for (let i = 0; i < 3; i += 1) {
      const card = page.getByRole("button", { name: /^Question —/ });
      if ((await card.count()) === 0) break;
      await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: /^Answer —/ })).toBeVisible();
      await page.keyboard.press("3"); // Good
      rated += 1;
    }
    expect(rated, "the review session must serve at least one due card").toBeGreaterThan(0);

    // Ratings persist per-rating (data-durability rule 3) — check the DB, not the DOM.
    await expect
      .poll(
        async () => {
          const { count } = await admin
            .from("card_reviews")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);
          return count ?? 0;
        },
        { timeout: 15_000 }
      )
      .toBeGreaterThanOrEqual(rated);
  });

  test("a quiz always reveals the correct answer and scores the attempt", async ({ page }) => {
    const admin = adminClient();
    const { data: quiz } = await admin
      .from("quizzes")
      .select("id")
      .eq("course_id", courseId)
      .eq("kind", "quiz")
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(quiz?.id, "build-course must produce a ready quiz").toBeTruthy();

    await page.goto(`/courses/${courseId}/quiz/${quiz?.id}`);

    for (let i = 0; i < 20; i += 1) {
      const radios = page.getByRole("radio");
      if ((await radios.count()) > 0) {
        await radios.first().click();
      } else {
        await page.getByLabel("Your answer").fill("cellular respiration");
      }
      await page.getByRole("button", { name: "Submit answer" }).click();

      // The correct answer is revealed on EVERY question, right or wrong
      // (docs/05 §7.4 — StudyFetch hides it; we never do).
      await expect(page.getByText(/^Correct( answer)?$/).first()).toBeVisible();

      const seeResults = page.getByRole("button", { name: "See results" });
      if (await seeResults.isVisible().catch(() => false)) {
        await seeResults.click();
        break;
      }
      await page.getByRole("button", { name: "Continue" }).click();
    }

    await expect(page.getByRole("heading", { name: /\d+ of \d+ correct/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "By topic" })).toBeVisible();
  });

  test("hitting a published limit opens the paywall, never an error", async ({ page }) => {
    const admin = adminClient();
    // Burn the free upload quota (lifetime metric, docs/04 §5) so the very next
    // upload attempt is a real limit hit rather than a synthetic one.
    await admin
      .from("usage_counters")
      .upsert(
        { user_id: user.id, metric: "uploads", period_start: "1970-01-01", count: 3 },
        { onConflict: "user_id,metric,period_start" }
      );

    await page.goto(`/courses/${courseId}?tab=materials&add=1`);
    await expect(page.getByText("Uploads: 3 of 3 free")).toBeVisible();

    await page.getByRole("button", { name: "Paste notes" }).click();
    await page.getByPlaceholder("Paste your notes here…").fill("One more page of notes.");
    await page.getByRole("button", { name: "Add notes" }).click();

    // limit_hit opens the paywall with the specific meter — never a dead error.
    await expect(page.getByRole("heading", { name: "You've used your 3 free uploads." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Maybe later" })).toBeVisible();
  });

  test("checkout in Stripe TEST mode upgrades the account to Plus", async ({ page }) => {
    await page.goto(`/courses/${courseId}?tab=materials&add=1`);
    await page.getByRole("button", { name: "Paste notes" }).click();
    await page.getByPlaceholder("Paste your notes here…").fill("One more page of notes.");
    await page.getByRole("button", { name: "Add notes" }).click();
    await expect(page.getByRole("heading", { name: /You've used your 3 free uploads\./ })).toBeVisible();

    // Annual is preselected with the honest math shown (docs/05 §9).
    await expect(page.getByRole("button", { name: /Annual ·/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.getByRole("button", { name: "Get Plus" }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
    await payWithTestCard(page);

    // success_url → /home?upgraded=1 (docs/07 §1.2)
    await page.waitForURL(/\/home/, { timeout: 120_000 });
    await expect(page.getByText("You're on Plus. Everything's unlimited now.")).toBeVisible({
      timeout: 30_000,
    });

    // The webhook is the source of truth for the plan (docs/07 §1.5).
    const admin = adminClient();
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("subscriptions")
            .select("plan")
            .eq("user_id", user.id)
            .maybeSingle();
          return data?.plan ?? "free";
        },
        {
          timeout: 60_000,
          message:
            "subscriptions.plan never became 'plus' — is `stripe listen --forward-to localhost:3000/api/webhooks/stripe` running?",
        }
      )
      .toBe("plus");

    await page.goto("/settings?tab=billing");
    await expect(page.getByRole("heading", { name: /^Plus · / })).toBeVisible();
  });

  test("cancel is two clicks through the Stripe portal", async ({ page }) => {
    await page.goto("/settings?tab=billing");

    // Click 1 — Manage billing.
    await Promise.all([
      page.waitForURL(/billing\.stripe\.com/, { timeout: 60_000 }),
      page.getByRole("button", { name: "Manage billing" }).click(),
    ]);

    // Click 2 — Cancel subscription (no retention flow is configured, docs/07 §1.3).
    await page.getByRole("link", { name: /Cancel subscription/i }).first().click();
    await page
      .getByRole("button", { name: /Cancel subscription|Confirm cancellation/i })
      .first()
      .click();
    await expect(page.getByText(/cancel|canceled/i).first()).toBeVisible({ timeout: 30_000 });

    const admin = adminClient();
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("subscriptions")
            .select("cancel_at_period_end")
            .eq("user_id", user.id)
            .maybeSingle();
          return Boolean(data?.cancel_at_period_end);
        },
        { timeout: 60_000 }
      )
      .toBe(true);

    // Downgrade never locks content (docs/07 §1.5 downgrade rule).
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByText(COURSE_NAME)).toBeVisible();
  });

  test("the 7-day refund is self-serve with no human in the loop", async ({ page }) => {
    await page.goto("/settings?tab=billing");
    const refund = page.getByRole("button", { name: "Get a refund" });
    await expect(refund).toBeVisible();

    await Promise.all([page.waitForURL(/refunded=1/, { timeout: 60_000 }), refund.click()]);

    const admin = adminClient();
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("subscriptions")
            .select("plan")
            .eq("user_id", user.id)
            .maybeSingle();
          return data?.plan ?? "unknown";
        },
        { timeout: 60_000 }
      )
      .toBe("free");

    // Nothing a user made is ever lost, refund or not (rule 3).
    const { count: cardsAfterRefund } = await admin
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .is("deleted_at", null);
    expect(cardsAfterRefund ?? 0).toBeGreaterThan(0);

    await page.goto(`/courses/${courseId}/review`);
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}/review`));
  });
});

/* ── Stripe Checkout hosted page ──────────────────────────────────────────── */

/** Fills Stripe's hosted Checkout with the 4242 test card. Field ids are stable on
 *  checkout.stripe.com; the iframe fallback covers the embedded-element variant. */
async function payWithTestCard(page: Page): Promise<void> {
  const inPage = page.locator("#cardNumber");
  const target = (await inPage.count())
    ? page
    : page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

  await target.locator("#cardNumber").fill(TEST_CARD.number);
  await target.locator("#cardExpiry").fill(TEST_CARD.expiry);
  await target.locator("#cardCvc").fill(TEST_CARD.cvc);

  const name = target.locator("#billingName");
  if (await name.count()) await name.fill(TEST_CARD.name);

  const zip = target.locator("#billingPostalCode");
  if (await zip.count()) await zip.fill(TEST_CARD.zip);

  await page.locator('button[type="submit"], .SubmitButton').first().click();
}
