import { Skeleton } from "@/components/ui/Skeleton";

/** Matches NoteReader's 68ch reading column: title + depth chip, export row, sections. */
export default function NoteLoading() {
  return (
    <div className="reading-measure mx-auto">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-6 mt-2 h-8 w-32" />
      <div className="flex flex-col gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="mb-3 h-7 w-2/5" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-3 h-4 w-3/4" />
            <Skeleton className="h-5 w-40 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
