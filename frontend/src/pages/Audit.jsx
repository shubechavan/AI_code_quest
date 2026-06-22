import { EmptyState, ErrorState, SkeletonTable } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { PageTransition } from '../components/ui/motion.jsx';
import { api } from '../lib/api.js';
import { fmtDateTime, titleCase } from '../lib/format.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Immutable audit trail.
 *
 * Surfaces the activity log that makes the platform defensible: who took which action on
 * which resource, when, and from where. Restricted to roles with the audit:read permission
 * (risk manager, admin).
 */
const ACTION_STYLE = {
  'transaction.analyze': 'bg-sky-500/10 text-sky-400',
  'report.generate': 'bg-violet-500/10 text-violet-400',
  'user.create': 'bg-emerald-500/10 text-emerald-400',
};

export function Audit() {
  const { data, loading, error, reload } = useAsync(() => api.auditLogs(), []);

  return (
    <>
      <Topbar title="Audit Log" subtitle="Immutable activity trail" />
      <main className="flex-1 overflow-y-auto p-6">
        <PageTransition className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {loading ? (
              <SkeletonTable rows={10} />
            ) : error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : data.results.length === 0 ? (
              <EmptyState title="No audit events yet" description="Actions taken in the console will appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium text-muted">
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Resource</th>
                    <th className="px-4 py-2.5">Actor</th>
                    <th className="px-4 py-2.5">Detail</th>
                    <th className="px-4 py-2.5">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((l) => (
                    <tr key={l._id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_STYLE[l.action] ?? 'bg-elevated text-muted'}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-faint">{l.resourceType}/{l.resourceId?.slice(0, 12)}</td>
                      <td className="px-4 py-2.5 text-fg">{titleCase(l.actorRole)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {l.metadata?.riskBand && <span>band: {l.metadata.riskBand}</span>}
                        {l.metadata?.role && <span>role: {l.metadata.role}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{fmtDateTime(l.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </PageTransition>
      </main>
    </>
  );
}
