/**
 * Investigation report routes.
 *
 * A report is the persisted, shareable artifact built from an assessment's grounded brief.
 * Generation snapshots the brief + key evidence at a point in time (so a later re-score
 * does not silently change a filed report). PDF export is handled client-side from a
 * dedicated print view — the standard production approach that avoids server PDF infra
 * while producing pixel-faithful output; this endpoint returns the structured payload the
 * print view renders.
 */
import { Router } from 'express';

import { PERMISSIONS } from '../config/roles.js';
import { db } from '../data/store.js';
import { audit } from '../middleware/audit.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const reportRouter = Router();

reportRouter.use(authenticate);

// POST /reports/:assessmentId/generate — snapshot a brief into a persisted report.
reportRouter.post(
  '/:assessmentId/generate',
  authorize(PERMISSIONS.REPORT_GENERATE),
  (req, res) => {
    const assessment = db.assessments.get(req.params.assessmentId);
    if (!assessment || assessment.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const transaction = db.transactions.get(assessment.transactionId);

    const report = db.reports.insert({
      assessmentId: assessment._id,
      transactionId: assessment.transactionId,
      tenantId: req.user.tenantId,
      generatedBy: req.user.id,
      generatedByName: req.user.name,
      modelVersion: assessment.modelVersion,
      // Point-in-time snapshot of the evidence and narrative.
      snapshot: {
        transaction,
        compositeScore: assessment.compositeScore,
        riskBand: assessment.riskBand,
        supervisedProbability: assessment.supervisedProbability,
        anomalyScore: assessment.anomalyScore,
        graphRisk: assessment.graphRisk,
        contributingFactors: assessment.contributingFactors,
        graphSignals: assessment.graphSignals,
        brief: assessment.brief,
      },
    });

    audit({
      req,
      action: 'report.generate',
      resourceType: 'report',
      resourceId: report._id,
      metadata: { assessmentId: assessment._id, riskBand: assessment.riskBand },
    });
    return res.status(201).json(report);
  },
);

// GET /reports/:id — fetch a persisted report (for viewing or print-to-PDF).
reportRouter.get('/:id', authorize(PERMISSIONS.REPORT_GENERATE), (req, res) => {
  const report = db.reports.get(req.params.id);
  if (!report || report.tenantId !== req.user.tenantId) {
    return res.status(404).json({ error: 'Report not found' });
  }
  return res.json(report);
});

// GET /reports — list reports for the tenant.
reportRouter.get('/', authorize(PERMISSIONS.REPORT_GENERATE), (req, res) => {
  const reports = db.reports
    .find((r) => r.tenantId === req.user.tenantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ count: reports.length, results: reports });
});
