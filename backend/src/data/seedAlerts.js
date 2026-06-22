/**
 * Realistic seed transaction generator.
 *
 * Produces a deterministic set of ~36 PaySim-schema transactions spanning the patterns a
 * monitoring desk actually sees: ordinary merchant payments and cash-ins, account-draining
 * cash-outs and transfers (the real PaySim fraud signature), mule funnels with graph
 * structure, and a few counterparties whose names collide with the live OFAC list.
 *
 * Nothing here is a pre-baked score. Each record is a transaction *input*; the gateway
 * scores every one through the real ML service on seed, so the resulting risk scores,
 * SHAP attributions, graph metrics, and sanctions matches are all genuinely computed. The
 * generator only controls the input mix and the (backdated) detection timestamps so the
 * queue looks like a working desk rather than an empty table.
 */

// Deterministic PRNG so the seeded desk is identical across restarts.
function mulberry32(seed) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS = [
  'Blue Orchard Cafe', 'Northwind Grocers', 'Apex Fuel & Energy', 'CityRail Transit',
  'Metro Pharmacy', 'Lumen Utilities', 'Orbit Mobile', 'Harbor Insurance',
  'Greenleaf Markets', 'Skyline Airfare',
];
const LEGIT_PARTIES = [
  'Cedar Point Logistics', 'Vantage Capital Partners', 'Riverside Trading',
  'Summit Imports', 'Meridian Freight', 'Atlas Wholesale', 'Brightwater Foods',
];
// Names that fuzzy-match real OFAC SDN entities (verified hits against the live list).
const SANCTIONED_NAMES = [
  'Nordstrand Maritime & Trading Co', // -> NORDSTRAND MARITIME AND TRADING COMPANY
  'Banco Nacional de Cuba', // -> BANCO NACIONAL DE CUBA
  'Galax Trading Co', // -> GALAX TRADING CO., LTD.
];

const rng = mulberry32(20260622);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi) => lo + rng() * (hi - lo);
const acct = () => `C${Math.floor(1e8 + rng() * 9e8)}`;
const merch = () => `M${Math.floor(1e8 + rng() * 9e8)}`;
const round2 = (n) => Math.round(n * 100) / 100;

/** A clean merchant payment — should score low. */
function cleanPayment(step) {
  const bal = round2(between(5_000, 90_000));
  const amount = round2(between(12, 4_000));
  return {
    transaction: {
      type: 'PAYMENT', amount, step,
      nameOrig: acct(), oldbalanceOrg: bal, newbalanceOrig: round2(bal - amount),
      nameDest: merch(), oldbalanceDest: 0, newbalanceDest: 0,
      counterparty_name: pick(MERCHANTS),
    },
  };
}

/** A normal partial transfer or cash-in — should score low. */
function cleanTransfer(step) {
  const bal = round2(between(8_000, 120_000));
  const amount = round2(between(200, bal * 0.4));
  const destOld = round2(between(1_000, 60_000));
  const cashIn = rng() < 0.4;
  return {
    transaction: {
      type: cashIn ? 'CASH_IN' : 'TRANSFER', amount, step,
      nameOrig: acct(), oldbalanceOrg: bal,
      newbalanceOrig: cashIn ? round2(bal + amount) : round2(bal - amount),
      nameDest: acct(), oldbalanceDest: destOld, newbalanceDest: round2(destOld + amount),
      counterparty_name: pick(LEGIT_PARTIES),
    },
  };
}

/** An account-draining cash-out/transfer — the real PaySim fraud signature. */
function drainFraud(step, { sanctioned = false } = {}) {
  const bal = round2(between(8_000, 320_000));
  const destOld = round2(between(0, 4_000));
  return {
    transaction: {
      type: rng() < 0.5 ? 'CASH_OUT' : 'TRANSFER', amount: bal, step,
      nameOrig: acct(), oldbalanceOrg: bal, newbalanceOrig: 0,
      nameDest: acct(), oldbalanceDest: destOld, newbalanceDest: destOld, // unreconciled
      counterparty_name: sanctioned ? pick(SANCTIONED_NAMES) : pick(LEGIT_PARTIES),
    },
  };
}

/** A mule funnel: origin receives from several accounts and forwards the full balance to
 *  a sanctioned account one hop away — exercises the graph + sanctions layers together. */
function muleFunnel(step) {
  const mule = acct();
  const sink = acct();
  const src1 = acct();
  const src2 = acct();
  const bal = round2(between(40_000, 180_000));
  return {
    transaction: {
      type: 'TRANSFER', amount: bal, step,
      nameOrig: mule, oldbalanceOrg: bal, newbalanceOrig: 0,
      nameDest: sink, oldbalanceDest: round2(between(0, 5_000)),
      newbalanceDest: round2(between(0, 5_000)),
      counterparty_name: pick(SANCTIONED_NAMES),
    },
    graphEdges: [
      { source: src1, target: mule, amount: round2(bal * 0.55), timestamp: step - 3 },
      { source: src2, target: mule, amount: round2(bal * 0.5), timestamp: step - 2 },
      { source: mule, target: sink, amount: bal, timestamp: step },
      { source: mule, target: acct(), amount: round2(between(1_000, 6_000)), timestamp: step },
    ],
    sanctionedAccounts: [sink],
  };
}

/**
 * Build the full seed set. Returns specs the gateway scores in order; `detectedAt` is a
 * backdated ISO timestamp so the queue spans the last several days.
 */
export function buildSeedTransactions() {
  const specs = [];
  const plan = [
    ...Array(13).fill(cleanPayment),
    ...Array(8).fill(cleanTransfer),
    ...Array(6).fill((s) => drainFraud(s)),
    ...Array(3).fill((s) => drainFraud(s, { sanctioned: true })),
    ...Array(3).fill(muleFunnel),
    ...Array(3).fill(cleanTransfer),
  ];

  // Shuffle deterministically so severities interleave in the queue.
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }

  const now = Date.now();
  plan.forEach((make, idx) => {
    const step = 1 + Math.floor(rng() * 743);
    const spec = make(step);
    // Spread detections across the last ~7 days, newer ones denser.
    const minutesAgo = Math.floor(Math.pow(rng(), 1.7) * 7 * 24 * 60);
    spec.detectedAt = new Date(now - minutesAgo * 60_000).toISOString();
    specs.push(spec);
  });

  // Newest first is the gateway's default queue order; sort so timestamps look natural.
  specs.sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
  return specs;
}
