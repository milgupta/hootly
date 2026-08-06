# AI eval harness (`docs/06 §8`)

The starter golden set and the five automated checks that gate any PR touching
prompts, schemas or models.

## Running it

```bash
npm run eval:ai      # vitest run tests/ai  — the whole harness
npm test             # includes the harness alongside the unit suite
```

**No API key is required and no network call is made by default.** Everything below
runs against deterministic recorded model output that ships in the repo.

```bash
OPENAI_API_KEY=sk-... npm run eval:ai
```

With a key present, an extra `describe` block generates the artifacts for real and
runs the *identical* check functions against the fresh output. Without a key that
block is skipped via `describe.skipIf(!process.env.OPENAI_API_KEY)` and reported as
skipped rather than passed.

## What ships in `fixtures/`

| File | What it is |
| --- | --- |
| `biology_cell_structure.txt` | ~1400-word biology chapter (cells, organelles), written for this repo |
| `us_history_declaration.txt` | ~1250-word US-history packet on the Declaration of Independence |
| `calculus_limits_derivatives.txt` | ~1650-word calculus chapter (limits, continuity, derivatives) |
| `*.expected.json` | Per-source expected properties: topics that MUST appear, plausible-sounding falsehoods that must NOT, regex misconception probes, and the per-feature thresholds |
| `recorded/*.model-output.json` | Deterministic recorded model output — notes outline, note sections, cards, quiz, plan, groundedness verdicts, answer-key verdicts |
| `redteam.json` | 20 red-team prompts with expected classifications, plus on-topic controls |

All three source texts are original prose written for this repository, apart from
short quotations of the Declaration of Independence itself, which is in the public
domain. Nothing was downloaded.

## The five checks

| # | Check | Threshold | How it runs offline |
| --- | --- | --- | --- |
| 1 | Schema validity | 100% | Every recorded artifact is parsed with the real zod schema from `lib/ai/schemas` |
| 2 | Citation coverage | ≥95% of note sentences | Sentences are split from `body_md`, markers extracted with `extractChunkMarkers`, and resolved with the real `resolveCitations` against the request's prefix→uuid map |
| 3 | Answer-key verification | ≥90% first try | Local well-formedness rules (docs/06 §4.3 + §6b) computed from the question itself, combined with the recorded `{correct, well_formed, explanation_ok}` verdicts |
| 4 | Guardrails | 100% of 20 red-team prompts | Runs entirely against the real regex prefilter `needsClassifier()` in `lib/ai/guardrails.ts` — routing is computed, not replayed |
| 5 | Fill-blank leak | exactly 0 | Real `fillBlankLeaks()` from `lib/ai/groundedness.ts` over every `fill_blank` question |

## How determinism is achieved

`loadFixture()` chunks the source text with the **real** `chunkBlocks()` from
`lib/ai/rag.ts`, then assigns each chunk a stable uuid of the form
`{prefix}{index}-1111-4222-8333-444455556666` (`b10c0000`, `d0c50001`, …). The
prompt-facing 8-char prefix is therefore predictable, so the recorded outputs can
carry `[chunk:b10c0001]` markers that genuinely resolve through the production
citation path. No database and no embedding call is involved.

## The golden set is deliberately imperfect

If every metric read 100% the checks would be unfalsifiable. So:

- two note sentences across the set carry no citation → coverage lands just above
  the 95% floor rather than at 100%;
- two quiz questions have recorded verification failures (a wrong MCQ key and an
  ambiguous fill-blank) → the pass rate lands at ~93%, above the 90% floor;
- the `harness self-checks (negative controls)` block feeds deliberately broken
  artifacts through every metric and asserts each one *fails*.

## Adding a source

1. Drop `my_source.txt` in `fixtures/`.
2. Add `my_source.expected.json` with `chunk_id_prefix` set to four unused hex
   characters, `min_chunks`, the topic/falsehood lists, and the thresholds.
3. Run once with `OPENAI_API_KEY` set, capture the generated artifacts into
   `recorded/my_source.model-output.json`, and add the id to `FIXTURE_IDS` in
   `helpers.ts`.

`docs/06 §8` expects this set to grow to ≥10 real course materials (bio, history,
calc, law, CS) during the M1 beta.
