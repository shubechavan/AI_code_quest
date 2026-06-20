/**
 * Authentication + authorization middleware.
 *
 * `authenticate` validates the bearer access token and attaches `req.user`.
 * `authorize(permission)` enforces RBAC at the route level using the permission set
 * embedded in the token. Tenant scoping is read from the token's `tenantId` so handlers
 * can filter data without trusting client-supplied tenant identifiers.
 */
import { roleHasPermission } from '../config/roles.js';
import { verifyAccessToken } from '../services/auth.service.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
      tenantId: claims.tenantId,
      permissions: claims.permissions ?? [],
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roleHasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        role: req.user.role,
      });
    }
    return next();
  };
}
