/**
 * Admin + operational routes: audit log access, user listing, and a dashboard summary.
 */
import { Router } from 'express';

import { PERMISSIONS } from '../config/roles.js';
import { db } from '../data/store.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { mlClient } from '../services/mlClient.js';

export const adminRouter = Router();

adminRouter.use(authenticate);

// GET /admin/audit-logs — immutable activity trail, newest first, tenant-scoped.
adminRouter.get('/audit-logs', authorize(PERMISSIONS.AUDIT_READ), (req, res) => {
  const logs = db.auditLogs
    .find((l) => l.tenantId === req.user.tenantId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, Math.min(Number(req.query.limit ?? 100), 500));
  res.json({ count: logs.length, results: logs });
});

// GET /admin/users — user directory (admin only).
adminRouter.get('/users', authorize(PERMISSIONS.USER_MANAGE), (req, res) => {
  const users = db.users
    .find((u) => u.tenantId === req.user.tenantId)
    .map((u) => ({ id: u._id, email: u.email, name: u.name, role: u.role }));
  res.json({ count: users.length, results: users });
});
