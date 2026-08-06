import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  FileText,
  Layers,
  MessagesSquare,
  MousePointerClick,
  Quote,
  Sparkles,
  Target,
  UploadCloud,
} from "lucide-react";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { FeatureTabs } from "./_components/FeatureTabs";
import { Faq, type FaqItem } from "./_components/Faq";
import { PlanCards } from "./_components/PlanCards";

/**
 * Landing page — docs/05 §1. All quoted copy is final v1 copy, used verbatim.
 *
 * NOTE — social-proof / logo strip is deliberately OMITTED (docs/05 §1 and the brand
 * rule in docs/00 §8: no fake logos, testimonials, numbers or stats). The slot below
 * the hero is reserved: add real university or press mentions here only when true.
 */

const STEPS = [
  {
    title: "1. Drop your files",
    body: "PDFs, slides, Word docs, photos of handwritten notes, audio, video, YouTube links, pasted notes, and Quizlet exports.",
    icon: UploadCloud,
  },
  {
    title: "2. Watch Ollie build your study set",
    body: "Notes, flashcards, a quiz, and a study plan — built from your actual materials while you watch it happen.",
    icon: Sparkles,
  },
  {
    title: "3. Study what actually matters",
    body: "Your plan puts the next right thing in front of you, and every card comes back just before you’d forget it.",
    icon: Target,
  },
] as const;

const TRUST = [
  {
    lead: "Real free plan",
    rest: " — limits published right on the pricing page.",
    icon: BadgeCheck,
  },
  {
    lead: "Cancel in two clicks",
    rest: " — Stripe portal, no email maze, no dark patterns.",
    icon: MousePointerClick,
  },
  {
    lead: "AI that cites its sources",
    rest: " — every note and answer links to your actual materials.",
    icon: Quote,
  },
] as const;

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Is Hootly actually free?",
    a: "Yes — the free plan is real and its limits are printed on the pricing page: 1 active course, 3 uploads, 50 AI flashcards, 2 AI quizzes, 20 tutor messages a month. You’ll never hit a wall we didn’t tell you about.",
  },
  {
    q: "Is my data used to train AI?",
    a: "No. Never. Your notes are yours.",
  },
  {
    q: "How is this different from ChatGPT?",
    a: (
      <>
        Hootly answers from <em>your</em> course materials and shows you exactly where
        every answer came from — page numbers and all. ChatGPT guesses; Ollie cites.
      </>
    ),
  },
  {
    q: "Will this do my homework for me?",
    a: "No — and that’s on purpose. Ollie teaches, quizzes, and explains, but won’t write work you’d submit as your own.",
  },
  {
    q: "How do I cancel?",
    a: "Settings → Billing → Manage billing → Cancel. Two clicks, no phone calls, no guilt trips. Refunds within 7 days are self-serve too.",
  },
  {
    q: "What can I upload?",
    a: "PDFs, PowerPoints, Word docs, photos of handwritten notes, audio and video recordings, YouTube links with captions, pasted notes, and Quizlet exports.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 md:px-6 md:pb-24 md:pt-16">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <h1 className="text-[34px] font-bold leading-[42px] tracking-[-0.02em] text-ink md:text-[44px] md:leading-[52px]">
              Turn tonight’s panic into tomorrow’s A.
            </h1>
            <p className="reading-measure mt-5 text-[16px] leading-[26px] text-ink-2">
              Upload your slides, notes, or lectures. Hootly builds your notes,
              flashcards, quizzes, and a tutor that cites its sources — in about a
              minute.
            </p>
            <Link
              href="/signup"
              className="gradient-button-depth focus-ring mt-8 inline-flex h-11 items-center justify-center rounded-ctl px-5 text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              Start studying free
            </Link>
            <p className="text-small mt-3 text-ink-2">
              Free plan · No credit card · Cancel anytime in two clicks
            </p>
          </div>

          {/* Ollie (idle blink) atop a stylized course-card mock.
              The hero glow lives on the 24px art container and is bounded by it, so it
              never runs under a paragraph — the mock itself is opaque white. */}
          <div className="relative">
            <div className="gradient-hero-glow rounded-hero px-4 pb-4 pt-20 md:px-6 md:pb-6">
            <div className="rounded-card border border-border bg-surface p-5 shadow-xs md:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-ctl bg-primary-soft text-primary">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <span className="text-h3 text-ink">BIO 172 — Human Physiology</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "Notes", icon: FileText },
                  { label: "Flashcards", icon: Layers },
                  { label: "Practice exams", icon: ClipboardCheck },
                  { label: "Tutor", icon: MessagesSquare },
                ].map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-ctl border border-border bg-bg-subtle px-3 py-2.5"
                  >
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-small text-ink">{label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-small text-ink-2">
                  Every section ends with the source it came from:
                </p>
                <span className="text-small mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-soft px-2.5 py-1 text-primary">
                  <FileText className="size-3.5" aria-hidden />
                  Lecture 4.pdf · p.12
                </span>
              </div>
            </div>
            </div>
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <OllieAnimated mode="idle" size={80} />
            </div>
          </div>
        </div>
      </section>

      {/*
        RESERVED SLOT — social-proof / university logo strip.
        Intentionally empty at launch: docs/00 §8 forbids fake logos, stats and
        testimonials. Populate only with real, verifiable mentions.
      */}

      {/* -------------------------------------------------- How it works (3 steps) */}
      <section
        id="how-it-works"
        className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 md:px-6"
      >
        <h2 className="text-h1 text-ink">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="rounded-card border border-border bg-surface p-6 shadow-xs"
            >
              <span className="flex size-10 items-center justify-center rounded-ctl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-h3 mt-4 text-ink">{title}</h3>
              <p className="text-body mt-2 text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Feature tabs */}
      <section className="border-y border-border bg-bg-subtle">
        <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
          <h2 className="text-h1 text-center text-ink">
            What Ollie builds from your materials
          </h2>
          <div className="mt-8">
            <FeatureTabs />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Trust band */}
      <section className="bg-primary-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
          <h2 className="text-h1 text-center text-ink">The honest study app.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TRUST.map(({ lead, rest, icon: Icon }) => (
              <div key={lead} className="rounded-card border border-primary-border bg-surface p-6 shadow-xs">
                <span className="flex size-10 items-center justify-center rounded-ctl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="text-body mt-4 text-ink-2">
                  <span className="font-semibold text-ink">{lead}</span>
                  {rest}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Pricing teaser */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
        <h2 className="text-h1 text-ink">Simple, honest pricing.</h2>
        <p className="text-body reading-measure mt-3 text-ink-2">
          The free plan is real and its limits are on this page and the next one.
          Plus is $6.99 a month billed annually, or $12.99 month to month.
        </p>
        <div className="mt-8">
          <PlanCards interval="annual" />
        </div>
        <Link
          href="/pricing"
          className="focus-ring mt-6 inline-flex items-center gap-1 rounded-ctl px-1 py-1 text-[15px] font-semibold text-primary transition-colors duration-150 hover:underline"
        >
          See full pricing →
        </Link>
      </section>

      {/* --------------------------------------------------------------------- FAQ */}
      <section id="faq" className="mx-auto max-w-[840px] scroll-mt-20 px-4 pb-20 md:px-6">
        <h2 className="text-h1 text-ink">Frequently asked questions</h2>
        <div className="mt-8">
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>
    </>
  );
}
