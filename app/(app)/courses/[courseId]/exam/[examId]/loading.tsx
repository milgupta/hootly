import { Skeleton } from "@/components/ui/Skeleton";

/** Matches the exam layout exactly — question column + palette (docs/03 §5). */
export default function ExamLoading() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-52" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full" />
        </div>
        <Skeleton className="mb-2 h-4 w-40" />
        <Skeleton className="mb-6 h-9 w-3/4" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-card" />
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 w-28 rounded-ctl" />
          <Skeleton className="h-10 w-36 rounded-ctl" />
          <Skeleton className="h-10 w-24 rounded-ctl" />
        </div>
      </div>
      <div className="w-full shrink-0 rounded-card border border-border bg-surface p-5 shadow-xs lg:w-[248px]">
        <Skeleton className="mb-2 h-5 w-24" />
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
          {Array.from({ length: 18 }, (_, i) => (
            <Skeleton key={i} className="size-8 rounded-ctl" />
          ))}
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-ctl" />
      </div>
    </div>
  );
}
