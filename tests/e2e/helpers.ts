import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

/**
 * Shared Playwright helpers — key detection, programmatic login, fixtures.
 *
 * There is no `.env.local` in this repo, so the full signup→…→refund journey cannot
 * execute. Everything here is written so the same spec file is honest in both worlds:
 * the always-on suite runs with zero keys, and the keyed suite runs unchanged the
 * moment real keys land.
 */

/** Walk up from the cwd to the directory holding package.json. Deliberately avoids
 *  both `import.meta.url` and `__dirname`: Playwright transpiles specs to CJS while
 *  tsc type-checks them as ESM, so neither is portable across both. */
function findRepoRoot(from: string = process.cwd()): string {
  let dir = path.resolve(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(from);
}

const repoRoot = findRepoRoot();

/* ── env ──────────────────────────────────────────────────────────────────── */

/** Minimal .env reader — Playwright's runner does not load Next's env files.
 *  Never overwrites a variable that is already set in the shell. */
export function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(repoRoot, file);
    if (!existsSync(full)) continue;
    for (const rawLine of readFileSync(full, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnvFiles();

export const ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
} as const;

/** Every key the full journey needs, with the reason it is needed. */
const REQUIRED_FOR_JOURNEY: ReadonlyArray<{ name: string; value: string; why: string }> = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", value: ENV.supabaseUrl, why: "auth + data" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: ENV.supabaseAnonKey, why: "auth + data" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", value: ENV.serviceRoleKey, why: "programmatic test user" },
  { name: "OPENAI_API_KEY", value: ENV.openaiApiKey, why: "notes/cards/quiz generation" },
  { name: "STRIPE_SECRET_KEY", value: ENV.stripeSecretKey, why: "checkout / portal / refund" },
];

export function missingJourneyKeys(): string[] {
  return REQUIRED_FOR_JOURNEY.filter((k) => !k.value).map((k) => k.name);
}

export const hasSupabaseEnv = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
export const hasServiceRoleEnv = Boolean(ENV.supabaseUrl && ENV.serviceRoleKey);
export const hasOpenAIEnv = Boolean(ENV.openaiApiKey);
export const hasStripeEnv = Boolean(ENV.stripeSecretKey);
export const hasJourneyKeys = missingJourneyKeys().length === 0;

/** Stripe must be in TEST mode — a live key would make this suite charge real cards. */
export const stripeIsTestMode = ENV.stripeSecretKey.startsWith("sk_test_");

/** The loud skip banner. Printed from the collection process only (workers set
 *  TEST_WORKER_INDEX) so it lands above the test list instead of interleaved.
 *  Every skipped test title also names the missing keys — a skip can never be
 *  mistaken for a pass. */
export function announceSkipIfUnkeyed(): string {
  const inWorker = process.env.TEST_WORKER_INDEX !== undefined;
  const missing = missingJourneyKeys();
  if (missing.length === 0) {
    if (!stripeIsTestMode) {
      const warning =
        "STRIPE_SECRET_KEY is not a TEST-mode key (sk_test_…). Refusing to run the checkout journey against live Stripe.";
      if (!inWorker) console.warn(`\n[31m⛔ ${warning}[0m\n`);
      return warning;
    }
    return "";
  }
  const reason = `SKIPPED — the full signup→checkout→refund journey needs keys that are absent: ${missing.join(", ")}`;
  if (inWorker) return reason;
  console.warn(
    [
      "",
      "[33m╔══════════════════════════════════════════════════════════════════════╗",
      "[33m║  Playwright: the KEYED half of the smoke test did NOT run.           ║",
      "[33m╚══════════════════════════════════════════════════════════════════════╝[0m",
      `[33mMissing: ${missing.join(", ")}[0m`,
      ...REQUIRED_FOR_JOURNEY.filter((k) => !k.value).map(
        (k) => `[33m  · ${k.name} — ${k.why}[0m`
      ),
      "[33mA skip is not a pass. Add the keys to .env.local and re-run.[0m",
      "",
    ].join("\n")
  );
  return reason;
}

/* ── supabase admin ───────────────────────────────────────────────────────── */

let admin: SupabaseClient | null = null;

/** Service-role client for test setup/teardown. Never used by the app under test. */
export function adminClient(): SupabaseClient {
  if (!hasServiceRoleEnv) {
    throw new Error(
      "adminClient() called without SUPABASE_SERVICE_ROLE_KEY — guard the call with hasServiceRoleEnv."
    );
  }
  admin ??= createClient(ENV.supabaseUrl, ENV.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** A fresh, confirmed user. Creating the auth row fires handle_new_user(), which
 *  inserts the profile + free subscription (docs/04 §4). */
export async function createTestUser(prefix = "smoke"): Promise<TestUser> {
  const email = `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@hootly-e2e.test`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message ?? "no user returned"}`);
  }
  return { id: data.user.id, email, password };
}

/** Hard-delete the user; every table FKs to profiles/auth.users ON DELETE CASCADE. */
export async function deleteTestUser(userId: string): Promise<void> {
  if (!hasServiceRoleEnv) return;
  await adminClient().auth.admin.deleteUser(userId);
}

/* ── programmatic login (no email inbox) ──────────────────────────────────── */

const BASE64_PREFIX = "base64-";
/** @supabase/ssr chunks the auth cookie at this encoded length (utils/chunker.ts). */
const MAX_CHUNK_SIZE = 3180;

function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** `sb-{projectRef}-auth-token` — supabase-js's default storageKey. */
export function authCookieName(supabaseUrl = ENV.supabaseUrl): string {
  const host = new URL(supabaseUrl).hostname;
  return `sb-${host.split(".")[0] ?? "local"}-auth-token`;
}

/** Mirror of @supabase/ssr createChunks(). The encoded value is pure base64url, so
 *  encodeURIComponent() is the identity function and a plain slice is exact. */
function chunkCookie(name: string, value: string): { name: string; value: string }[] {
  if (value.length <= MAX_CHUNK_SIZE) return [{ name, value }];
  const chunks: { name: string; value: string }[] = [];
  for (let i = 0, part = 0; i < value.length; i += MAX_CHUNK_SIZE, part += 1) {
    chunks.push({ name: `${name}.${part}`, value: value.slice(i, i + MAX_CHUNK_SIZE) });
  }
  return chunks;
}

/**
 * Sign in with the service-role-created user and inject the resulting session as the
 * exact cookies `@supabase/ssr` expects, so the Next server renders authed on the
 * very first request. No email inbox is automated — magic-link delivery is out of
 * scope for a browser test and is covered by the always-on "link sent" UI assertions.
 */
export async function loginAs(
  context: BrowserContext,
  user: Pick<TestUser, "email" | "password">,
  baseURL: string
): Promise<Session> {
  const anon = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) {
    throw new Error(`loginAs failed: ${error?.message ?? "no session"}`);
  }

  const encoded = BASE64_PREFIX + base64url(JSON.stringify(data.session));
  const url = new URL(baseURL);
  await context.addCookies(
    chunkCookie(authCookieName(), encoded).map((c) => ({
      name: c.name,
      value: c.value,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax" as const,
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    }))
  );
  return data.session;
}

/* ── fixture data ─────────────────────────────────────────────────────────── */

/** Short, self-contained course text pasted during the journey. Deliberately dense
 *  with checkable facts so generated notes/cards/quiz have something to cite. */
export const PASTED_MATERIAL_TITLE = "Week 3 — Cellular respiration";
export const PASTED_MATERIAL_TEXT = `Cellular respiration is the controlled release of energy from organic molecules, and it happens in three linked stages.

Glycolysis takes place in the cytosol. One six-carbon glucose molecule is split into two three-carbon pyruvate molecules. The pathway invests two ATP and returns four, for a net gain of two ATP, plus two NADH. Glycolysis needs no oxygen, which is why every known domain of life still runs it.

Pyruvate oxidation and the citric acid cycle take place in the mitochondrial matrix. Each pyruvate loses a carbon as carbon dioxide and is attached to coenzyme A, forming acetyl-CoA. The citric acid cycle then turns each acetyl-CoA once, releasing two more carbon dioxide molecules and harvesting three NADH, one FADH2, and one ATP per turn. Because glucose yields two pyruvate, the cycle turns twice per glucose.

Oxidative phosphorylation takes place at the inner mitochondrial membrane. NADH and FADH2 hand their electrons to a chain of protein complexes. As electrons fall to oxygen, the final electron acceptor, protons are pumped into the intermembrane space. The resulting gradient drives ATP synthase, a rotary enzyme that phosphorylates ADP. This chemiosmotic step produces roughly twenty-six to twenty-eight of the thirty to thirty-two ATP a cell gets from one glucose.

When oxygen is scarce, fermentation regenerates NAD+ so glycolysis can continue. Human muscle runs lactic acid fermentation; yeast runs alcoholic fermentation, producing ethanol and carbon dioxide. Neither pathway makes additional ATP by itself.`;

export const COURSE_NAME = "BIO 172 — Human Physiology";

/** ~3 weeks out, matching the seed script and the exam-countdown chip. */
export function examDateInput(daysOut = 21): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  return d.toISOString().slice(0, 10);
}

/** Stripe's universal test card (docs/07 §1.2 — TEST mode only). */
export const TEST_CARD = {
  number: "4242 4242 4242 4242",
  expiry: "12 / 34",
  cvc: "123",
  name: "Ollie Owl",
  zip: "42424",
} as const;
