/**
 * Authentication service.
 *
 * Owns password hashing (bcrypt), RS256 access/refresh token issuance, and verification.
 * Refresh tokens are persisted by id so they can be revoked on logout/rotation; access
 * tokens are stateless and short-lived. This is the standard secure pattern: short access
 * token + revocable refresh token with rotation.
 */
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { privateKey, publicKey } from '../config/keys.js';
import { ROLE_PERMISSIONS } from '../config/roles.js';

const SIGN_OPTS = { algorithm: 'RS256', issuer: 'darksentinel' };
const BCRYPT_ROUNDS = 10;

// Revocable refresh-token registry (jti -> { userId, expiresAt }). In production this is
// a Redis/Mongo TTL collection; in memory is fine for the slice.
const refreshRegistry = new Map();

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function issueAccessToken(user) {
  const payload = {
    sub: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
  return jwt.sign(payload, privateKey, {
    ...SIGN_OPTS,
    expiresIn: `${env.accessTokenTtlMin}m`,
  });
}

export function issueRefreshToken(user) {
  const jti = crypto.randomUUID();
  const expiresAt = Date.now() + env.refreshTokenTtlDays * 86_400_000;
  refreshRegistry.set(jti, { userId: user._id, expiresAt });
  const token = jwt.sign({ sub: user._id, jti }, privateKey, {
    ...SIGN_OPTS,
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
  return token;
}

export function verifyAccessToken(token) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer: 'darksentinel' });
}

/** Verify a refresh token and rotate it (single-use): the old jti is revoked. */
export function rotateRefreshToken(token, user) {
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: 'darksentinel',
  });
  const entry = refreshRegistry.get(decoded.jti);
  if (!entry || entry.expiresAt < Date.now()) {
    throw Object.assign(new Error('Refresh token revoked or expired'), { status: 401 });
  }
  refreshRegistry.delete(decoded.jti); // rotation: invalidate the used token
  return {
    accessToken: issueAccessToken(user),
    refreshToken: issueRefreshToken(user),
  };
}

export function revokeAllForUser(userId) {
  for (const [jti, entry] of refreshRegistry) {
    if (entry.userId === userId) refreshRegistry.delete(jti);
  }
}
