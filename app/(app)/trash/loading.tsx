import { Skeleton } from "@/components/ui/Skeleton";

/** Matches TrashScreen's header + table (docs/03 §8 gate 10: no layout shift). */
export default function TrashLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-card border border-border bg-surface shadow-xs">
        <div className="border-b border-border bg-bg-subtle px-5 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-5 border-b border-border px-5 py-3 last:border-0">
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-10 rounded-full" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
