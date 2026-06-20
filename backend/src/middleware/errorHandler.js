/**
 * Centralised error handling.
 *
 * Normalises thrown errors into a consistent JSON shape and status code. Internal error
 * detail is suppressed in production to avoid leaking implementation information, while
 * upstream-service errors (502/503/504 from the ML client) are surfaced clearly so the UI
 * can render an actionable message.
 */
import { isProd } from '../config/env.js';

// eslint-disable-next-line no-unused-vars -- Express requires the 4-arg signature.
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? 500;
  const body = { error: err.message ?? 'Internal server error' };

  if (status >= 500 && isProd) {
    body.error = 'Internal server error';
  }
  if (!isProd && status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json(body);
}

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}
