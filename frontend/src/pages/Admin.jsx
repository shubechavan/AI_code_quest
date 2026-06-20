import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
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
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader title="Users" description="Console accounts in this tenant" />
            <CardBody className="p-0">
              {loading ? (
                <LoadingState />
              ) : error ? (
                <ErrorState error={error} onRetry={reload} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500">
                      <th className="px-5 py-2.5">Name</th>
                      <th className="px-5 py-2.5">Email</th>
                      <th className="px-5 py-2.5">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((u) => (
                      <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-5 py-3 font-medium text-neutral-900">{u.name}</td>
                        <td className="px-5 py-3 text-neutral-600">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                            {titleCase(u.role)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}
