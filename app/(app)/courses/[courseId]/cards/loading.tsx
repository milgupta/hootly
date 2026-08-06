import { Skeleton } from "@/components/ui/Skeleton";

/** Matches the CardsManager layout exactly — no layout shift (docs/03 §5). */
export default function CardsLoading() {
  return (
    <div>
      <div className="mb-5">
        <Skeleton className="mb-2 h-5 w-40" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 min-w-[200px] flex-1" />
          <Skeleton className="h-10 w-[116px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-[30px] w-14 rounded-full" />
          <Skeleton className="h-[30px] w-20 rounded-full" />
          <Skeleton className="h-[30px] w-24 rounded-full" />
          <Skeleton className="h-[30px] w-24 rounded-full" />
          <Skeleton className="h-[30px] w-24 rounded-full" />
        </div>
        <div className="max-w-[320px]">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="mt-1 h-5 w-56" />
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface shadow-xs">
        <div className="flex items-center gap-4 border-b border-border bg-bg-subtle px-4 py-3">
          <Skeleton className="size-[18px] rounded-[6px]" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-10" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="size-[18px] rounded-[6px]" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="size-5" />
            <Skeleton className="size-5" />
          </div>
        ))}
      </div>
    </div>
  );
}
