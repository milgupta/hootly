import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-72" />
      <Skeleton className="mb-8 h-5 w-96" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
