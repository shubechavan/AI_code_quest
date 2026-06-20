/**
 * Audit logging.
 *
 * Financial-crime tooling must be auditable: who did what, to which resource, when. This
 * helper writes an immutable audit record. It is called explicitly from sensitive
 * handlers (scoring, report generation, alert resolution) rather than as blanket
 * middleware, so each record carries meaningful action semantics rather than raw HTTP.
 */
import { db } from '../data/store.js';

export function audit({ req, action, resourceType, resourceId, metadata = {} }) {
  return db.auditLogs.insert({
    action,
    resourceType,
    resourceId,
    actorId: req.user?.id ?? 'anonymous',
    actorRole: req.user?.role ?? null,
    tenantId: req.user?.tenantId ?? null,
    ip: req.ip,
    metadata,
    timestamp: new Date().toISOString(),
  });
}
