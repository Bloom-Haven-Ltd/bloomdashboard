export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading content">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
