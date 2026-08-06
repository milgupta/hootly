import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PricingPlans } from "../_components/PricingPlans";
import { Faq, type FaqItem } from "../_components/Faq";

/**
 * /pricing — docs/05 §2. Limit semantics are doc 04 §5; prices are doc 07 §1.1.
 * The published-limits table IS the marketing: every row below is a real limit
 * enforced by lib/billing/limits.ts. No number on this page is decorative.
 */

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Every Hootly limit, published. Free forever with real limits, or Plus at $6.99/mo billed annually. Cancel in two clicks, 7-day self-serve refund.",
};

type Cell = string | true | false;

const TABLE: ReadonlyArray<{
  group: string;
  rows: ReadonlyArray<{ feature: string; note?: string; free: Cell; plus: Cell }>;
}> = [
  {
    group: "Limits",
    rows: [
      {
        feature: "Active courses",
        note: "Live count — delete a course and the slot frees up.",
        free: "1",
        plus: "Unlimited",
      },
      {
        feature: "File uploads",
        note: "Lifetime total. Files, pasted notes, YouTube links and Quizlet imports each count once.",
        free: "3",
        plus: "Unlimited",
      },
      {
        feature: "AI-generated flashcards",
        note: "Lifetime total, counted when cards are generated.",
        free: "50",
        plus: "Unlimited",
      },
      {
        feature: "Flashcards you write yourself",
        note: "Manual cards never consume quota.",
        free: "Unlimited",
        plus: "Unlimited",
      },
      {
        feature: "AI quizzes and practice exams",
        note: "Lifetime total.",
        free: "2",
        plus: "Unlimited",
      },
      {
        feature: "Tutor messages",
        note: "Monthly bucket, resets on the 1st.",
        free: "20 / month",
        plus: "Unlimited",
      },
      {
        feature: "Audio and video length",
        note: "Per file.",
        free: "Up to 30 min",
        plus: "No cap",
      },
      {
        feature: "Your onboarding study set",
        note: "The first build and its warm-up quiz don’t count against your free flashcard or quiz limits.",
        free: "Free",
        plus: "Free",
      },
    ],
  },
  {
    group: "Study tools",
    rows: [
      { feature: "Cited notes with page numbers and timestamps", free: true, plus: true },
      { feature: "Spaced-repetition review (FSRS)", free: true, plus: true },
      { feature: "Quizzes with the correct answer always revealed", free: true, plus: true },
      { feature: "Timed practice exams with a question palette", free: true, plus: true },
      { feature: "Tutor with inline citations and Socratic mode", free: true, plus: true },
      { feature: "Weekly study plan", free: true, plus: true },
      { feature: "Quizlet import", note: "Imported cards count toward the flashcard limit.", free: true, plus: true },
      { feature: "Lecture recording", free: false, plus: true },
      { feature: "Audio recaps", free: false, plus: true },
      { feature: "PDF export", free: false, plus: true },
      { feature: "Priority processing", free: false, plus: true },
    ],
  },
  {
    group: "Your data and your money",
    rows: [
      { feature: "We train AI models on your content", free: "Never", plus: "Never" },
      { feature: "Download everything you’ve made", free: true, plus: true },
      { feature: "Delete your account and data yourself", free: true, plus: true },
      { feature: "Trash recovery window", free: "30 days", plus: "30 days" },
      {
        feature: "Reading and reviewing what you already made",
        note: "Free limits gate making new things, never opening old ones — including after a downgrade.",
        free: "Always free",
        plus: "Always free",
      },
      { feature: "Cancel in two clicks, effective end of period", free: "—", plus: true },
      { feature: "7-day full refund, self-serve", free: "—", plus: true },
      { feature: "20% off with a .edu email", free: "—", plus: true },
    ],
  },
];

const BILLING_FAQ: FaqItem[] = [
  {
    q: "How do I cancel?",
    a: "Two steps. One: in Hootly, go to Settings → Billing and press “Manage billing.” Two: in the Stripe portal that opens, press “Cancel subscription.” That’s it — no retention offers, no phone call, no email maze. Plus stays on until the end of the period you already paid for.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes, and you do it yourself. Within 7 days of a charge, Settings → Billing shows a refund button: full amount back, no questions asked, no human in the loop. After 7 days you can still cancel and keep Plus until the period ends.",
  },
  {
    q: "What happens to my work if I downgrade?",
    a: "Nothing is locked and nothing is deleted. Free limits only gate creating new things — reading your notes and reviewing every flashcard you already have stays free forever.",
  },
  {
    q: "Is there a trial that starts charging me?",
    a: "No. There is no trial to forget about and no card required to start. The free plan is the trial, and it doesn’t expire.",
  },
  {
    q: "How does the .edu discount work?",
    a: "If your account email ends in .edu, 20% comes off automatically at checkout — you never have to find or type a code.",
  },
  {
    q: "Is there a weekly plan?",
    a: "No. Monthly and annual only, and no “50% off forever” gimmick prices. The number you see is the number you pay.",
  },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <Check className="size-4 text-primary" aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="size-4 text-ink-3" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-small tabular-nums text-ink">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-20 pt-12 md:px-6 md:pt-16">
      <header className="text-center">
        <h1 className="text-h1 text-ink md:text-[34px] md:leading-[42px]">
          Simple, honest pricing.
        </h1>
        <p className="text-body mx-auto mt-3 max-w-[56ch] text-ink-2">
          Every limit is published on this page and metered inside the app before you
          hit it. Nothing here is a surprise later.
        </p>
      </header>

      <div className="mt-10">
        <PricingPlans />
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <p className="text-body text-ink">
          Students with a .edu email get 20% off automatically.
        </p>
        <p className="text-body text-ink-2">
          Cancel anytime in two clicks. 7-day full refund, self-serve, no questions.
        </p>
      </div>

      {/* -------------------------------------------------- Full comparison table */}
      <section className="mt-16">
        <h2 className="text-h1 text-ink">Every feature, every limit</h2>
        <p className="text-body reading-measure mt-3 text-ink-2">
          This table is the whole product. If a number is not on it, it is not a
          limit we enforce.
        </p>

        <div className="mt-6 overflow-x-auto rounded-card border border-border bg-surface shadow-xs">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">
              Feature and limit comparison between the Free and Plus plans
            </caption>
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th scope="col" className="text-small px-5 py-3 font-semibold text-ink">
                  Feature
                </th>
                <th scope="col" className="text-small w-[22%] px-5 py-3 text-center font-semibold text-ink">
                  Free
                </th>
                <th scope="col" className="text-small w-[22%] px-5 py-3 text-center font-semibold text-primary">
                  Plus
                </th>
              </tr>
            </thead>
            {TABLE.map((group) => (
              <tbody key={group.group}>
                <tr className="border-b border-border bg-bg-subtle">
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="text-micro px-5 py-2 uppercase text-ink-3"
                  >
                    {group.group}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.feature} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-5 py-3.5 font-normal">
                      <span className="text-body block text-ink">{row.feature}</span>
                      {row.note && (
                        <span className="text-small block text-ink-2">{row.note}</span>
                      )}
                    </th>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center">
                        <CellValue value={row.free} />
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center">
                        <CellValue value={row.plus} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------ Billing FAQ */}
      <section className="mt-16">
        <h2 className="text-h1 text-ink">Billing questions</h2>
        <div className="mt-8">
          <Faq items={BILLING_FAQ} />
        </div>
      </section>
    </div>
  );
}
