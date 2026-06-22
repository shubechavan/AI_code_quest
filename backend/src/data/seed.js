/**
 * Idempotent seed.
 *
 * Creates the three persona users and, if the ML service is reachable, scores a generated
 * set of realistic transactions so a fresh boot lands on a populated, working queue. Every
 * transaction is scored through the real ML service — the seed only controls the input mix
 * and timestamps, never the resulting scores. If the ML service is down, user seeding still
 * succeeds and the queue fills in once scoring is available; boot never hard-fails.
 */
import { ROLES } from '../config/roles.js';
import { db } from './store.js';
import { hashPassword } from '../services/auth.service.js';
import { mlClient } from '../services/mlClient.js';
import { analyzeTransaction } from '../services/transactions.service.js';
import { buildSeedTransactions } from './seedAlerts.js';

const TENANT = 'tenant_demo';

const DEMO_USERS = [
  { email: 'analyst@darksentinel.io', name: 'Priya Nair', role: ROLES.ANALYST, password: 'Analyst#2026' },
  { email: 'manager@darksentinel.io', name: 'Daniel Okafor', role: ROLES.RISK_MANAGER, password: 'Manager#2026' },
  { email: 'admin@darksentinel.io', name: 'Sara Mendes', role: ROLES.ADMIN, password: 'Admin#2026' },
];

async function seedUsers() {
  for (const u of DEMO_USERS) {
    if (db.users.findOne((x) => x.email === u.email)) continue;
    db.users.insert({
      email: u.email,
      name: u.name,
      role: u.role,
      tenantId: TENANT,
      passwordHash: await hashPassword(u.password),
    });
  }
  return db.users.findOne((u) => u.role === ROLES.ANALYST);
}

async function waitForMl(attempts = 15, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    const health = await mlClient.health();
    if (health.status === 'ok') return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function seedScenarios(analyst) {
  if (db.transactions.count() > 0) return; // already seeded
  const ready = await waitForMl();
  if (!ready) {
    console.warn('[seed] ML service not ready after wait; queue will populate on first analyze.');
    return;
  }

  const specs = buildSeedTransactions();
  let scored = 0;
  for (const s of specs) {
    try {
      await analyzeTransaction({
        transaction: s.transaction,
        graphEdges: s.graphEdges ?? [],
        sanctionedAccounts: s.sanctionedAccounts ?? [],
        detectedAt: s.detectedAt,
        user: { id: analyst._id, tenantId: TENANT },
        mlClient,
      });
      scored += 1;
    } catch (err) {
      console.warn(`[seed] could not score a seed transaction: ${err.message}`);
    }
  }
  console.log(`[seed] scored ${scored} seed transactions through the ML service.`);
}

export async function seed() {
  const analyst = await seedUsers();
  await seedScenarios(analyst);
}

// Allow `npm run seed` standalone.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().then(() => console.log('[seed] done')).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
