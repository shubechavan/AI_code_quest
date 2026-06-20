/**
 * Idempotent demo seed.
 *
 * Creates the three persona users and, if the ML service is reachable, scores the curated
 * demo scenarios so a fresh boot lands on a populated, realistic queue. If the ML service
 * is down, user seeding still succeeds and the queue fills in once scoring is available —
 * boot never hard-fails on an unavailable dependency.
 *
 * Credentials are documented in docs/05-demo.md. These are demo accounts for a local
 * environment only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROLES } from '../config/roles.js';
import { db } from './store.js';
import { hashPassword } from '../services/auth.service.js';
import { mlClient } from '../services/mlClient.js';
import { analyzeTransaction } from '../services/transactions.service.js';

const TENANT = 'tenant_demo';

const DEMO_USERS = [
  { email: 'analyst@darksentinel.io', name: 'Priya Nair', role: ROLES.ANALYST, password: 'Analyst#2026' },
  { email: 'manager@darksentinel.io', name: 'Daniel Okafor', role: ROLES.RISK_MANAGER, password: 'Manager#2026' },
  { email: 'admin@darksentinel.io', name: 'Sara Mendes', role: ROLES.ADMIN, password: 'Admin#2026' },
];

function scenariosPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // backend/src/data -> repo root -> ml-service/data/demo_scenarios.json
  return path.resolve(here, '../../../ml-service/data/demo_scenarios.json');
}

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

async function seedScenarios(analyst) {
  const file = scenariosPath();
  if (!fs.existsSync(file)) {
    console.warn(`[seed] scenarios file not found (${file}); skipping queue seed.`);
    return;
  }
  const health = await mlClient.health();
  if (health.status !== 'ok') {
    console.warn('[seed] ML service not ready; queue will populate after analyze calls.');
    return;
  }
  if (db.transactions.count() > 0) return; // already seeded

  const scenarios = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const s of scenarios) {
    try {
      await analyzeTransaction({
        transaction: s.transaction,
        graphEdges: s.graph_edges ?? [],
        sanctionedAccounts: s.sanctioned_accounts ?? [],
        user: { id: analyst._id, tenantId: TENANT },
        mlClient,
      });
    } catch (err) {
      console.warn(`[seed] could not score scenario ${s.id}: ${err.message}`);
    }
  }
  console.log(`[seed] seeded ${db.transactions.count()} demo transactions.`);
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
