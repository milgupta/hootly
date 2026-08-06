"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { restoreAccount } from "@/app/(app)/settings/actions";

/** Login during the 30-day deletion grace shows a restore banner (docs/04 §4). */
export function RestoreAccountBanner({ deletionRequestedAt }: { deletionRequestedAt: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const deletionDate = new Date(
    new Date(deletionRequestedAt).getTime() + 30 * 86_400_000
  ).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#F5C6C6] bg-danger-soft px-5 py-4">
      <p className="text-body text-ink">
        Your account is scheduled for deletion on {deletionDate}.
      </p>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await restoreAccount();
            if (res.ok) {
              toast("Welcome back — your account is safe.", { kind: "success" });
              router.refresh();
            } else {
              toast(res.error ?? "Couldn't restore — contact support.", { kind: "error" });
            }
          })
        }
      >
        Restore my account
      </Button>
    </div>
  );
}
