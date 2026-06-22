import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { RiskBadge } from '../components/ui/RiskBadge.jsx';
import { EmptyState, ErrorState, SkeletonTable } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { PageTransition } from '../components/ui/motion.jsx';
import { api } from '../lib/api.js';
import { fmtCurrency, fmtRelative } from '../lib/format.js';
import { RISK_BANDS, riskStyle } from '../lib/risk.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Alert queue / transaction explorer.
 *
 * The analyst's worklist: every analyzed transaction, filterable by band, searchable by id
 * or account, and sortable by score or detection time. Clicking a row opens the full risk
 * analysis. Band and search filters live in the URL so a view is shareable and survives
 * refresh; sort is local UI state.
 */
export function AlertQueue() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const band = params.get('band') ?? '';
  const search = params.get('search') ?? '';
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' });

  const { data, loading, error, reload } = useAsync(
    () => api.listTransactions({ band, search, limit: 200 }),
    [band, search],
  );

  const rows = useMemo(() => {
    const list = [...(data?.results ?? [])];
    const cmp = {
      score: (r) => r.assessment.compositeScore,
      time: (r) => r.assessment.createdAt ?? r.transaction.createdAt ?? '',
      amount: (r) => r.transaction.amount,
    }[sort.key];
    list.sort((a, b) => {
      const av = cmp(a);
      const bv = cmp(b);
      const d = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === 'asc' ? d : -d;
    });
    return list;
  }, [data, sort]);

  function setBand(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('band', value);
    else next.delete('band');
    setParams(next);
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  return (
    <>
      <Topbar title="Alert Queue" subtitle="Transaction worklist" />
      <main className="flex-1 overflow-y-auto p-6">
        <PageTransition className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={!band} onClick={() => setBand('')}>All</FilterChip>
            {RISK_BANDS.map((b) => (
              <FilterChip key={b} active={band === b} band={b} onClick={() => setBand(b)}>
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
                className="h-9 w-64 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-accent-500"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {loading ? (
              <SkeletonTable rows={10} />
            ) : error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No transactions match"
                description="Adjust the filters, or analyze a transaction to populate the queue."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium text-muted">
                    <th className="px-4 py-2.5">Risk</th>
                    <th className="px-4 py-2.5">Transaction</th>
                    <th className="px-4 py-2.5">Type</th>
                    <SortableTh label="Amount" col="amount" sort={sort} onClick={toggleSort} align="right" />
                    <th className="px-4 py-2.5">Origin → Destination</th>
                    <SortableTh label="Detected" col="time" sort={sort} onClick={toggleSort} />
                    <SortableTh label="Score" col="score" sort={sort} onClick={toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ transaction: t, assessment: a }) => (
                    <tr
                      key={t._id}
                      onClick={() => navigate(`/transactions/${t._id}`)}
                      className="cursor-pointer border-b border-line/60 last:border-0 transition-colors hover:bg-elevated"
                    >
                      <td className="px-4 py-3"><RiskBadge band={a.riskBand} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{t._id.slice(0, 16)}</td>
                      <td className="px-4 py-3 text-fg">{t.type}</td>
                      <td className="px-4 py-3 text-right tnum text-fg">{fmtCurrency(t.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-faint">{t.nameOrig} → {t.nameDest}</td>
                      <td className="px-4 py-3 text-muted">{fmtRelative(a.createdAt ?? t.createdAt)}</td>
                      <td className="px-4 py-3 text-right tnum font-semibold text-fg">{a.compositeScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!loading && !error && rows.length > 0 && (
            <p className="text-xs text-faint">{rows.length} transactions</p>
          )}
        </PageTransition>
      </main>
    </>
  );
}

function SortableTh({ label, col, sort, onClick, align = 'left' }) {
  const active = sort.key === col;
  return (
    <th className={`px-4 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 hover:text-fg ${active ? 'text-fg' : ''}`}
      >
        {label}
        <span className="text-[9px]">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function FilterChip({ active, band, onClick, children }) {
  const ring = band && active ? riskStyle(band).border : '';
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? `border-accent-500/40 bg-accent-500/10 text-accent-400 ${ring}`
          : 'border-line bg-surface text-muted hover:border-faint/40 hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
