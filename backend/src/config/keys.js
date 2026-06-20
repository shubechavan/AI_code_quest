/**
 * RS256 key management.
 *
 * The brief specifies JWT RS256 (asymmetric) so the public key can be distributed for
 * verification without exposing signing capability. For a frictionless dev experience we
 * generate a 2048-bit RSA key pair on first boot and persist it under ./keys (gitignored).
 * In production these paths point at secrets-manager-provisioned keys and generation is
 * disabled.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { env, isProd } from './env.js';

function ensureKeyPair() {
  const privPath = path.resolve(env.jwtPrivateKeyPath);
  const pubPath = path.resolve(env.jwtPublicKeyPath);

  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    return {
      privateKey: fs.readFileSync(privPath, 'utf8'),
      publicKey: fs.readFileSync(pubPath, 'utf8'),
    };
  }

  if (isProd) {
    throw new Error(
      'JWT keys not found and key generation is disabled in production. ' +
        'Provision keys via your secrets manager.',
    );
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.mkdirSync(path.dirname(privPath), { recursive: true });
  fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(pubPath, publicKey);
  // eslint-disable-next-line no-console
  console.log('[keys] Generated dev RS256 key pair at ./keys');

  return { privateKey, publicKey };
}

export const { privateKey, publicKey } = ensureKeyPair();
