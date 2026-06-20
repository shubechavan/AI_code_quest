/**
 * Transaction routes: analyze, list (queue), detail, and graph retrieval.
 */
import { Router } from 'express';
import { z } from 'zod';

import { PERMISSIONS } from '../config/roles.js';
import { audit } from '../middleware/audit.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { mlClient } from '../services/mlClient.js';
import {
  analyzeTransaction,
  getTransactionDetail,
  listTransactions,
} from '../services/transactions.service.js';

export const transactionRouter = Router();

const TX_TYPES = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'CASH_IN', 'DEBIT'];

const transactionSchema = z.object({
  type: z.enum(TX_TYPES),
  amount: z.number().nonnegative(),
  step: z.number().int().nonnegative().default(1),
  nameOrig: z.string().min(1),
  oldbalanceOrg: z.number().nonnegative(),
  newbalanceOrig: z.number().nonnegative(),
  nameDest: z.string().min(1),
  oldbalanceDest: z.number().nonnegative(),
  newbalanceDest: z.number().nonnegative(),
  counterparty_name: z.string().optional(),
});

const analyzeSchema = z.object({
  transaction: transactionSchema,
  graphEdges: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        amount: z.number().nonnegative(),
        timestamp: z.number().int().default(0),
      }),
    )
    .default([]),
  sanctionedAccounts: z.array(z.string()).default([]),
});

transactionRouter.use(authenticate);

// POST /transactions/analyze — score + explain + persist + (maybe) open an alert.
transactionRouter.post(
  '/analyze',
  authorize(PERMISSIONS.TRANSACTION_ANALYZE),
  validate(analyzeSchema),
  async (req, res, next) => {
    try {
      const result = await analyzeTransaction({
        transaction: req.body.transaction,
        graphEdges: req.body.graphEdges,
        sanctionedAccounts: req.body.sanctionedAccounts,
        user: req.user,
        mlClient,
      });
      audit({
        req,
        action: 'transaction.analyze',
        resourceType: 'transaction',
        resourceId: result.transaction._id,
        metadata: {
          riskBand: result.assessment.riskBand,
          compositeScore: result.assessment.compositeScore,
          alertOpened: Boolean(result.alert),
        },
      });
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  },
);

// GET /transactions — risk-sorted queue with optional band + search filters.
transactionRouter.get('/', authorize(PERMISSIONS.TRANSACTION_READ), (req, res) => {
  const rows = listTransactions({
    tenantId: req.user.tenantId,
    band: req.query.band,
    search: req.query.search,
    limit: Math.min(Number(req.query.limit ?? 50), 200),
  });
  res.json({ count: rows.length, results: rows });
});

// GET /transactions/:id — full detail incl. SHAP explanation and brief.
transactionRouter.get('/:id', authorize(PERMISSIONS.TRANSACTION_READ), (req, res) => {
  const detail = getTransactionDetail(req.params.id, req.user.tenantId);
  if (!detail) return res.status(404).json({ error: 'Transaction not found' });
  return res.json(detail);
});

// GET /transactions/:id/graph — stored subgraph + computed structural signals.
transactionRouter.get('/:id/graph', authorize(PERMISSIONS.TRANSACTION_READ), (req, res) => {
  const detail = getTransactionDetail(req.params.id, req.user.tenantId);
  if (!detail?.assessment) return res.status(404).json({ error: 'No graph for transaction' });
  return res.json({
    edges: detail.assessment.graphEdges ?? [],
    signals: detail.assessment.graphSignals ?? null,
    focusAccount: detail.transaction.nameOrig,
  });
});
