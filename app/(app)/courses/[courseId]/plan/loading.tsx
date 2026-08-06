import { Skeleton } from "@/components/ui/Skeleton";

/** Matches PlanScreen: header + week-grouped checklist cards. */
export default function PlanLoading() {
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-6">
        {[0, 1].map((week) => (
          <section key={week}>
            <Skeleton className="mb-2 h-4 w-44" />
            <div className="rounded-card border border-border bg-surface shadow-xs">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-0">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-8 w-14" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
