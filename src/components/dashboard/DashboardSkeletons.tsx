export function WidgetSkeleton({ title }: { title?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800 animate-pulse">
      {title && (
        <div className="flex justify-between items-center mb-6">
          <div className="h-7 bg-zinc-200 dark:bg-zinc-700 rounded w-48"></div>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4">
            <div className="aspect-[16/9] w-full bg-zinc-200 dark:bg-zinc-700 rounded-lg"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3"></div>
            <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-zinc-200 rounded-xl p-6 dark:bg-zinc-900 dark:border-zinc-800 animate-pulse flex justify-between items-center">
          <div className="space-y-3">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24"></div>
            <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
          </div>
          <div className="w-14 h-14 bg-zinc-200 dark:bg-zinc-700 rounded-full"></div>
        </div>
      ))}
    </div>
  );
}
