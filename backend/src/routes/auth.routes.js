/**
 * Authentication routes: login, refresh, current user, logout, and admin user creation.
 */
import { Router } from 'express';
import { z } from 'zod';

import { ROLES } from '../config/roles.js';
import { db } from '../data/store.js';
import { audit } from '../middleware/audit.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  hashPassword,
  issueAccessToken,
  issueRefreshToken,
  revokeAllForUser,
  rotateRefreshToken,
  verifyPassword,
} from '../services/auth.service.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([ROLES.ANALYST, ROLES.RISK_MANAGER, ROLES.ADMIN]),
});

function publicUser(u) {
  return { id: u._id, email: u.email, name: u.name, role: u.role, tenantId: u.tenantId };
}

authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.findOne((u) => u.email === email.toLowerCase());
  // Constant-ish response: do not reveal whether the email exists.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  return res.json({
    user: publicUser(user),
    accessToken: issueAccessToken(user),
    refreshToken: issueRefreshToken(user),
  });
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    // Decode without trusting it yet to find the user, then verify+rotate.
    const [, payload] = refreshToken.split('.');
    const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const user = db.users.get(sub);
    if (!user) return res.status(401).json({ error: 'Unknown subject' });
    const tokens = rotateRefreshToken(refreshToken, user);
    return res.json(tokens);
  } catch (err) {
    return next(Object.assign(err, { status: err.status ?? 401 }));
  }
});

authRouter.get('/me', authenticate, (req, res) => {
  const user = db.users.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: publicUser(user) });
});

authRouter.post('/logout', authenticate, (req, res) => {
  revokeAllForUser(req.user.id);
  res.json({ ok: true });
});

// Admin-only user provisioning (the brief's "register" is an admin function, not open
// signup — this is an internal fraud-ops tool, not a consumer product).
authRouter.post(
  '/register',
  authenticate,
  authorize('user:manage'),
  validate(registerSchema),
  async (req, res) => {
    const { email, name, password, role } = req.body;
    if (db.users.findOne((u) => u.email === email.toLowerCase())) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = db.users.insert({
      email: email.toLowerCase(),
      name,
      role,
      tenantId: req.user.tenantId,
      passwordHash: await hashPassword(password),
    });
    audit({ req, action: 'user.create', resourceType: 'user', resourceId: user._id, metadata: { role } });
    return res.status(201).json({ user: publicUser(user) });
  },
);
