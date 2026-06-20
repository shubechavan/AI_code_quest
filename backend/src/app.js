/**
 * Express application assembly.
 *
 * Security middleware (helmet, CORS allow-list, rate limiting) is applied before routes.
 * The composition order matters: parsing -> security -> logging -> routes -> 404 -> error.
 */
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProd } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { reportRouter } from './routes/reports.routes.js';
import { transactionRouter } from './routes/transactions.routes.js';
import { mlClient } from './services/mlClient.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // accurate req.ip behind a proxy for rate limiting/audit
  app.use(helmet());
  app.use(
    cors({
      origin: env.frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Global rate limit per IP; auth endpoints get a stricter limit to blunt credential
  // stuffing.
  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts; try again shortly.' },
  });
  app.use(globalLimiter);

  // Liveness probe + ML service health passthrough.
  app.get('/health', async (_req, res) => {
    const ml = await mlClient.health();
    res.json({ status: 'ok', mlService: ml.status });
  });

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
