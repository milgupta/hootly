"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Meter } from "@/components/ui/Meter";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { LIMITS, limitFor } from "@/lib/billing/limits";
import type { Profile, Subscription, UsageMetric } from "@/lib/types";
import { deleteAccount, setMarketingEmails, updateProfile } from "./actions";
import { requestExport } from "@/app/(app)/settings/export-actions";

const STUDY_LEVELS: { value: string; label: string }[] = [
  { value: "college", label: "College" },
  { value: "grad", label: "Grad school" },
  { value: "high_school", label: "High school" },
  { value: "med", label: "Med school" },
  { value: "professional_cert", label: "Professional certs" },
  { value: "standardized_test", label: "Standardized tests" },
  { value: "other", label: "Other" },
];

const METRIC_LABELS: Record<UsageMetric, string> = {
  courses: "Active courses",
  uploads: "File uploads",
  cards_generated: "AI flashcards",
  quizzes_generated: "AI quizzes",
  tutor_messages: "Tutor messages",
};

export function SettingsScreen({
  initialTab,
  profile,
  subscription,
  usage,
  email,
}: {
  initialTab: "account" | "billing" | "usage" | "privacy";
  profile: Profile | null;
  subscription: Subscription | null;
  usage: Record<UsageMetric, number>;
  email: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<string>(initialTab);
  const [name, setName] = React.useState(profile?.display_name ?? "");
  const [level, setLevel] = React.useState(profile?.study_level ?? "");
  const [marketing, setMarketing] = React.useState(
    Boolean((profile as unknown as { marketing_emails?: boolean })?.marketing_emails)
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const plan = subscription?.plan === "plus" ? "plus" : "free";

  function selectTab(v: string) {
    setTab(v);
    router.replace(`/settings?tab=${v}`, { scroll: false });
  }

  function saveProfile() {
    startTransition(async () => {
      const res = await updateProfile({ displayName: name, studyLevel: level || null });
      toast(res.ok ? "Saved" : res.error ?? "Couldn't save.", { kind: res.ok ? "success" : "error" });
    });
  }

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="text-h1 mb-6">Settings</h1>
      <Tabs
        tabs={[
          { value: "account", label: "Account" },
          { value: "billing", label: "Billing" },
          { value: "usage", label: "Usage" },
          { value: "privacy", label: "Privacy" },
        ]}
        value={tab}
        onValueChange={selectTab}
      >
        {/* ACCOUNT */}
        <TabPanel value="account" className="flex flex-col gap-5 py-6">
          <Card>
            <h2 className="text-h3 mb-4">Profile</h2>
            <div className="flex flex-col gap-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              <Input label="Email" value={email} readOnly hint="Contact support to change" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="study-level" className="text-small font-medium text-ink">
                  Study level
                </label>
                <select
                  id="study-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="focus-ring h-10 rounded-ctl border border-border bg-surface px-3 text-[15px] text-ink"
                >
                  <option value="">Not set</option>
                  {STUDY_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Button onClick={saveProfile} loading={pending}>Save changes</Button>
              </div>
            </div>
          </Card>

          <Card className="border-[#F5C6C6] bg-danger-soft">
            <h2 className="text-h3 mb-1 text-danger">Danger zone</h2>
            <p className="text-body mb-4 text-ink-2">
              Delete account — deletes everything after a 30-day grace period.
            </p>
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </Card>
        </TabPanel>

        {/* BILLING */}
        <TabPanel value="billing" className="flex flex-col gap-5 py-6">
          {plan === "plus" ? (
            <Card>
              <h2 className="text-h3 mb-1">
                Plus · {subscription?.interval === "year" ? "$6.99/mo billed annually" : "$12.99/mo monthly"}
                {periodEnd && ` · renews ${periodEnd}`}
              </h2>
              {subscription?.cancel_at_period_end && (
                <p className="text-small mb-2 text-warning">
                  Cancels at period end{periodEnd ? ` (${periodEnd})` : ""} — your content stays readable forever.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action="/api/portal" method="POST">
                  <Button type="submit">Manage billing</Button>
                </form>
                <form action="/api/refund" method="POST">
                  <Button variant="ghost" type="submit" title="Full refund, no questions. Ollie will miss you.">
                    Get a refund
                  </Button>
                </form>
              </div>
              <p className="text-small mt-3 text-ink-2">
                Cancel lives in Manage billing — 2 clicks total, as advertised. Refunds within 7 days
                of a charge are self-serve: full refund, no questions. Ollie will miss you.
              </p>
            </Card>
          ) : (
            <Card className="gradient-card-sheen">
              <h2 className="text-h3 mb-1">Free plan</h2>
              <p className="text-body mb-4 text-ink-2">
                Upgrade for unlimited courses, uploads, cards, quizzes, and tutor messages.
              </p>
              <Button onClick={() => router.push("/pricing")}>See plans</Button>
              <p className="text-small mt-3 text-ink-2">
                ✓ Cancel in 2 clicks · ✓ 7-day refund · ✓ Limits never surprise you
              </p>
            </Card>
          )}
        </TabPanel>

        {/* USAGE */}
        <TabPanel value="usage" className="flex flex-col gap-5 py-6">
          <Card>
            <h2 className="text-h3 mb-4">Usage</h2>
            {plan === "plus" ? (
              <p className="text-body text-ink-2">Unlimited — go nuts.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {(Object.keys(METRIC_LABELS) as UsageMetric[]).map((metric) => {
                  const limit = limitFor("free", metric);
                  return (
                    <div key={metric}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-small font-medium text-ink">{METRIC_LABELS[metric]}</span>
                        {metric === "tutor_messages" && (
                          <span className="text-micro text-ink-3">
                            resets{" "}
                            {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <Meter used={usage[metric]} limit={limit} metric={metric} />
                    </div>
                  );
                })}
                <p className="text-small text-ink-2">
                  Free limits: {LIMITS.free.courses} active course · {LIMITS.free.uploads} uploads ·{" "}
                  {LIMITS.free.cards_generated} AI flashcards · {LIMITS.free.quizzes_generated} AI quizzes ·{" "}
                  {LIMITS.free.tutor_messages.limit} tutor messages/mo
                </p>
              </div>
            )}
          </Card>
        </TabPanel>

        {/* PRIVACY */}
        <TabPanel value="privacy" className="flex flex-col gap-5 py-6">
          <Card>
            <h2 className="text-h3 mb-1">Export your data</h2>
            <p className="text-body mb-4 text-ink-2">
              Download everything — we'll email you a link to a zip of your notes, cards, and
              files. Usually takes a few minutes.
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                startTransition(async () => {
                  const res = await requestExport();
                  toast(res.ok ? "Export started — check your email soon." : res.error ?? "Couldn't start export.", {
                    kind: res.ok ? "success" : "error",
                  });
                })
              }
              loading={pending}
            >
              Download everything
            </Button>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-h3 mb-1">Marketing emails</h2>
                <p className="text-body text-ink-2">Product updates and study tips. Off by default.</p>
              </div>
              <button
                role="switch"
                aria-checked={marketing}
                onClick={() => {
                  const next = !marketing;
                  setMarketing(next);
                  startTransition(async () => {
                    const res = await setMarketingEmails(next);
                    if (!res.ok) {
                      setMarketing(!next);
                      toast(res.error ?? "Couldn't save.", { kind: "error" });
                    }
                  });
                }}
                className={`focus-ring relative h-6 w-11 rounded-full transition-colors duration-150 ${marketing ? "bg-primary" : "bg-border"}`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform duration-150 ${marketing ? "translate-x-[22px]" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </Card>
          <p className="text-small text-ink-2">
            We never train AI models on your content.{" "}
            <a href="/legal/privacy" className="focus-ring rounded underline hover:text-ink">
              Privacy policy
            </a>
          </p>
        </TabPanel>
      </Tabs>

      {/* Account deletion — the ONE typed-confirm in the app (docs/03 §4). */}
      <Modal open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete your account?">
        <div className="mb-4 flex items-start gap-3">
          <OllieAnimated mode="concerned" size={56} />
          <p className="text-body text-ink-2">
            This deletes your courses, notes, cards, quizzes, and files after a 30-day grace
            period. Any subscription is canceled immediately. Log back in within 30 days to restore.
          </p>
        </div>
        <Input
          label='Type "DELETE" to confirm'
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={typed !== "DELETE"}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteAccount(typed);
                if (res && !res.ok) toast(res.error ?? "Couldn't delete.", { kind: "error" });
              })
            }
          >
            Delete account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
