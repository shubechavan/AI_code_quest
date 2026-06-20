/**
 * Dashboard summary route.
 *
 * Aggregates the figures the analyst landing page needs: queue volume by risk band, open
 * alert count, reports generated, and ML model health. Every number is computed from real
 * stored assessments — there are no placeholder metrics.
 */
import { Router } from 'express';

import { PERMISSIONS } from '../config/roles.js';
import { db } from '../data/store.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { mlClient } from '../services/mlClient.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', authorize(PERMISSIONS.TRANSACTION_READ), async (req, res) => {
  const tenantId = req.user.tenantId;
  const assessments = db.assessments.find((a) => a.tenantId === tenantId);

  const byBand = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of assessments) byBand[a.riskBand] = (byBand[a.riskBand] ?? 0) + 1;

  const openAlerts = db.alerts.count(
    (a) => a.tenantId === tenantId && a.state !== 'resolved',
  );

  // Model health + metadata for the dashboard model card (degrades gracefully if the ML
  // service is down).
  let model = null;
  try {
    model = await mlClient.modelMetadata();
  } catch {
    model = null;
  }

  res.json({
    totals: {
      analyzed: assessments.length,
      openAlerts,
      reports: db.reports.count((r) => r.tenantId === tenantId),
    },
    byBand,
    model: model && {
      version: model.model_version,
      trainedAt: model.trained_at,
      metrics: model.metrics?.xgboost_calibrated,
      baseline: model.metrics?.random_forest_baseline,
      topFeatures: Object.entries(model.global_feature_importance ?? {})
        .slice(0, 8)
        .map(([feature, importance]) => ({ feature, importance })),
    },
  });
});
