/**
 * Demo seed — `npm run seed` (docs/00 "Definition of done": *seed script creates a
 * demo account with one populated course*).
 *
 * Creates ONE demo user with ONE fully populated course: a pasted material with real
 * chunks (embedded when OPENAI_API_KEY exists), a cited note, 25 flashcards spanning
 * all three FSRS UI states, a completed 10-question quiz covering all four qtypes, a
 * tutor thread with a citation, a three-week study plan, and usage counters that
 * match what was created.
 *
 * IDEMPOTENT: re-running deletes the demo auth user first, which cascades every row
 * and storage-free artifact below it (docs/04 §4 — all user tables FK to profiles /
 * auth.users ON DELETE CASCADE), then rebuilds from scratch.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { scheduleReview, type FsrsColumns, type ReviewRating } from "../lib/fsrs";

/* ── env ──────────────────────────────────────────────────────────────────── */

/** Walk up from the cwd to the directory holding package.json — portable whether
 *  tsx loads this file as CJS or ESM (`import.meta.url` and `__dirname` are not). */
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

/** Next loads .env.local for the app; a bare tsx script has to do it itself. */
function loadEnvFiles(): void {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const EMBED_MODEL = process.env.OPENAI_MODEL_EMBED ?? "text-embedding-3-small";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  const missing = [
    !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  console.error(
    [
      "",
      "✖ Cannot seed: missing " + missing.join(" and ") + ".",
      "",
      "  The seed writes with the service-role key (it bypasses RLS to fill Class B",
      "  tables like chunks, note_sections and quiz_questions — docs/04 §4).",
      "",
      "  Fix:",
      "    1. Create a Supabase project and run supabase/migrations/0001–0003.",
      "    2. Copy .env.example to .env.local.",
      "    3. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      "       (Supabase dashboard → Project Settings → API → service_role).",
      "    4. Re-run: npm run seed",
      "",
      "  The service-role key is a server-only secret — never expose it to the client.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ── demo account ─────────────────────────────────────────────────────────── */

/** Documented demo credentials — dev/staging only, never a production project. */
const DEMO_EMAIL = "demo@hootly.app";
const DEMO_PASSWORD = "hootly-demo-2026";
const DEMO_NAME = "Demo Student";

/* ── course content (hand-written, ~1,240 words) ──────────────────────────── */

const MATERIAL_TITLE = "Unit 3 — Metabolism: Cellular Respiration and Photosynthesis";

/** One entry per chunk. Chunking is done by paragraph here rather than by the
 *  ~800-token windows the real ingester uses, because a demo wants chunks a human
 *  can read next to the note that cites them. */
const CHUNK_TEXTS: readonly string[] = [
  `ATP, the energy currency of the cell. Adenosine triphosphate is the molecule cells actually spend. Its usefulness comes from the three phosphate groups strung along its tail: those groups carry a cluster of negative charges that repel each other, so the bond holding the last phosphate is easy to break and releases usable free energy when it does. Hydrolysing ATP to ADP and inorganic phosphate yields roughly 7.3 kilocalories per mole under standard conditions, and closer to 13 in the crowded conditions inside a real cell. A typical human cell holds only about a second's worth of ATP at any moment, which is why metabolism is a continuous manufacturing process rather than a storage strategy. Catabolic pathways such as cellular respiration exist to keep rebuilding ADP into ATP as fast as the cell spends it.`,

  `Overview of cellular respiration. Cellular respiration is the controlled, stepwise oxidation of organic fuel — usually glucose — into carbon dioxide and water, with the released energy captured as ATP. The summary equation is deceptively simple: one glucose plus six oxygen yields six carbon dioxide, six water, and energy. Burning glucose in a flame releases the same total energy, but all at once and as heat. The cell instead strips electrons off the fuel a few at a time and passes them down a series of carriers, so that most of the energy can be trapped rather than lost. The process has three linked stages: glycolysis, pyruvate oxidation with the citric acid cycle, and oxidative phosphorylation.`,

  `Stage 1 — glycolysis. Glycolysis happens in the cytosol and needs no oxygen, no membrane, and no organelle, which is part of the evidence that it is evolutionarily ancient: every domain of life still runs it. Ten enzyme-catalysed steps split one six-carbon glucose into two three-carbon pyruvate molecules. The first half is an energy investment phase that spends two ATP to phosphorylate the sugar and destabilise it. The second half is the payoff phase, which produces four ATP by substrate-level phosphorylation and reduces two NAD+ to NADH. Net yield per glucose: two ATP, two NADH, and two pyruvate. The regulated step is phosphofructokinase, which is inhibited by ATP and citrate — the cell slows the line when the warehouse is full.`,

  `Stage 2a — pyruvate oxidation. If oxygen is available, pyruvate is transported into the mitochondrial matrix and handed to the pyruvate dehydrogenase complex, a large multi-enzyme assembly. Each pyruvate loses one carbon as carbon dioxide, the remaining two-carbon fragment is oxidised to an acetyl group, and NAD+ is reduced to NADH. The acetyl group is then attached to coenzyme A, producing acetyl-CoA. Because one glucose gave two pyruvate, this junction runs twice per glucose, producing two carbon dioxide and two NADH. Acetyl-CoA is the metabolic crossroads of the cell: fats and many amino acids also enter the pathway here, which is why the citric acid cycle is described as a hub and not just a glucose pathway.`,

  `Stage 2b — the citric acid cycle. Also called the Krebs cycle, this eight-step loop takes place in the mitochondrial matrix. Acetyl-CoA donates its two-carbon acetyl group to four-carbon oxaloacetate, forming six-carbon citrate. Over the remaining steps the cycle releases two carbon dioxide, regenerates oxaloacetate, and harvests the electrons: three NADH, one FADH2, and one ATP or GTP by substrate-level phosphorylation per turn. The cycle turns twice per glucose, so the per-glucose harvest is six NADH, two FADH2, and two ATP. Note that the carbon dioxide you exhale comes from here and from pyruvate oxidation — not, as students often guess, from the oxygen you inhale.`,

  `Stage 3 — the electron transport chain. Embedded in the inner mitochondrial membrane are four large protein complexes plus two mobile carriers, ubiquinone and cytochrome c. NADH donates electrons at Complex I and FADH2 at Complex II, which is why FADH2 yields less ATP: it enters the chain further downstream and skips one proton-pumping site. As electrons fall stepwise toward oxygen, complexes I, III and IV use the released energy to pump protons from the matrix into the intermembrane space. Oxygen is the final electron acceptor; it collects spent electrons and protons to form water. Without oxygen the chain backs up, NADH cannot be reoxidised, and the citric acid cycle stalls within seconds.`,

  `Chemiosmosis and ATP synthase. The pumped protons create both a concentration gradient and a charge difference across the inner membrane — together, the proton-motive force. Peter Mitchell's chemiosmotic hypothesis, initially ridiculed and later awarded the 1978 Nobel Prize, proposed that this gradient, not a chemical intermediate, is what couples oxidation to ATP synthesis. ATP synthase is a rotary molecular motor: protons flowing back down their gradient through its membrane-embedded rotor turn a shaft, and the conformational changes in the catalytic head force ADP and phosphate together. Roughly four protons are needed per ATP. Poisons illustrate the coupling — cyanide blocks Complex IV, while dinitrophenol makes the membrane leaky and burns the gradient off as heat.`,

  `ATP accounting, honestly. Textbooks often quote 36 to 38 ATP per glucose, but the modern figure is about 30 to 32. Two reasons: the proton-to-ATP ratio is not a whole number, and the NADH made in the cytosol during glycolysis has to be ferried into the mitochondrion by a shuttle that costs energy. The malate-aspartate shuttle preserves the NADH, while the glycerol phosphate shuttle downgrades it to FADH2. Current estimates give about 2.5 ATP per matrix NADH and about 1.5 per FADH2. The exact number matters less than the shape of the answer: substrate-level phosphorylation contributes only four ATP directly, and the overwhelming majority of the yield comes from chemiosmosis.`,

  `Fermentation and oxygen debt. When oxygen runs short, the electron transport chain cannot accept electrons, NADH accumulates, and glycolysis would halt for lack of NAD+. Fermentation solves exactly this one problem: it regenerates NAD+ so glycolysis can keep making its two net ATP. Human skeletal muscle reduces pyruvate to lactate; yeast decarboxylates pyruvate to acetaldehyde and then reduces it to ethanol, releasing carbon dioxide. Neither pathway produces additional ATP itself, which is why anaerobic effort is so limited. Lactate is not a waste product — it is shuttled to the liver and reconverted to glucose in the Cori cycle, and the delayed oxygen consumption that repays this is called excess post-exercise oxygen consumption.`,

  `Photosynthesis and the carbon connection. Photosynthesis runs the same chemistry in reverse direction and in a different organelle. In the thylakoid membranes of the chloroplast, photosystem II absorbs light, splits water to replace its lost electrons — releasing the oxygen you breathe — and feeds electrons down a chain that pumps protons into the thylakoid lumen. ATP synthase there makes ATP by the very same chemiosmotic mechanism, while photosystem I re-energises the electrons to reduce NADP+ to NADPH. In the stroma, the Calvin cycle spends that ATP and NADPH: rubisco fixes carbon dioxide onto ribulose bisphosphate, and after reduction and regeneration steps, three turns yield one molecule of glyceraldehyde-3-phosphate. The sugar a plant builds is the fuel a mitochondrion later takes apart.`,
] as const;

const RAW_TEXT = CHUNK_TEXTS.join("\n\n");

/* ── notes ────────────────────────────────────────────────────────────────── */

interface SectionSpec {
  heading: string;
  body_md: string;
  chunks: number[]; // indexes into CHUNK_TEXTS
}

const NOTE_SECTIONS: readonly SectionSpec[] = [
  {
    heading: "Why ATP, and why continuously",
    chunks: [0],
    body_md: `ATP is the cell's **spending money**, not its savings account.

- The three phosphates carry clustered negative charges that repel each other, so the terminal bond is easy to break.
- Hydrolysis to ADP + Pᵢ releases about **7.3 kcal/mol** at standard conditions, nearer **13 kcal/mol** inside a real cell.
- A cell holds roughly **one second** of ATP at a time — which is the whole reason catabolism never stops.

> Exam trap: "high-energy bond" does not mean the bond is strong. It means breaking it is favourable.`,
  },
  {
    heading: "The three stages at a glance",
    chunks: [1],
    body_md: `Respiration is *staged oxidation*: electrons come off the fuel a few at a time so the energy can be captured instead of lost as heat.

| Stage | Where | Main output per glucose |
| --- | --- | --- |
| Glycolysis | Cytosol | 2 ATP, 2 NADH, 2 pyruvate |
| Pyruvate oxidation + citric acid cycle | Mitochondrial matrix | 8 NADH, 2 FADH₂, 2 ATP, 6 CO₂ |
| Oxidative phosphorylation | Inner mitochondrial membrane | ~26–28 ATP |

Summary equation: $C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O + \\text{energy}$`,
  },
  {
    heading: "Glycolysis: invest two, get four",
    chunks: [2],
    body_md: `Ten steps in the cytosol, **no oxygen and no organelle required** — the strongest hint that it is evolutionarily ancient.

1. **Investment phase** — spend 2 ATP to phosphorylate and destabilise the sugar.
2. **Payoff phase** — recover 4 ATP by substrate-level phosphorylation and reduce 2 NAD⁺ to NADH.

**Net: 2 ATP · 2 NADH · 2 pyruvate.**

The committed, regulated step is **phosphofructokinase**, inhibited by ATP and citrate — the line slows when the warehouse is full.`,
  },
  {
    heading: "Into the matrix: acetyl-CoA and the Krebs cycle",
    chunks: [3, 4],
    body_md: `**Pyruvate oxidation** (×2 per glucose): pyruvate loses one carbon as CO₂, the rest is oxidised to an acetyl group, NAD⁺ → NADH, and coenzyme A picks up the acetyl group.

Acetyl-CoA is the **metabolic crossroads** — fats and many amino acids enter here too, which is why the cycle is a hub rather than a glucose-only pathway.

**Citric acid cycle** (×2 per glucose), per turn:

- 2 CO₂ released
- 3 NADH + 1 FADH₂ harvested
- 1 ATP/GTP by substrate-level phosphorylation
- oxaloacetate regenerated

The CO₂ you exhale comes from *here* and from pyruvate oxidation — not from the O₂ you inhale.`,
  },
  {
    heading: "The chain, the gradient, and the rotary motor",
    chunks: [5, 6],
    body_md: `Four complexes plus ubiquinone and cytochrome c sit in the inner membrane.

- NADH enters at **Complex I**; FADH₂ enters at **Complex II** — further downstream, skipping a pumping site, which is exactly why it yields less ATP.
- Complexes **I, III and IV** pump protons into the intermembrane space.
- **O₂ is the final electron acceptor**, forming water. Remove it and the chain backs up, NADH cannot be reoxidised, and the cycle stalls within seconds.

**Chemiosmosis** (Mitchell, Nobel 1978): the proton-motive force — not a chemical intermediate — couples oxidation to ATP synthesis. ATP synthase is a rotary motor; roughly **4 H⁺ per ATP**.

Coupling, demonstrated by poisons: cyanide blocks Complex IV; dinitrophenol makes the membrane leaky and dissipates the gradient as heat.`,
  },
  {
    heading: "The honest ATP count, and life without oxygen",
    chunks: [7, 8],
    body_md: `Older textbooks say 36–38 ATP per glucose. The modern figure is **~30–32**, for two reasons:

- the H⁺-per-ATP ratio is not a whole number;
- cytosolic NADH must be ferried in — the **malate-aspartate shuttle** preserves it, the **glycerol phosphate shuttle** downgrades it to FADH₂.

Working values: **~2.5 ATP per matrix NADH**, **~1.5 per FADH₂**. Substrate-level phosphorylation contributes only 4 ATP directly; the rest is chemiosmosis.

**Fermentation** solves exactly one problem: regenerating NAD⁺ so glycolysis can keep running. Muscle → lactate; yeast → ethanol + CO₂. Neither makes extra ATP. Lactate is not waste — the liver recycles it via the **Cori cycle**.`,
  },
  {
    heading: "Photosynthesis: the same trick, running the other way",
    chunks: [9],
    body_md: `In the **thylakoid membrane**: photosystem II absorbs light, splits water (this is where atmospheric O₂ comes from), and feeds electrons down a chain that pumps protons into the lumen. ATP synthase makes ATP by the *identical* chemiosmotic mechanism. Photosystem I re-energises the electrons to make NADPH.

In the **stroma**: the Calvin cycle spends that ATP and NADPH. Rubisco fixes CO₂ onto ribulose bisphosphate; three turns yield one G3P.

The closing idea for this unit: **the sugar a chloroplast builds is the fuel a mitochondrion later takes apart.**`,
  },
] as const;

/* ── flashcards ───────────────────────────────────────────────────────────── */

type DemoState = "new" | "learning" | "relearning" | "reviewing" | "mastered";

interface CardSpec {
  front: string;
  back: string;
  chunks: number[];
  state: DemoState;
  /** Days from now the card should next fall due (negative = overdue). */
  dueInDays: number;
  favorited?: boolean;
}

const CARD_SPECS: readonly CardSpec[] = [
  // ── New (8) — the queue a learner would open today ──────────────────────
  { front: "What does ATP stand for?", back: "Adenosine triphosphate — the molecule cells spend to do work.", chunks: [0], state: "new", dueInDays: 0 },
  { front: "Why is ATP's terminal phosphate bond easy to break?", back: "The three phosphate groups carry clustered negative charges that repel each other, so hydrolysis is energetically favourable.", chunks: [0], state: "new", dueInDays: 0 },
  { front: "Where in the cell does glycolysis occur?", back: "The cytosol — no oxygen, membrane, or organelle required.", chunks: [2], state: "new", dueInDays: 0 },
  { front: "Which enzyme is the main regulated step of glycolysis?", back: "Phosphofructokinase — inhibited by ATP and citrate.", chunks: [2], state: "new", dueInDays: 0 },
  { front: "What molecule is the metabolic crossroads where fats and amino acids also enter respiration?", back: "Acetyl-CoA.", chunks: [3], state: "new", dueInDays: 0 },
  { front: "Which two mobile carriers shuttle electrons between the ETC complexes?", back: "Ubiquinone (coenzyme Q) and cytochrome c.", chunks: [5], state: "new", dueInDays: 0 },
  { front: "What does dinitrophenol do to the mitochondrion?", back: "It makes the inner membrane leaky to protons, dissipating the gradient as heat and uncoupling it from ATP synthesis.", chunks: [6], state: "new", dueInDays: 0 },
  { front: "Which photosystem splits water?", back: "Photosystem II — and that split is the source of atmospheric oxygen.", chunks: [9], state: "new", dueInDays: 0 },

  // ── Learning (3) + Relearning (1) — mid-acquisition ─────────────────────
  { front: "Net ATP yield of glycolysis per glucose?", back: "2 ATP (4 produced minus 2 invested), plus 2 NADH and 2 pyruvate.", chunks: [2], state: "learning", dueInDays: 0, favorited: true },
  { front: "How many carbons are in pyruvate?", back: "Three. Glucose (6C) splits into two 3-carbon pyruvate molecules.", chunks: [2], state: "learning", dueInDays: 0 },
  { front: "What is released when pyruvate becomes acetyl-CoA?", back: "One CO₂, plus one NADH as the two-carbon fragment is oxidised.", chunks: [3], state: "learning", dueInDays: 0 },
  { front: "Where does the CO₂ you exhale actually come from?", back: "Pyruvate oxidation and the citric acid cycle — not from the O₂ you inhale.", chunks: [4], state: "relearning", dueInDays: 0 },

  // ── Reviewing (7) — graduated, interval still under 21 days ─────────────
  { front: "Per turn, what does the citric acid cycle harvest?", back: "3 NADH, 1 FADH₂, 1 ATP/GTP, and it releases 2 CO₂.", chunks: [4], state: "reviewing", dueInDays: 0 },
  { front: "How many times does the citric acid cycle turn per glucose?", back: "Twice — one turn per pyruvate.", chunks: [4], state: "reviewing", dueInDays: 1 },
  { front: "Why does FADH₂ yield less ATP than NADH?", back: "It enters at Complex II, downstream of Complex I, so it skips one proton-pumping site.", chunks: [5], state: "reviewing", dueInDays: 2, favorited: true },
  { front: "What is the final electron acceptor in aerobic respiration?", back: "Oxygen — it collects spent electrons and protons to form water.", chunks: [5], state: "reviewing", dueInDays: 3 },
  { front: "What is the proton-motive force?", back: "The combined concentration and charge gradient of H⁺ across the inner mitochondrial membrane.", chunks: [6], state: "reviewing", dueInDays: 5 },
  { front: "Roughly how many protons does ATP synthase need per ATP?", back: "About four.", chunks: [6], state: "reviewing", dueInDays: 8 },
  { front: "What does cyanide block?", back: "Complex IV of the electron transport chain, stopping electron flow to oxygen.", chunks: [6], state: "reviewing", dueInDays: 12 },

  // ── Mastered (6) — state 2 with a scheduled interval past 21 days ───────
  { front: "Summary equation for cellular respiration?", back: "C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + energy.", chunks: [1], state: "mastered", dueInDays: 24 },
  { front: "Which three stages make up cellular respiration?", back: "Glycolysis, pyruvate oxidation with the citric acid cycle, and oxidative phosphorylation.", chunks: [1], state: "mastered", dueInDays: 28 },
  { front: "Modern ATP yield per glucose?", back: "About 30–32 — not the older textbook 36–38.", chunks: [7], state: "mastered", dueInDays: 31 },
  { front: "Working ATP values per NADH and per FADH₂?", back: "About 2.5 ATP per matrix NADH and about 1.5 per FADH₂.", chunks: [7], state: "mastered", dueInDays: 35 },
  { front: "What is the one job of fermentation?", back: "Regenerating NAD⁺ so glycolysis can keep running. It makes no extra ATP itself.", chunks: [8], state: "mastered", dueInDays: 40 },
  { front: "What is the Cori cycle?", back: "The liver taking up muscle lactate and reconverting it to glucose — lactate is recycled, not waste.", chunks: [8], state: "mastered", dueInDays: 45 },
] as const;

/* ── quiz (all four qtypes) ───────────────────────────────────────────────── */

interface QuestionSpec {
  qtype: "mcq" | "true_false" | "fill_blank" | "short_answer";
  topic: string;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  chunks: number[];
  difficulty: 1 | 2 | 3;
  /** What the demo attempt answered — drives attempt_answers + score_pct. */
  given: string;
}

const QUESTION_SPECS: readonly QuestionSpec[] = [
  {
    qtype: "mcq",
    topic: "Glycolysis",
    prompt: "What is the net ATP yield of glycolysis per molecule of glucose?",
    options: ["2 ATP", "4 ATP", "either 30 or 32 ATP", "no ATP — only NADH"],
    answer: "2 ATP",
    explanation:
      "The investment phase spends 2 ATP and the payoff phase produces 4, so the net gain is 2 ATP — along with 2 NADH and 2 pyruvate.",
    chunks: [2],
    difficulty: 1,
    given: "2 ATP",
  },
  {
    qtype: "mcq",
    topic: "Electron transport chain",
    prompt: "Why does FADH₂ ultimately yield less ATP than NADH?",
    options: [
      "It carries fewer electrons",
      "It enters the chain at Complex II and skips a proton-pumping site",
      "It cannot cross the inner mitochondrial membrane",
      "It is oxidised by oxygen directly",
    ],
    answer: "It enters the chain at Complex II and skips a proton-pumping site",
    explanation:
      "NADH donates at Complex I, FADH₂ at Complex II. Entering downstream means fewer protons pumped, and therefore less ATP made by chemiosmosis.",
    chunks: [5],
    difficulty: 2,
    given: "It enters the chain at Complex II and skips a proton-pumping site",
  },
  {
    qtype: "mcq",
    topic: "Chemiosmosis",
    prompt: "ATP synthase is best described as which of the following?",
    options: [
      "A proton pump driven by ATP hydrolysis",
      "A rotary motor driven by protons flowing down their gradient",
      "An enzyme that oxidises NADH directly",
      "A carrier protein for acetyl-CoA",
    ],
    answer: "A rotary motor driven by protons flowing down their gradient",
    explanation:
      "Protons returning through the membrane-embedded rotor turn a shaft; the conformational change in the catalytic head forces ADP and phosphate together.",
    chunks: [6],
    difficulty: 2,
    given: "A rotary motor driven by protons flowing down their gradient",
  },
  {
    qtype: "mcq",
    topic: "Photosynthesis",
    prompt: "In the Calvin cycle, how many turns are needed to produce one molecule of G3P?",
    options: ["One", "Two", "Three", "Six"],
    answer: "Three",
    explanation:
      "Rubisco fixes one CO₂ per turn; after reduction and regeneration, three turns are required to yield a single glyceraldehyde-3-phosphate.",
    chunks: [9],
    difficulty: 3,
    given: "Six",
  },
  {
    qtype: "true_false",
    topic: "Citric acid cycle",
    prompt: "The carbon dioxide you exhale originates from the oxygen you inhale.",
    options: null,
    answer: "False",
    explanation:
      "It comes from pyruvate oxidation and the citric acid cycle. Inhaled O₂ ends up in water, as the final electron acceptor.",
    chunks: [4, 5],
    difficulty: 2,
    given: "False",
  },
  {
    qtype: "true_false",
    topic: "Fermentation",
    prompt: "Fermentation produces additional ATP beyond what glycolysis already makes.",
    options: null,
    answer: "False",
    explanation:
      "Fermentation makes no ATP of its own. Its only job is regenerating NAD⁺ so glycolysis can keep producing its net 2 ATP.",
    chunks: [8],
    difficulty: 1,
    given: "False",
  },
  {
    qtype: "fill_blank",
    topic: "Glycolysis",
    prompt:
      "The committed regulatory step of glycolysis is catalysed by the enzyme ____________.",
    options: null,
    answer: "phosphofructokinase",
    explanation:
      "Phosphofructokinase is inhibited by ATP and citrate — feedback that slows the pathway when the cell already has plenty of energy.",
    chunks: [2],
    difficulty: 2,
    given: "phosphofructokinase",
  },
  {
    qtype: "fill_blank",
    topic: "Chemiosmosis",
    prompt:
      "____________ proposed the chemiosmotic hypothesis and won the 1978 Nobel Prize for it.",
    options: null,
    answer: "Peter Mitchell",
    explanation:
      "Mitchell argued that a proton gradient — not a chemical intermediate — couples oxidation to ATP synthesis. The idea was ridiculed before it was rewarded.",
    chunks: [6],
    difficulty: 3,
    given: "Peter Mitchell",
  },
  {
    qtype: "short_answer",
    topic: "ATP accounting",
    prompt:
      "Give two reasons the modern ATP yield per glucose (~30–32) is lower than the textbook figure of 36–38.",
    options: null,
    answer:
      "The proton-to-ATP ratio is not a whole number, and cytosolic NADH must be shuttled into the mitochondrion at an energetic cost.",
    explanation:
      "The malate-aspartate shuttle preserves NADH; the glycerol phosphate shuttle downgrades it to FADH₂. Combined with the non-integer H⁺:ATP ratio, the realistic total lands near 30–32.",
    chunks: [7],
    difficulty: 3,
    given:
      "The proton-to-ATP ratio is not a whole number, and cytosolic NADH must be shuttled into the mitochondrion at an energetic cost.",
  },
  {
    qtype: "short_answer",
    topic: "Electron transport chain",
    prompt: "What happens to the citric acid cycle within seconds of oxygen being removed?",
    options: null,
    answer:
      "It stalls, because the electron transport chain backs up and NADH can no longer be reoxidised to NAD+.",
    explanation:
      "With no final electron acceptor the carriers stay reduced, NAD⁺ is not regenerated, and the dehydrogenase steps of the cycle have nothing to hand their electrons to.",
    chunks: [5],
    difficulty: 2,
    given: "The chain stops and it runs out of oxygen.",
  },
] as const;

/* ── study plan ───────────────────────────────────────────────────────────── */

interface PlanSpec {
  title: string;
  kind: "review_cards" | "take_quiz" | "read_note" | "take_exam" | "custom";
  topic: string;
  /** Days from today. Negative = earlier this/last week. */
  dueInDays: number;
  completed: boolean;
  target: "note" | "quiz" | null;
}

const PLAN_SPECS: readonly PlanSpec[] = [
  // Week 1 — mostly done
  { title: "Read the Unit 3 notes end to end", kind: "read_note", topic: "Overview", dueInDays: -5, completed: true, target: "note" },
  { title: "Review 20 cards on glycolysis", kind: "review_cards", topic: "Glycolysis", dueInDays: -4, completed: true, target: null },
  { title: "Draw the citric acid cycle from memory", kind: "custom", topic: "Citric acid cycle", dueInDays: -2, completed: true, target: null },
  { title: "Take the Unit 3 checkpoint quiz", kind: "take_quiz", topic: "Unit 3", dueInDays: -1, completed: true, target: "quiz" },
  // Week 2 — in progress
  { title: "Review cards due on the electron transport chain", kind: "review_cards", topic: "Electron transport chain", dueInDays: 0, completed: false, target: null },
  { title: "Re-read the chemiosmosis section", kind: "read_note", topic: "Chemiosmosis", dueInDays: 1, completed: false, target: "note" },
  { title: "Retake the checkpoint quiz and beat 80%", kind: "take_quiz", topic: "Unit 3", dueInDays: 3, completed: false, target: "quiz" },
  { title: "Write out the honest ATP tally per glucose", kind: "custom", topic: "ATP accounting", dueInDays: 5, completed: false, target: null },
  // Week 3 — exam run-up
  { title: "Review every card marked Again or Hard", kind: "review_cards", topic: "Mixed", dueInDays: 9, completed: false, target: null },
  { title: "Compare respiration and photosynthesis side by side", kind: "custom", topic: "Photosynthesis", dueInDays: 12, completed: false, target: null },
  { title: "Full practice exam under timed conditions", kind: "take_exam", topic: "Unit 3", dueInDays: 16, completed: false, target: null },
  { title: "Final pass over the notes the night before", kind: "read_note", topic: "Overview", dueInDays: 19, completed: false, target: "note" },
] as const;

/* ── helpers ──────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

function dateOnly(days: number): string {
  return daysFromNow(days).toISOString().slice(0, 10);
}

function emptyFsrsRow(now: Date): FsrsColumns {
  return {
    fsrs_due: now.toISOString(),
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_learning_steps: 0,
    fsrs_reps: 0,
    fsrs_lapses: 0,
    fsrs_state: 0,
    fsrs_last_review: null,
  };
}

interface SimulatedCard {
  row: FsrsColumns;
  reviews: { rating: ReviewRating; at: Date; elapsed_ms: number }[];
}

/**
 * Produce a genuinely FSRS-consistent card by replaying real ratings through
 * lib/fsrs.ts, then translating the whole history in time so the card falls due
 * exactly where the demo wants it. Nothing is hand-faked: stability, difficulty and
 * scheduled_days are whatever ts-fsrs actually computed.
 */
function simulate(state: DemoState, dueInDays: number): SimulatedCard {
  // Start far enough back that the replayed history sits in the past.
  let clock = new Date(Date.now() - 120 * DAY_MS);
  let row = emptyFsrsRow(clock);
  const reviews: SimulatedCard["reviews"] = [];

  const apply = (rating: ReviewRating) => {
    row = scheduleReview(row, rating, clock);
    reviews.push({ rating, at: new Date(clock), elapsed_ms: 3_000 + Math.round(Math.random() * 9_000) });
    clock = new Date(row.fsrs_due);
  };

  if (state !== "new") {
    if (state === "learning") {
      apply(3); // Good → still in learning steps
    } else if (state === "reviewing") {
      for (let i = 0; i < 8 && row.fsrs_state !== 2; i += 1) apply(3);
      // Nudge back under the 21-day Mastered threshold if a lucky roll overshot.
      for (let i = 0; i < 3 && row.fsrs_scheduled_days >= 21; i += 1) apply(1);
      if (row.fsrs_state !== 2) apply(3);
    } else if (state === "relearning") {
      for (let i = 0; i < 8 && row.fsrs_state !== 2; i += 1) apply(3);
      apply(1); // Again → Relearning
    } else {
      // mastered: Easy until the scheduled interval clears 21 days
      for (let i = 0; i < 15 && !(row.fsrs_state === 2 && row.fsrs_scheduled_days >= 21); i += 1) {
        apply(4);
      }
    }
  }

  // Translate the whole history so the next due date lands where we want it.
  const target = daysFromNow(dueInDays).getTime();
  const delta = target - new Date(row.fsrs_due).getTime();
  row = {
    ...row,
    fsrs_due: new Date(new Date(row.fsrs_due).getTime() + delta).toISOString(),
    fsrs_last_review: row.fsrs_last_review
      ? new Date(new Date(row.fsrs_last_review).getTime() + delta).toISOString()
      : null,
  };
  for (const review of reviews) review.at = new Date(review.at.getTime() + delta);

  return { row, reviews };
}

/** UI state mapping, docs/04 §4 (normative) — used only for the console summary. */
function uiState(row: FsrsColumns): "Learning" | "Reviewing" | "Mastered" {
  if (row.fsrs_state !== 2) return "Learning";
  return row.fsrs_scheduled_days >= 21 ? "Mastered" : "Reviewing";
}

function assertOk(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function embedChunks(texts: readonly string[]): Promise<string[] | null> {
  if (!OPENAI_API_KEY) return null;
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input: [...texts],
  });
  const ordered = [...response.data].sort((a, b) => a.index - b.index);
  // pgvector's text input format is exactly a JSON array of numbers.
  return ordered.map((item) => JSON.stringify(item.embedding));
}

/* ── seed ─────────────────────────────────────────────────────────────────── */

async function findDemoUserId(): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    assertOk("listUsers", error);
    const match = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`\n🦉 Seeding the Hootly demo account into ${SUPABASE_URL}\n`);

  // ── idempotency: delete then rebuild ────────────────────────────────────
  const existing = await findDemoUserId();
  if (existing) {
    console.log(`· Found an existing ${DEMO_EMAIL} — deleting it (cascades every row).`);
    const { error } = await db.auth.admin.deleteUser(existing);
    assertOk("deleteUser", error);
  }

  // ── auth user → handle_new_user() trigger → profile + free subscription ──
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  assertOk("createUser", createError);
  const userId = created?.user?.id;
  if (!userId) throw new Error("createUser returned no user");
  console.log(`✓ Auth user ${DEMO_EMAIL} (${userId})`);

  // The trigger should have made these; be explicit so a project missing the
  // trigger still seeds cleanly rather than failing on a foreign key.
  const { data: profileRow } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profileRow) {
    assertOk(
      "profiles insert",
      (await db.from("profiles").insert({ id: userId, email: DEMO_EMAIL, is_edu: false })).error
    );
    assertOk("subscriptions insert", (await db.from("subscriptions").insert({ user_id: userId })).error);
    console.log("  (handle_new_user trigger absent — inserted profile + free subscription directly)");
  }

  assertOk(
    "profiles update",
    (
      await db
        .from("profiles")
        .update({
          display_name: DEMO_NAME,
          study_level: "college",
          user_type: "student",
          onboarding_completed_at: new Date(Date.now() - 7 * DAY_MS).toISOString(),
          referral_source: "Friend",
        })
        .eq("id", userId)
    ).error
  );
  console.log("✓ Profile: college · student · onboarding complete");

  // ── course ──────────────────────────────────────────────────────────────
  const { data: course, error: courseError } = await db
    .from("courses")
    .insert({
      user_id: userId,
      name: "BIO 172 — Human Physiology",
      emoji: "🧬",
      exam_date: dateOnly(21),
      familiarity: "some",
    })
    .select("id, name, exam_date")
    .single();
  assertOk("courses insert", courseError);
  if (!course) throw new Error("course insert returned no row");
  const courseId = course.id as string;
  console.log(`✓ Course "${course.name}" · exam ${course.exam_date} (21 days out)`);

  // ── material + chunks ───────────────────────────────────────────────────
  const { data: material, error: materialError } = await db
    .from("materials")
    .insert({
      course_id: courseId,
      user_id: userId,
      kind: "pasted",
      title: MATERIAL_TITLE,
      raw_text: RAW_TEXT,
      byte_size: Buffer.byteLength(RAW_TEXT, "utf8"),
      status: "ready",
    })
    .select("id, title")
    .single();
  assertOk("materials insert", materialError);
  if (!material) throw new Error("material insert returned no row");
  const materialId = material.id as string;

  const embeddings = await embedChunks(CHUNK_TEXTS);
  const { data: chunkRows, error: chunkError } = await db
    .from("chunks")
    .insert(
      CHUNK_TEXTS.map((content, idx) => ({
        material_id: materialId,
        course_id: courseId,
        user_id: userId,
        idx,
        content,
        // Pasted text has no page or timestamp locator — inventing one would be a
        // fake citation, so source chips render as "📄 {material}" with no locator.
        page: null,
        start_seconds: null,
        end_seconds: null,
        embedding: embeddings?.[idx] ?? null,
        token_count: Math.round(content.split(/\s+/).length * 1.3),
      }))
    )
    .select("id, idx");
  assertOk("chunks insert", chunkError);

  const chunkIds: string[] = [];
  for (const row of chunkRows ?? []) chunkIds[row.idx as number] = row.id as string;
  const chunkIdsFor = (idxs: number[]): string[] =>
    idxs.map((i) => chunkIds[i]).filter((id): id is string => Boolean(id));

  console.log(
    `✓ Material "${MATERIAL_TITLE}" · ${CHUNK_TEXTS.length} chunks · ${
      embeddings
        ? `embeddings GENERATED with ${EMBED_MODEL} (OPENAI_API_KEY present)`
        : "embeddings NULL (no OPENAI_API_KEY — the tutor's vector search will find nothing until you re-seed with a key)"
    }`
  );

  // ── note + sections ─────────────────────────────────────────────────────
  const { data: note, error: noteError } = await db
    .from("notes")
    .insert({
      course_id: courseId,
      user_id: userId,
      title: "Unit 3 — Metabolism",
      depth: "standard",
      topic_mode: false,
      status: "ready",
    })
    .select("id")
    .single();
  assertOk("notes insert", noteError);
  if (!note) throw new Error("note insert returned no row");
  const noteId = note.id as string;

  assertOk(
    "note_sections insert",
    (
      await db.from("note_sections").insert(
        NOTE_SECTIONS.map((section, idx) => ({
          note_id: noteId,
          user_id: userId,
          idx,
          heading: section.heading,
          body_md: section.body_md,
          source_chunk_ids: chunkIdsFor(section.chunks),
          grounded: true,
        }))
      )
    ).error
  );
  console.log(`✓ Note "Unit 3 — Metabolism" · ${NOTE_SECTIONS.length} cited sections`);

  // ── flashcards + card_reviews ───────────────────────────────────────────
  const simulated = CARD_SPECS.map((spec) => ({ spec, sim: simulate(spec.state, spec.dueInDays) }));

  const { data: cardRows, error: cardError } = await db
    .from("flashcards")
    .insert(
      simulated.map(({ spec, sim }) => ({
        course_id: courseId,
        user_id: userId,
        kind: "basic",
        front: spec.front,
        back: spec.back,
        source_chunk_ids: chunkIdsFor(spec.chunks),
        favorited: spec.favorited ?? false,
        suspended: false,
        ...sim.row,
      }))
    )
    .select("id, front");
  assertOk("flashcards insert", cardError);

  const cardIdByFront = new Map<string, string>();
  for (const row of cardRows ?? []) cardIdByFront.set(row.front as string, row.id as string);

  const reviewRows = simulated.flatMap(({ spec, sim }) => {
    const cardId = cardIdByFront.get(spec.front);
    if (!cardId) return [];
    return sim.reviews.map((review) => ({
      card_id: cardId,
      user_id: userId,
      rating: review.rating,
      reviewed_at: review.at.toISOString(),
      elapsed_ms: review.elapsed_ms,
    }));
  });
  if (reviewRows.length > 0) {
    assertOk("card_reviews insert", (await db.from("card_reviews").insert(reviewRows)).error);
  }

  const stateCounts = simulated.reduce<Record<string, number>>((acc, { sim }) => {
    const key = uiState(sim.row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const dueNow = simulated.filter(({ sim }) => new Date(sim.row.fsrs_due).getTime() <= Date.now()).length;
  console.log(
    `✓ ${CARD_SPECS.length} flashcards · Learning ${stateCounts["Learning"] ?? 0} · Reviewing ${
      stateCounts["Reviewing"] ?? 0
    } · Mastered ${stateCounts["Mastered"] ?? 0} · ${dueNow} due now · ${reviewRows.length} card_reviews`
  );

  // ── quiz + questions + completed attempt ────────────────────────────────
  const { data: quiz, error: quizError } = await db
    .from("quizzes")
    .insert({
      course_id: courseId,
      user_id: userId,
      kind: "quiz",
      title: "Unit 3 checkpoint",
      topic: "Cellular respiration",
      topic_mode: false,
      status: "ready",
    })
    .select("id")
    .single();
  assertOk("quizzes insert", quizError);
  if (!quiz) throw new Error("quiz insert returned no row");
  const quizId = quiz.id as string;

  const { data: questionRows, error: questionError } = await db
    .from("quiz_questions")
    .insert(
      QUESTION_SPECS.map((q, idx) => ({
        quiz_id: quizId,
        user_id: userId,
        idx,
        qtype: q.qtype,
        topic: q.topic,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        source_chunk_ids: chunkIdsFor(q.chunks),
        difficulty: q.difficulty,
      }))
    )
    .select("id, idx");
  assertOk("quiz_questions insert", questionError);

  const questionIds: string[] = [];
  for (const row of questionRows ?? []) questionIds[row.idx as number] = row.id as string;

  const correctCount = QUESTION_SPECS.filter((q) => q.given === q.answer).length;
  const scorePct = Math.round((correctCount / QUESTION_SPECS.length) * 100);

  const { data: attempt, error: attemptError } = await db
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      user_id: userId,
      started_at: daysFromNow(-1).toISOString(),
      completed_at: new Date(daysFromNow(-1).getTime() + 11 * 60_000).toISOString(),
      auto_add_misses: true,
      score_pct: scorePct,
    })
    .select("id")
    .single();
  assertOk("quiz_attempts insert", attemptError);
  if (!attempt) throw new Error("quiz_attempt insert returned no row");

  assertOk(
    "attempt_answers insert",
    (
      await db.from("attempt_answers").insert(
        QUESTION_SPECS.flatMap((q, idx) => {
          const questionId = questionIds[idx];
          if (!questionId) return [];
          return [
            {
              attempt_id: attempt.id as string,
              question_id: questionId,
              user_id: userId,
              answer: q.given,
              is_correct: q.given === q.answer,
              flagged: false,
              answered_at: new Date(daysFromNow(-1).getTime() + (idx + 1) * 60_000).toISOString(),
            },
          ];
        })
      )
    ).error
  );
  console.log(
    `✓ Quiz "Unit 3 checkpoint" · ${QUESTION_SPECS.length} questions (mcq/true_false/fill_blank/short_answer) · 1 completed attempt scoring ${scorePct}%`
  );

  // ── tutor thread ────────────────────────────────────────────────────────
  const { data: thread, error: threadError } = await db
    .from("chat_threads")
    .insert({
      course_id: courseId,
      user_id: userId,
      title: "Why does FADH₂ make less ATP?",
      socratic: false,
    })
    .select("id")
    .single();
  assertOk("chat_threads insert", threadError);
  if (!thread) throw new Error("chat_thread insert returned no row");

  const citationChunkId = chunkIds[5];
  assertOk(
    "chat_messages insert",
    (
      await db.from("chat_messages").insert([
        {
          thread_id: thread.id as string,
          user_id: userId,
          role: "user",
          content_md: "Why does FADH₂ end up producing less ATP than NADH?",
          citations: [],
          used_general_knowledge: false,
          created_at: daysFromNow(-2).toISOString(),
        },
        {
          thread_id: thread.id as string,
          user_id: userId,
          role: "assistant",
          content_md:
            "It comes down to *where* each carrier hands its electrons to the chain.\n\nNADH donates at **Complex I**, but FADH₂ donates at **Complex II**, which sits further downstream. That means FADH₂'s electrons skip one of the proton-pumping sites, so fewer protons cross into the intermembrane space per pair of electrons — and fewer protons means less ATP from chemiosmosis.\n\nThe working numbers from your notes are about **2.5 ATP per matrix NADH** and about **1.5 per FADH₂**.",
          citations: citationChunkId
            ? [
                {
                  chunk_id: citationChunkId,
                  material_title: MATERIAL_TITLE,
                  page: null,
                  start_seconds: null,
                },
              ]
            : [],
          used_general_knowledge: false,
          created_at: new Date(daysFromNow(-2).getTime() + 20_000).toISOString(),
        },
        {
          thread_id: thread.id as string,
          user_id: userId,
          role: "user",
          content_md: "So is the 36–38 ATP number in my old textbook just wrong?",
          citations: [],
          used_general_knowledge: false,
          created_at: new Date(daysFromNow(-2).getTime() + 120_000).toISOString(),
        },
        {
          thread_id: thread.id as string,
          user_id: userId,
          role: "assistant",
          content_md:
            "Outdated rather than wrong-headed. Your material puts the realistic figure at **30–32 ATP** per glucose for two reasons: the H⁺-to-ATP ratio isn't a whole number, and cytosolic NADH has to be shuttled into the mitochondrion at a cost — the glycerol phosphate shuttle even downgrades it to FADH₂ on the way in.",
          citations: chunkIds[7]
            ? [
                {
                  chunk_id: chunkIds[7],
                  material_title: MATERIAL_TITLE,
                  page: null,
                  start_seconds: null,
                },
              ]
            : [],
          used_general_knowledge: false,
          created_at: new Date(daysFromNow(-2).getTime() + 140_000).toISOString(),
        },
      ])
    ).error
  );
  console.log("✓ Tutor thread · 4 messages, 2 of them carrying citations");

  // ── study plan ──────────────────────────────────────────────────────────
  assertOk(
    "study_plan_items insert",
    (
      await db.from("study_plan_items").insert(
        PLAN_SPECS.map((item, idx) => ({
          course_id: courseId,
          user_id: userId,
          idx,
          title: item.title,
          kind: item.kind,
          topic: item.topic,
          target_id: item.target === "note" ? noteId : item.target === "quiz" ? quizId : null,
          due_date: dateOnly(item.dueInDays),
          completed_at: item.completed
            ? daysFromNow(item.dueInDays).toISOString()
            : null,
        }))
      )
    ).error
  );
  const completedItems = PLAN_SPECS.filter((i) => i.completed).length;
  console.log(
    `✓ Study plan · ${PLAN_SPECS.length} items across three weeks · ${completedItems} completed`
  );

  // ── usage counters ──────────────────────────────────────────────────────
  // `courses` is a LIVE count (docs/04 §5), so it has no counter row.
  const monthBucket = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-01`;
  assertOk(
    "usage_counters insert",
    (
      await db.from("usage_counters").insert([
        { user_id: userId, metric: "uploads", period_start: "1970-01-01", count: 1 },
        { user_id: userId, metric: "cards_generated", period_start: "1970-01-01", count: CARD_SPECS.length },
        { user_id: userId, metric: "quizzes_generated", period_start: "1970-01-01", count: 1 },
        { user_id: userId, metric: "tutor_messages", period_start: monthBucket, count: 2 },
      ])
    ).error
  );
  console.log(
    `✓ Usage counters · uploads 1/3 · cards 25/50 · quizzes 1/2 · tutor messages 2/20 this month`
  );

  /* ── summary ─────────────────────────────────────────────────────────── */
  console.log(
    [
      "",
      "─────────────────────────────────────────────────────────────",
      "  Demo account ready.",
      "",
      `  Email:    ${DEMO_EMAIL}`,
      `  Password: ${DEMO_PASSWORD}`,
      "",
      "  Hootly has no password login in v1 (magic link + Google only), so sign in",
      "  with the magic link for this address, or use these credentials directly",
      "  against the Supabase auth API in a script or test.",
      "",
      `  Course:    BIO 172 — Human Physiology (exam ${dateOnly(21)})`,
      `  Material:  1 pasted · ${CHUNK_TEXTS.length} chunks · embeddings ${embeddings ? "present" : "NULL"}`,
      `  Note:      1 · ${NOTE_SECTIONS.length} sections, all citing real chunks`,
      `  Cards:     ${CARD_SPECS.length} · Learning ${stateCounts["Learning"] ?? 0} / Reviewing ${
        stateCounts["Reviewing"] ?? 0
      } / Mastered ${stateCounts["Mastered"] ?? 0} · ${dueNow} due right now`,
      `  Reviews:   ${reviewRows.length} card_reviews replayed through ts-fsrs`,
      `  Quiz:      1 · ${QUESTION_SPECS.length} questions · attempt scored ${scorePct}%`,
      "  Tutor:     1 thread · 4 messages · 2 with citations",
      `  Plan:      ${PLAN_SPECS.length} items · ${completedItems} completed`,
      `  Course id: ${courseId}`,
      "─────────────────────────────────────────────────────────────",
      "",
    ].join("\n")
  );
}

main().catch((error: unknown) => {
  console.error("\n✖ Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
