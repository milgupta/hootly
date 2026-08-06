// TEMPLATE — ATTORNEY REVIEW BEFORE LAUNCH.
// Plain-English SaaS terms in a Termly-style section structure (docs/05 §11.5).
// Sections 4, 5, 6 and 10 hard-code five of our six standing commitments (published
// free-tier limits; cancel anytime effective end of period; 7-day self-serve refund;
// content never used to train AI models; 30-day recovery then permanent deletion;
// self-serve GDPR/CCPA export + delete). Do not soften them in review — they are the
// product promise (docs/00 §"Non-negotiable product rules"). Counsel should still
// confirm: governing law and venue, arbitration/class-action terms, consumer-law
// carve-outs per launch jurisdiction, and the liability cap.

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
  title: "Terms of Service",
  description:
    "The plain-English terms for using Hootly, including our published free-tier limits, cancellation, refunds, and the promise never to train AI models on your content.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="August 6, 2026">
      <LegalSection title="1. Agreement to these terms">
        <LegalP>
          These terms are the agreement between you and Hootly (&#8220;Hootly&#8221;,
          &#8220;we&#8221;, &#8220;us&#8221;) covering hootly.app and everything in it
          (the &#8220;Service&#8221;). By creating an account or using the Service you
          agree to them. If you don&#8217;t agree, please don&#8217;t use the Service.
        </LegalP>
        <LegalP>
          If you are under 18 you may use Hootly only with the involvement of a parent,
          guardian, or school that agrees to these terms on your behalf. The Service is
          not directed to children under 13 and we do not knowingly create accounts for
          them.
        </LegalP>
      </LegalSection>

      <LegalSection title="2. What Hootly does">
        <LegalP>
          You upload course materials — documents, slides, recordings, links, typed
          notes. Hootly reads them and builds study materials from them: notes with
          citations, flashcards on a spaced-repetition schedule, quizzes and practice
          exams, a study plan, and a tutor that answers questions about your materials.
          Generated content is produced by AI models; section 9 explains what that
          means for you.
        </LegalP>
      </LegalSection>

      <LegalSection title="3. Your account">
        <LegalList
          items={[
            "You need an account. We use Google sign-in or an emailed magic link, so there is no password to lose or reset.",
            "Keep your email account secure — anyone with access to it can access your Hootly account.",
            "One account per person. Don’t share logins or resell access.",
            "Give us accurate information, including an email address we can actually reach you at.",
            "Email support@hootly.app if you think someone else has accessed your account.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Plans, limits, and what “free” means">
        <LegalCommitment label="Commitment — published limits">
          The free plan&#8217;s limits are published in full on our pricing page and are
          metered inside the app before you take any action that would hit one. We will
          not enforce a limit against you that we have not published.
        </LegalCommitment>
        <LegalP>
          At the time of writing, the free plan includes: 1 active course (deleting a
          course frees the slot), 3 file uploads in total, 50 AI-generated flashcards in
          total, 2 AI quizzes in total, 20 tutor messages per calendar month, and audio
          or video files up to 30 minutes each. Flashcards you write yourself are
          unlimited and never count against a limit. The current, authoritative list is
          always on the{" "}
          <Link href="/pricing" className="focus-ring rounded font-semibold text-primary hover:underline">
            pricing page
          </Link>
          .
        </LegalP>
        <LegalP>
          If we change free-plan limits, accounts that already exist keep the previous
          limits for at least 30 days after we email you about the change.
        </LegalP>
        <LegalP>
          Reaching a limit never deletes anything and never blocks access to work you
          have already made. Limits gate creating new things only.
        </LegalP>
      </LegalSection>

      <LegalSection title="5. Paid plans, billing, and cancellation">
        <LegalList
          items={[
            "Hootly Plus is $12.99 per month billed monthly, or $83.88 per year billed annually (which works out to $6.99 per month). Prices are in US dollars and exclude any taxes we are required to collect.",
            "Payments are processed by Stripe. We never see or store your full card number.",
            "Subscriptions renew automatically at the end of each period until you cancel.",
            "Students with a .edu email address get 20% off automatically — we apply it at checkout, and you never have to find or type a code.",
            "If a payment fails, everything keeps working for 7 days while Stripe retries, and we email you.",
            "There is no free trial that converts into a charge. The free plan is the trial, and it never asks for a card.",
          ]}
        />
        <LegalCommitment label="Commitment — cancel anytime, effective end of period">
          You can cancel at any time from Settings → Billing → Manage billing → Cancel
          subscription. Two clicks. Cancellation takes effect at the end of the period
          you have already paid for, and you keep Plus until then. There is no retention
          flow, no phone call, and no email required.
        </LegalCommitment>
        <LegalCommitment label="Commitment — 7-day full refund, self-serve">
          Within 7 days of any charge you can refund that charge yourself from Settings
          → Billing. It is the full amount, it requires no explanation, and no human has
          to approve it. See our{" "}
          <Link href="/legal/refunds" className="focus-ring rounded font-semibold text-primary hover:underline">
            Refund Policy
          </Link>{" "}
          for the details.
        </LegalCommitment>
        <LegalP>
          When a paid plan ends, your account returns to the free plan. Nothing you made
          is locked or deleted — free limits apply to creating new things, never to
          opening, reading, or reviewing what already exists.
        </LegalP>
      </LegalSection>

      <LegalSection title="6. Your content">
        <LegalP>
          You own your content: the files you upload, the text you paste, and the notes,
          cards, quizzes and tutor conversations generated from them (together,
          &#8220;Your Content&#8221;). We claim no ownership of any of it.
        </LegalP>
        <LegalP>
          You grant us a limited licence to host, store, copy, transmit and process Your
          Content — including sending it to the AI providers listed in our Privacy
          Policy — solely to operate the Service for you. That licence exists so the
          product can run, and it ends when you delete the content or your account.
        </LegalP>
        <LegalCommitment label="Commitment — never used to train AI models">
          Your Content is never used to train, fine-tune, or improve any AI model — ours
          or anyone else&#8217;s. Our AI providers are contractually bound to the same
          restriction. We do not sell Your Content and we do not share it with other
          users. There is no setting to change, because there is no other mode.
        </LegalCommitment>
        <LegalP>
          You are responsible for having the right to upload what you upload. Please
          don&#8217;t upload material you have no permission to use, and don&#8217;t
          upload other people&#8217;s personal or confidential information.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <LegalP>Don&#8217;t use Hootly to:</LegalP>
        <LegalList
          items={[
            "break the law, or infringe anyone’s intellectual property or privacy;",
            "upload malware, or attempt to breach, overload, scrape, or reverse-engineer the Service;",
            "resell, sublicense, or hand the Service to people outside your account;",
            "generate content that is unlawful, or that harasses, defrauds, or endangers anyone;",
            "circumvent plan limits, usage metering, or payment.",
          ]}
        />
        <LegalP>
          We may suspend accounts doing these things. Where the situation allows,
          we&#8217;ll warn you first and give you a chance to put it right.
        </LegalP>
      </LegalSection>

      <LegalSection title="8. Academic integrity">
        <LegalP>
          Hootly is a study tool and is deliberately not a homework machine. The tutor is
          built to explain, quiz, and guide rather than to produce work you would hand
          in, and it redirects requests to write graded work for you. You remain
          responsible for following your school&#8217;s academic-integrity rules.
          Submitting AI output as your own work may break them, and that is your call
          and your risk.
        </LegalP>
      </LegalSection>

      <LegalSection title="9. AI output: what to expect">
        <LegalP>
          Notes, cards, quizzes, exams and tutor answers are generated by AI models from
          your materials. They carry citations to the pages and timestamps they came
          from, so you can check them — and you should. AI output can still be
          incomplete or wrong. Hootly flags content it could not verify against your
          materials, and says so explicitly when an answer comes from general knowledge
          rather than your uploads. Hootly is not a substitute for your instructor, and
          it does not provide medical, legal, or financial advice.
        </LegalP>
      </LegalSection>

      <LegalSection title="10. Deleting content and your account">
        <LegalCommitment label="Commitment — 30 days to change your mind, then it’s gone">
          Deleted courses, notes, cards, quizzes and materials go to Trash and stay
          recoverable for 30 days. After 30 days they are permanently deleted from our
          production systems, and they age out of encrypted backups within a further 30
          days. Deleting your account starts the same 30-day grace period for everything
          in it, and then permanently deletes it.
        </LegalCommitment>
        <LegalCommitment label="Commitment — export and delete are self-serve">
          Settings → Privacy lets you download everything you have made, and Settings →
          Account lets you delete your account — both without contacting support. Our{" "}
          <Link href="/legal/privacy" className="focus-ring rounded font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          explains how this satisfies your rights under the GDPR and the CCPA/CPRA.
        </LegalCommitment>
      </LegalSection>

      <LegalSection title="11. Our intellectual property">
        <LegalP>
          Hootly, the Ollie character, our name, logo, interface, and software are ours.
          These terms don&#8217;t give you the right to copy or reuse them beyond using
          the Service normally. Feedback and suggestions you send us are something we may
          use freely and without obligation.
        </LegalP>
      </LegalSection>

      <LegalSection title="12. Third-party services">
        <LegalP>
          The Service runs on third parties for hosting, storage, payments, AI
          generation, background jobs, email, analytics and error monitoring. They are
          all listed in our Privacy Policy. We are responsible for choosing them
          carefully and binding them to protect your data; we are not responsible for
          their own separate products, or for websites you reach through links inside
          your own materials.
        </LegalP>
      </LegalSection>

      <LegalSection title="13. Changes to the Service and these terms">
        <LegalP>
          We will keep building, so features may be added, changed, or removed. If we
          change these terms in a way that materially affects you, we&#8217;ll email you
          at least 30 days before the change takes effect, and you can cancel before it
          does. Changes to free-plan limits follow section 4.
        </LegalP>
      </LegalSection>

      <LegalSection title="14. Termination">
        <LegalP>
          You can stop using Hootly and delete your account at any time. We may suspend
          or terminate an account that breaks these terms, that we are legally required
          to close, or that has been inactive for more than 24 months — and in the last
          case we&#8217;ll email you first. If we terminate an account without cause,
          we&#8217;ll refund the unused portion of the paid period. Sections 6, 9, 11,
          15, 16, 17 and 18 survive termination.
        </LegalP>
      </LegalSection>

      <LegalSection title="15. Disclaimers">
        <LegalP>
          The Service is provided &#8220;as is&#8221; and &#8220;as available&#8221;. To
          the fullest extent the law allows, we disclaim implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We do
          not warrant that the Service will be uninterrupted or error-free, or that AI
          output will be accurate or complete. Some jurisdictions don&#8217;t allow these
          exclusions, in which case they don&#8217;t apply to you.
        </LegalP>
      </LegalSection>

      <LegalSection title="16. Limitation of liability">
        <LegalP>
          To the fullest extent the law allows, neither we nor our suppliers are liable
          for indirect, incidental, special, consequential or punitive damages, or for
          lost profits, lost data, or academic outcomes. Our total liability for any
          claim relating to the Service is limited to the greater of $50 or the amount
          you paid us in the 12 months before the claim. Nothing here limits liability
          that cannot lawfully be limited.
        </LegalP>
      </LegalSection>

      <LegalSection title="17. Indemnity">
        <LegalP>
          You will defend and indemnify us against third-party claims arising from
          content you upload or from your use of the Service in breach of these terms.
        </LegalP>
      </LegalSection>

      <LegalSection title="18. Governing law and disputes">
        <LegalP>
          These terms are governed by the laws of the State of Delaware, USA, without
          regard to its conflict-of-law rules, and the courts located there have
          exclusive jurisdiction — except where the mandatory consumer-protection law of
          your home country gives you the right to bring a claim locally, which it may.
          Before any of that, please email support@hootly.app: we would far rather fix
          the problem than argue about it.
        </LegalP>
      </LegalSection>

      <LegalSection title="19. Contact">
        <LegalP>
          Hootly — support@hootly.app for anything, privacy@hootly.app for data
          requests.
        </LegalP>
      </LegalSection>
    </LegalDoc>
  );
}
