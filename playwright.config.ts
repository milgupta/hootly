import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — milestone 12 (docs/00 build order §12).
 *
 * testDir is `tests/e2e` and testMatch is `*.spec.ts`, so this runner never picks up
 * Vitest's `tests/unit/**\/*.test.ts` (vitest.config.ts includes `tests/**\/*.test.ts`,
 * which in turn never matches a `.spec.ts` file). The two runners cannot collide.
 *
 * The web server defaults to a production build (`npm run build && npm start`) because
 * that is what the ship gate is measured against. Set PLAYWRIGHT_WEB_SERVER=dev for a
 * fast local loop, or point PLAYWRIGHT_BASE_URL at an already-running deployment.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const useDevServer = process.env.PLAYWRIGHT_WEB_SERVER === "dev";
const isCI = Boolean(process.env.CI);

/** Skip the managed web server entirely when pointed at a remote deployment. */
const external = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|$|\/)/.test(baseURL);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, // the keyed journey is one serial story; the always-on specs are cheap
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  globalTimeout: 30 * 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Deterministic viewport for the a11y/focus assertions.
    viewport: { width: 1280, height: 800 },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  ...(external
    ? {}
    : {
        webServer: {
          command: useDevServer
            ? `npm run dev -- --port ${PORT}`
            : `npm run build && npm start -- --port ${PORT}`,
          url: baseURL,
          // Local runs reuse whatever is already on the port (skips the ~60s build).
          reuseExistingServer: !isCI,
          timeout: 300_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
});
