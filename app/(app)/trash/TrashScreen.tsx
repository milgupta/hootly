"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { TrashRow, TrashKind } from "@/lib/trash";
import { emptyTrash, restore } from "./actions";

const KIND_LABELS: Record<TrashKind, string> = {
  course: "Course",
  material: "Material",
  note: "Note",
  flashcard: "Flashcard",
  quiz: "Quiz",
  thread: "Chat",
};

function daysLeft(deletedAt: string): number {
  const expiry = new Date(deletedAt).getTime() + 30 * 86_400_000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86_400_000));
}

export function TrashScreen({ rows }: { rows: TrashRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmStep, setConfirmStep] = React.useState<0 | 1 | 2>(0);
  const [pending, startTransition] = React.useTransition();

  function onRestore(row: TrashRow) {
    startTransition(async () => {
      const res = await restore(row.kind, row.id);
      if (res.ok) {
        toast(`Restored “${row.title}”`, { kind: "success" });
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't restore.", { kind: "error" });
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1">Trash</h1>
        {rows.length > 0 && (
          <Button variant="secondary" onClick={() => setConfirmStep(1)}>
            Empty trash
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState message="Nothing here. Deleted things wait 30 days before leaving for good." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th className="text-small px-5 py-3 font-medium text-ink-2">Item</th>
                <th className="text-small px-5 py-3 font-medium text-ink-2">Type</th>
                <th className="text-small px-5 py-3 font-medium text-ink-2">Course</th>
                <th className="text-small px-5 py-3 font-medium text-ink-2">Deleted</th>
                <th className="text-small px-5 py-3 font-medium text-ink-2">Days left</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const left = daysLeft(row.deletedAt);
                return (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-border last:border-0">
                    <td className="text-body max-w-[28ch] truncate px-5 py-3" title={row.title}>
                      {row.title}
                    </td>
                    <td className="text-small px-5 py-3 text-ink-2">{KIND_LABELS[row.kind]}</td>
                    <td className="text-small px-5 py-3 text-ink-2">{row.courseName ?? "—"}</td>
                    <td className="text-small px-5 py-3 text-ink-2 tabular-nums">
                      {new Date(row.deletedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "text-micro rounded-full px-2 py-0.5 font-medium tabular-nums",
                          left <= 7 ? "bg-warning-soft text-warning" : "bg-bg-subtle text-ink-2"
                        )}
                      >
                        {left}d
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => onRestore(row)} disabled={pending}>
                        Restore
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty trash: double-confirm (docs/04 §4) */}
      <Modal
        open={confirmStep > 0}
        onOpenChange={(open) => !open && setConfirmStep(0)}
        title={confirmStep === 1 ? "Empty trash?" : "Really delete everything in Trash?"}
        description={
          confirmStep === 1
            ? `This permanently deletes ${rows.length} ${rows.length === 1 ? "item" : "items"} right now — no 30-day recovery.`
            : "Last check: this can't be undone."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmStep(0)}>Cancel</Button>
          {confirmStep === 1 ? (
            <Button variant="secondary" onClick={() => setConfirmStep(2)}>Continue</Button>
          ) : (
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await emptyTrash();
                  setConfirmStep(0);
                  if (res.ok) {
                    toast("Trash emptied", { kind: "success" });
                    router.refresh();
                  } else {
                    toast(res.error ?? "Couldn't empty trash.", { kind: "error" });
                  }
                })
              }
            >
              Delete everything
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
