/**
 * Shared loading / empty / error states, plus skeleton primitives.
 *
 * Every data view uses these so the product handles non-happy paths consistently and shows
 * structured skeletons (not spinners) while data loads — the hallmark of a real
 * application. Skeletons mirror the shape of the content they replace to avoid layout shift.
 */
export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent-500 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}

/** Skeleton grid used by card-heavy pages (e.g. the dashboard) while loading. */
export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-2 h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton rows for table views (e.g. the alert queue). */
export function SkeletonTable({ rows = 8 }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-faint">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7h18M3 12h18M3 17h12" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-fg">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{error?.message ?? 'Unexpected error.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-line bg-elevated px-3 py-1.5 text-sm font-medium text-fg hover:border-faint/50"
        >
          Try again
        </button>
      )}
    </div>
  );
}
