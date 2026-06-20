import { useSearchParams, useNavigate } from 'react-router-dom';

import { RiskBadge } from '../components/ui/RiskBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { api } from '../lib/api.js';
import { fmtCurrency } from '../lib/format.js';
import { RISK_BANDS, riskStyle } from '../lib/risk.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Alert queue / transaction explorer.
 *
 * The analyst's worklist: every analyzed transaction, risk-sorted, filterable by band and
 * searchable by id or account. Clicking a row opens the full risk analysis. Filters live
 * in the URL so a view is shareable and survives refresh.
 */
export function AlertQueue() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const band = params.get('band') ?? '';
  const search = params.get('search') ?? '';

  const { data, loading, error, reload } = useAsync(
    () => api.listTransactions({ band, search }),
    [band, search],
  );

  function setBand(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('band', value);
    else next.delete('band');
    setParams(next);
  }

  return (
    <>
      <Topbar title="Alert Queue" subtitle="Risk-sorted transaction worklist" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={!band} onClick={() => setBand('')}>
              All
            </FilterChip>
            {RISK_BANDS.map((b) => (
              <FilterChip key={b} active={band === b} onClick={() => setBand(b)}>
                {riskStyle(b).label}
              </FilterChip>
            ))}
            <div className="ml-auto">
              <input
                defaultValue={search}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const next = new URLSearchParams(params);
                    if (e.target.value) next.set('search', e.target.value);
                    else next.delete('search');
                    setParams(next);
                  }
                }}
                placeholder="Search id or account…"
                className="h-9 w-64 rounded-md border border-neutral-300 px-3 text-sm focus:border-accent-500"
              />
            </div>
          </div>

          <div className="surface overflow-hidden">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : data.results.length === 0 ? (
              <EmptyState
                title="No transactions match"
                description="Adjust the filters, or analyze a transaction to populate the queue."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500">
                    <th className="px-4 py-2.5">Risk</th>
                    <th className="px-4 py-2.5">Transaction</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Origin → Destination</th>
                    <th className="px-4 py-2.5 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map(({ transaction: t, assessment: a }) => (
                    <tr
                      key={t._id}
                      onClick={() => navigate(`/transactions/${t._id}`)}
                      className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <RiskBadge band={a.riskBand} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                        {t._id.slice(0, 18)}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{t.type}</td>
                      <td className="px-4 py-3 text-right tnum text-neutral-900">
                        {fmtCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                        {t.nameOrig} → {t.nameDest}
                      </td>
                      <td className="px-4 py-3 text-right tnum font-semibold text-neutral-900">
                        {a.compositeScore}
                      </td>
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

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-accent-200 bg-accent-50 text-accent-700'
          : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  );
}
