/**
 * Role-based access control model.
 *
 * Three personas from the product brief, each with an explicit permission set. Routes
 * declare the permission they require; the `authorize` middleware checks the caller's
 * role grants it. Keeping permissions (not roles) at the route layer means adding a role
 * later does not require touching every route.
 */
export const ROLES = Object.freeze({
  ANALYST: 'analyst',
  RISK_MANAGER: 'risk_manager',
  ADMIN: 'admin',
});

export const PERMISSIONS = Object.freeze({
  TRANSACTION_READ: 'transaction:read',
  TRANSACTION_ANALYZE: 'transaction:analyze',
  REPORT_GENERATE: 'report:generate',
  ALERT_RESOLVE: 'alert:resolve',
  AUDIT_READ: 'audit:read',
  USER_MANAGE: 'user:manage',
});

const P = PERMISSIONS;

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ANALYST]: [P.TRANSACTION_READ, P.TRANSACTION_ANALYZE, P.REPORT_GENERATE],
  [ROLES.RISK_MANAGER]: [
    P.TRANSACTION_READ, P.TRANSACTION_ANALYZE, P.REPORT_GENERATE,
    P.ALERT_RESOLVE, P.AUDIT_READ,
  ],
  [ROLES.ADMIN]: Object.values(P),
});

export function roleHasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
