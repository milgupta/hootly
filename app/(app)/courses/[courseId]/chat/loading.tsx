import { Skeleton } from "@/components/ui/Skeleton";

/** Matches TutorScreen: thread rail, header + Socratic toggle, message area, composer. */
export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-104px)] gap-4">
      <div className="hidden w-[220px] shrink-0 flex-col gap-2 lg:flex">
        <Skeleton className="h-8 w-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex justify-end">
            <Skeleton className="h-12 w-2/5 rounded-card" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
    </div>
  );
}
