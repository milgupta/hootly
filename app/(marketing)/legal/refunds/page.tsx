// TEMPLATE — ATTORNEY REVIEW BEFORE LAUNCH.
// Plain-English refund and cancellation policy (docs/05 §11.5, docs/07 §1.3–1.4).
// Sections 2 and 3 hard-code two of our six standing commitments (7-day full refund,
// self-serve; cancel anytime effective end of period) — do not soften them in review.
// Counsel should confirm: EU/UK statutory withdrawal rights for digital services and
// the waiver wording, auto-renewal disclosure rules for California and similar states,
// and the chargeback language.

import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalDoc,
  LegalSection,
  LegalP,
  LegalList,
  LegalCommitment,
} from "../../_components/Legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Refund a Hootly Plus charge yourself within 7 days, in full, no questions. Cancel in two clicks, effective at the end of the period you already paid for.",
};

export default function RefundsPage() {
  return (
    <LegalDoc title="Refund Policy" updated="August 6, 2026">
      <LegalSection title="1. The short version">
        <LegalP>
          Within 7 days of a charge you can refund it yourself, in full, without asking
          anyone. After that you can cancel any time and keep Plus until the period you
          paid for runs out. Nothing you made is ever deleted because of a refund or a
          cancellation.
        </LegalP>
      </LegalSection>

      <LegalSection title="2. The 7-day refund">
        <LegalCommitment label="Commitment — 7-day full refund, self-serve">
          For 7 days after any Hootly Plus charge, Settings → Billing shows a refund
          button. Pressing it refunds the full amount immediately. No explanation, no
          support ticket, no human approval, and no partial-refund arithmetic.
        </LegalCommitment>
        <LegalList
          items={[
            "It applies to every Plus charge — monthly, annual, and every renewal of either.",
            "The refund is issued to your original payment method. Your bank usually posts it within 5–10 business days; the timing after that point is theirs, not ours.",
            "Refunding also cancels the subscription immediately and returns your account to the free plan.",
            "Your courses, notes, flashcards, quizzes and materials all stay exactly where they are. Free-plan limits gate creating new things, never opening old ones.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How to cancel">
        <LegalCommitment label="Commitment — cancel anytime, effective end of period">
          Step one: Settings → Billing → &#8220;Manage billing.&#8221; Step two: in the
          Stripe portal, &#8220;Cancel subscription.&#8221; That is the whole process. No
          retention offers, no phone tree, no &#8220;email us to cancel.&#8221;
        </LegalCommitment>
        <LegalP>
          Cancelling takes effect at the end of the period you have already paid for, so
          you keep Plus until then and are not charged again. You can resubscribe at any
          time, and everything is where you left it.
        </LegalP>
      </LegalSection>

      <LegalSection title="4. After the 7 days">
        <LegalP>
          Outside the 7-day window we don&#8217;t refund part-used periods as a matter of
          course — cancel and you keep Plus for the rest of the period you paid for.
          There are exceptions we always honour, though:
        </LegalP>
        <LegalList
          items={[
            "Duplicate charges.",
            "Charges taken after a cancellation had already taken effect.",
            "Charges caused by a bug on our side.",
            "An extended outage that stopped you using what you paid for.",
          ]}
        />
        <LegalP>
          Email support@hootly.app in any of those cases and we will sort it out, usually
          the same day. If your local consumer law gives you a stronger right to a
          refund, that law wins over this section.
        </LegalP>
      </LegalSection>

      <LegalSection title="5. Annual plans">
        <LegalP>
          Annual is a single charge of $83.88, which works out to $6.99 a month. The
          7-day refund window opens at the original charge and again at every renewal, so
          a renewal you didn&#8217;t want is always fully refundable for a week. Stripe
          emails a receipt each time it charges you.
        </LegalP>
      </LegalSection>

      <LegalSection title="6. The .edu discount">
        <LegalP>
          If your account email ends in .edu, 20% comes off automatically. Refunds return
          what you actually paid, discount included.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. The free plan">
        <LegalP>
          There is nothing to refund on the free plan because there is nothing to pay. It
          never asks for a card, it does not expire, and its limits are published on the{" "}
          <Link href="/pricing" className="focus-ring rounded font-semibold text-primary hover:underline">
            pricing page
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalSection title="8. Failed payments">
        <LegalP>
          If a payment fails, everything keeps working for 7 days while Stripe retries the
          card, and we email you so you can update it. If it never goes through, the
          account simply returns to the free plan. There is no debt collection and nothing
          you made gets locked.
        </LegalP>
      </LegalSection>

      <LegalSection title="9. Chargebacks">
        <LegalP>
          Please use the refund button first — it is faster than your bank and it costs
          you nothing. If you do open a chargeback we may suspend the subscription while
          the dispute runs, and we will respond to your bank with the account records.
        </LegalP>
      </LegalSection>

      <LegalSection title="10. Contact">
        <LegalP>
          support@hootly.app. The rest of the commercial terms live in our{" "}
          <Link href="/legal/terms" className="focus-ring rounded font-semibold text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
