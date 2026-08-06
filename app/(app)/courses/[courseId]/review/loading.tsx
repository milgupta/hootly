import { Skeleton } from "@/components/ui/Skeleton";

/** Matches the full-screen ReviewSession layout exactly — no layout shift. */
export default function ReviewLoading() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3 md:px-6">
        <Skeleton className="h-5 w-14" />
        <div className="max-w-[420px] flex-1">
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <Skeleton className="ml-auto hidden h-5 w-56 sm:block" />
        <Skeleton className="size-8" />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8 md:px-6">
        <div className="flex w-full max-w-[640px] flex-col items-center gap-6">
          <Skeleton className="h-[320px] w-full rounded-card" />
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[62px] rounded-ctl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
