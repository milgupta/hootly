// TEMPLATE — ATTORNEY REVIEW BEFORE LAUNCH.
// Plain-English privacy policy in a Termly-style section structure (docs/05 §11.5).
// Sections 5, 8 and 9 hard-code three of our six standing commitments (content never
// used to train AI models; 30-day recovery then permanent deletion; self-serve
// GDPR/CCPA export + delete) — do not soften them in review. Counsel should confirm:
// controller entity details and any EU/UK representative, the subprocessor list and
// SCC paperwork, breach-notification wording, retention periods against local tax law,
// and whether a "Do Not Sell or Share" link is required for the launch states.

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
  title: "Privacy Policy",
  description:
    "What Hootly collects, who processes it, how long we keep it, and how to export or delete everything yourself. We never train AI models on your content.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="August 6, 2026">
      <LegalSection title="1. The short version">
        <LegalList
          items={[
            "We collect what a study app needs to work, and nothing we would be embarrassed to list on this page.",
            "We never train AI models on your content — ours or anyone else’s.",
            "You can download everything and delete everything yourself, from inside the app.",
            "Deleted things are recoverable for 30 days, then permanently deleted.",
            "Marketing email is off by default. You have to switch it on.",
            "We do not sell your personal information, and we do not share it for advertising.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Who we are">
        <LegalP>
          Hootly operates hootly.app and is the controller of the personal information
          described here. For anything in this policy, write to privacy@hootly.app.
        </LegalP>
      </LegalSection>

      <LegalSection title="3. What we collect">
        <LegalP>Information you give us:</LegalP>
        <LegalList
          items={[
            "Account details: your email address; your name and avatar if your Google account supplies them; the study level and user type you pick during onboarding; and whether your email address ends in .edu (which triggers the student discount).",
            "Your content: the files, recordings, links and pasted text you upload, and everything Hootly generates from them — notes, flashcards, quizzes, plans and tutor conversations.",
            "Billing details: Stripe holds your payment method. We store your Stripe customer ID, plan, billing interval, status and renewal date. We never see or store your full card number.",
            "Support messages: whatever you write to us, and our replies.",
          ]}
        />
        <LegalP>Information we collect automatically:</LegalP>
        <LegalList
          items={[
            "Product analytics: which screens you open and which actions you take, together with your plan and study level, so we can see where the product is failing people.",
            "Session replays, recorded with all form inputs masked.",
            "Technical logs: IP address, browser and device type, timestamps, and error traces (scrubbed of personal information before they reach our error monitoring).",
            "Cookies that are strictly necessary to keep you signed in, plus first-party analytics cookies.",
          ]}
        />
        <LegalP>
          We do not buy personal data from data brokers, and we do not collect payment
          card numbers.
        </LegalP>
      </LegalSection>

      <LegalSection title="4. How we use it">
        <LegalList
          items={[
            "To run the Service: store your materials and generate notes, cards, quizzes, plans and tutor answers from them.",
            "To keep accounts secure and prevent abuse.",
            "To process payments, apply the .edu discount, and handle refunds.",
            "To answer your support messages.",
            "To understand product usage in aggregate and fix what is broken.",
            "To send service email you need: your sign-in link, receipts, “your export is ready”, and payment failures. Marketing email is sent only if you turn the toggle on in Settings → Privacy, and it is off by default.",
          ]}
        />
        <LegalP>
          If you are in the UK or EEA, our legal bases are: performance of our contract
          with you (running the Service and billing), our legitimate interests (security,
          abuse prevention, aggregate product analytics), your consent (marketing email,
          non-essential analytics where consent is required), and compliance with legal
          obligations (tax and accounting records).
        </LegalP>
      </LegalSection>

      <LegalSection title="5. We never train AI models on your content">
        <LegalCommitment label="Commitment — never used to train AI models">
          Your materials and everything generated from them are never used to train,
          fine-tune, or improve any AI model — ours or anyone else&#8217;s. Your content
          is sent to an AI provider only to answer the request you made, and only for as
          long as answering it takes. Our providers are contractually prohibited from
          training on it. There is no setting to change, because there is no other mode.
        </LegalCommitment>
      </LegalSection>

      <LegalSection title="6. Who we share it with">
        <LegalP>
          We use a small set of processors, each bound by contract to protect your data
          and to use it only for the service they provide us:
        </LegalP>
        <LegalList
          items={[
            "Supabase — database, authentication, and file storage.",
            "Vercel — application hosting and content delivery.",
            "OpenAI — AI generation and embeddings, under an agreement that prohibits training on our data.",
            "Inngest — background job orchestration (ingestion and generation).",
            "Stripe — payments, invoices, subscription management, and refunds.",
            "Resend — transactional email (sign-in links, export-ready notices, payment failures).",
            "PostHog — product analytics and session replay, with form inputs masked.",
            "Sentry — error monitoring, with personal information scrubbed.",
          ]}
        />
        <LegalP>
          We may also disclose information if the law requires it, to protect our rights
          or someone&#8217;s safety, or as part of a merger or acquisition — in which
          case we will tell you before your information moves to a new controller.
        </LegalP>
        <LegalP>
          We do not sell personal information, and we do not share it for cross-context
          behavioural advertising, as those terms are defined by the CCPA/CPRA.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. Where your data lives">
        <LegalP>
          Our infrastructure and our processors are located in the United States. If you
          are in the UK or EEA, transfers of your personal information out of your region
          rely on the European Commission&#8217;s Standard Contractual Clauses (and the
          UK Addendum where relevant), together with the technical measures described in
          section 11.
        </LegalP>
      </LegalSection>

      <LegalSection title="8. How long we keep it">
        <LegalCommitment label="Commitment — 30 days to recover, then permanent deletion">
          Deleted courses, notes, cards, quizzes and materials sit in Trash and are fully
          recoverable for 30 days. After that they are permanently deleted from our
          production systems, and they age out of encrypted backups within a further 30
          days. Deleting your account starts the same 30-day grace period, after which
          everything in it is permanently deleted.
        </LegalCommitment>
        <LegalList
          items={[
            "Your content: kept while your account is open, then per the commitment above.",
            "Account records: kept until you delete your account.",
            "Product analytics: retained at event level for up to 12 months, then aggregated.",
            "Billing and tax records: retained for as long as tax and accounting law requires, typically seven years. These records contain amounts and dates, not your study content.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Your rights, and how to use them">
        <LegalCommitment label="Commitment — export and delete are self-serve">
          You never have to email us to get your data out or to delete it. Settings →
          Privacy → &#8220;Download everything&#8221; emails you a link to a zip of your
          notes, cards and files. Settings → Account → &#8220;Delete account&#8221;
          deletes everything after the 30-day grace period. Both are self-serve, and
          neither needs a human to approve it.
        </LegalCommitment>
        <LegalP>
          If you are in the UK or EEA, you have the right to access, correct, delete,
          restrict or object to processing of your personal information, the right to
          data portability, the right to withdraw consent at any time, and the right to
          complain to your local supervisory authority.
        </LegalP>
        <LegalP>
          If you are in California, you have the right to know what we collect and why,
          to delete it, to correct it, to opt out of sale or sharing (we do neither), to
          limit the use of sensitive personal information (we use it only to provide the
          Service), and not to be discriminated against for exercising any of these
          rights — and we won&#8217;t.
        </LegalP>
        <LegalP>
          The in-app tools above satisfy access, portability and erasure immediately. For
          anything else, email privacy@hootly.app. We respond within 30 days under the
          GDPR and within 45 days under the CCPA/CPRA. You may use an authorised agent;
          we will ask for proof of their authority.
        </LegalP>
      </LegalSection>

      <LegalSection title="10. Cookies">
        <LegalP>
          We use cookies that are strictly necessary to keep you signed in, and
          first-party analytics cookies that tell us which parts of the product people
          use. We do not use advertising cookies and we do not embed third-party ad
          trackers. You can clear or block cookies in your browser, though signing in
          will stop working without the necessary ones.
        </LegalP>
      </LegalSection>

      <LegalSection title="11. Security">
        <LegalP>
          Data is encrypted in transit and at rest. Database access is governed by
          row-level security so one account cannot read another&#8217;s rows. Internal
          access follows least privilege, error reports are scrubbed of personal
          information, and the production database has point-in-time recovery enabled. No
          system is perfect; if a breach affects your personal information we will notify
          you and the relevant regulators as the law requires.
        </LegalP>
      </LegalSection>

      <LegalSection title="12. Children">
        <LegalP>
          Hootly is not directed to children under 13 and we do not knowingly collect
          their personal information. If you are under 18, use Hootly only with the
          involvement of a parent, guardian, or school. If we learn we have collected
          information from a child under 13, we delete it.
        </LegalP>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <LegalP>
          If this policy changes we will update the date at the top, and for changes that
          materially affect you we will email you before they take effect.
        </LegalP>
      </LegalSection>

      <LegalSection title="14. Contact">
        <LegalP>
          privacy@hootly.app for data requests, support@hootly.app for everything else.
          Our{" "}
          <Link href="/legal/terms" className="focus-ring rounded font-semibold text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          cover the rest of the relationship.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
