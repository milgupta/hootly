import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Vitest config (docs/04 §1 — unit: limits, FSRS wrapper, zod schemas, webhook
 *  handlers; docs/06 §8 — the AI eval harness under tests/ai).
 *  `server-only` is a Next.js build-time marker with no Node entry point, so it is
 *  aliased to an empty stub; that lets the pure helpers inside server modules
 *  (rag.ts, guardrails.ts, groundedness.ts) be unit-tested directly. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.resolve(root, "tests/stubs/server-only.ts") },
      { find: /^@\/(.*)$/, replacement: `${root}/$1` },
    ],
  },
});
