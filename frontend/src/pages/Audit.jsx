import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { api } from '../lib/api.js';
import { fmtDateTime, titleCase } from '../lib/format.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Immutable audit trail.
 *
 * Surfaces the activity log that makes the platform defensible: who took which action on
 * which resource, when, and from where. Restricted to roles with the audit:read
 * permission (risk manager, admin).
 */
const ACTION_STYLE = {
  'transaction.analyze': 'bg-blue-50 text-blue-700',
  'report.generate': 'bg-violet-50 text-violet-700',
  'user.create': 'bg-emerald-50 text-emerald-700',
};

export function Audit() {
  const { data, loading, error, reload } = useAsync(() => api.auditLogs(), []);

  return (
    <>
      <Topbar title="Audit Log" subtitle="Immutable activity trail" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="surface overflow-hidden">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : data.results.length === 0 ? (
              <EmptyState title="No audit events yet" description="Actions taken in the console will appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500">
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Resource</th>
                    <th className="px-4 py-2.5">Actor</th>
                    <th className="px-4 py-2.5">Detail</th>
                    <th className="px-4 py-2.5">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((l) => (
                    <tr key={l._id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_STYLE[l.action] ?? 'bg-neutral-100 text-neutral-600'}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">
                        {l.resourceType}/{l.resourceId?.slice(0, 12)}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700">{titleCase(l.actorRole)}</td>
                      <td className="px-4 py-2.5 text-xs text-neutral-500">
                        {l.metadata?.riskBand && <span>band: {l.metadata.riskBand}</span>}
                        {l.metadata?.role && <span>role: {l.metadata.role}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500">{fmtDateTime(l.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
