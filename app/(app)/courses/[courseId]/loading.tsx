import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

/** Matches CourseScreen: emoji + title + exam chip, tab bar, overview cards. */
export default function CourseLoading() {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>
      <div className="mb-6 flex gap-4 border-b border-border pb-2">
        {[64, 48, 76, 60, 48, 40, 68].map((w, i) => (
          <Skeleton key={i} className="h-5" style={{ width: w }} />
        ))}
      </div>
      <div className="flex flex-col gap-5">
        <CardSkeleton />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
