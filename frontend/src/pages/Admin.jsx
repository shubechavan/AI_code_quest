import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState, SkeletonTable } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { PageTransition } from '../components/ui/motion.jsx';
import { api } from '../lib/api.js';
import { titleCase } from '../lib/format.js';
import { useAsync } from '../lib/useAsync.js';

/** Administration: user directory (admin-only). User provisioning is server-enforced. */
export function Admin() {
  const { data, loading, error, reload } = useAsync(() => api.listUsers(), []);

  return (
    <>
      <Topbar title="Administration" subtitle="User directory and access" />
      <main className="flex-1 overflow-y-auto p-6">
        <PageTransition className="mx-auto max-w-3xl">
          <Card>
            <CardHeader title="Users" description="Console accounts in this tenant" />
            <CardBody className="p-0">
              {loading ? (
                <SkeletonTable rows={3} />
              ) : error ? (
                <ErrorState error={error} onRetry={reload} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-muted">
                      <th className="px-5 py-2.5">Name</th>
                      <th className="px-5 py-2.5">Email</th>
                      <th className="px-5 py-2.5">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((u) => (
                      <tr key={u.id} className="border-b border-line/60 last:border-0">
                        <td className="px-5 py-3 font-medium text-fg">{u.name}</td>
                        <td className="px-5 py-3 text-muted">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-elevated px-2 py-0.5 text-xs font-medium text-muted">{titleCase(u.role)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </PageTransition>
      </main>
    </>
  );
}
