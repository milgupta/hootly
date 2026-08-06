import { Skeleton } from "@/components/ui/Skeleton";

/** Matches the quiz take layout exactly — no layout shift on load (docs/03 §5). */
export default function QuizLoading() {
  return (
    <div className="mx-auto max-w-[780px]">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-12" />
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
      <Skeleton className="mt-6 h-10 w-32 rounded-ctl" />
    </div>
  );
}
