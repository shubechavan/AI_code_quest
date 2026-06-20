/**
 * Gateway entry point.
 *
 * Seeds the demo dataset on boot (idempotent) so a fresh clone has users to log in with
 * and a populated queue, then starts the HTTP server.
 */
import { env } from './config/env.js';
import { seed } from './data/seed.js';
import { createApp } from './app.js';

async function main() {
  await seed();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[gateway] listening on http://localhost:${env.port}  (env=${env.nodeEnv})`);
    // eslint-disable-next-line no-console
    console.log(`[gateway] ML service: ${env.mlServiceUrl}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[gateway] fatal startup error:', err);
  process.exit(1);
});
