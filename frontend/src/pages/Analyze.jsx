import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { api } from '../lib/api.js';

/**
 * Ad-hoc transaction analysis.
 *
 * Lets an analyst score a transaction on demand — pasting in a single record (e.g. a flag
 * raised elsewhere) and getting the full grounded assessment. Presets demonstrate the
 * distinct risk regimes without manual data entry during a review.
 */
const BLANK = {
  type: 'TRANSFER',
  amount: 88000,
  nameOrig: 'C551903',
  oldbalanceOrg: 88000,
  newbalanceOrig: 0,
  nameDest: 'C999001',
  oldbalanceDest: 2000,
  newbalanceDest: 2000,
  counterparty_name: 'Helios Marine',
};

const PRESETS = {
  'Mule → sanctioned (critical)': {
    transaction: { ...BLANK },
    graphEdges: [
      { source: 'C840291', target: 'C551903', amount: 52000, timestamp: 11 },
      { source: 'C770222', target: 'C551903', amount: 41000, timestamp: 12 },
      { source: 'C551903', target: 'C999001', amount: 88000, timestamp: 14 },
      { source: 'C551903', target: 'C700558', amount: 5000, timestamp: 14 },
    ],
    sanctionedAccounts: ['C999001'],
  },
  'Routine payment (low)': {
    transaction: {
      type: 'PAYMENT', amount: 1840.5, nameOrig: 'C223410', oldbalanceOrg: 48230,
      newbalanceOrig: 46389.5, nameDest: 'M774410', oldbalanceDest: 0, newbalanceDest: 0,
      counterparty_name: 'Blue Orchard Cafe',
    },
    graphEdges: [],
    sanctionedAccounts: [],
  },
};

export function Analyze() {
  const navigate = useNavigate();
  const [tx, setTx] = useState(BLANK);
  const [preset, setPreset] = useState(PRESETS['Mule → sanctioned (critical)']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function applyPreset(name) {
    const p = PRESETS[name];
    setPreset(p);
    setTx(p.transaction);
  }

  function update(field, value) {
    const numeric = ['amount', 'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest'];
    setTx((prev) => ({ ...prev, [field]: numeric.includes(field) ? Number(value) : value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.analyzeTransaction({
        transaction: tx,
        graphEdges: preset.transaction === tx ? preset.graphEdges : [],
        sanctionedAccounts: preset.transaction === tx ? preset.sanctionedAccounts : [],
      });
      navigate(`/transactions/${result.transaction._id}`);
    } catch (err) {
      setError(err.body?.issues ? err.body.issues.map((i) => `${i.path}: ${i.message}`).join(', ') : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar title="Analyze Transaction" subtitle="Score a transaction on demand" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                {name}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader title="Transaction details" description="PaySim-schema fields" />
            <CardBody>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Type" value={tx.type} onChange={(v) => update('type', v)}
                    options={['PAYMENT', 'TRANSFER', 'CASH_OUT', 'CASH_IN', 'DEBIT']} />
                  <Input label="Amount" type="number" value={tx.amount} onChange={(v) => update('amount', v)} />
                  <Input label="Origin account" value={tx.nameOrig} onChange={(v) => update('nameOrig', v)} />
                  <Input label="Destination account" value={tx.nameDest} onChange={(v) => update('nameDest', v)} />
                  <Input label="Origin balance (before)" type="number" value={tx.oldbalanceOrg} onChange={(v) => update('oldbalanceOrg', v)} />
                  <Input label="Origin balance (after)" type="number" value={tx.newbalanceOrig} onChange={(v) => update('newbalanceOrig', v)} />
                  <Input label="Dest balance (before)" type="number" value={tx.oldbalanceDest} onChange={(v) => update('oldbalanceDest', v)} />
                  <Input label="Dest balance (after)" type="number" value={tx.newbalanceDest} onChange={(v) => update('newbalanceDest', v)} />
                  <Input label="Counterparty name" value={tx.counterparty_name ?? ''} onChange={(v) => update('counterparty_name', v)} className="col-span-2" />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" loading={loading}>Score transaction</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}

function Input({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
      <input
        type={type}
        value={value}
        step="any"
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-accent-500"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-accent-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
