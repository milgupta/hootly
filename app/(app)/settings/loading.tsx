import { Skeleton } from "@/components/ui/Skeleton";

/** Matches SettingsScreen: H1, four tabs, then the first card. */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-[760px]">
      <Skeleton className="mb-6 h-9 w-32" />
      <div className="flex gap-4 border-b border-border pb-2">
        {[64, 56, 52, 60].map((w, i) => (
          <Skeleton key={i} className="h-5" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-6 rounded-card border border-border bg-surface p-5 shadow-xs">
        <Skeleton className="mb-4 h-5 w-24" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
