/**
 * Client for the FastAPI ML service.
 *
 * The gateway never implements scoring logic; it delegates to the ML service and is
 * responsible only for auth, persistence, and orchestration. This client centralises the
 * HTTP contract, timeouts, and error translation so route handlers stay thin.
 */
import { env } from '../config/env.js';

const TIMEOUT_MS = 10_000;

async function postJson(pathname, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env.mlServiceUrl}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      const err = new Error(`ML service ${res.status}: ${detail}`);
      err.status = res.status === 503 ? 503 : 502;
      throw err;
    }
    return res.json();
  } catch (cause) {
    if (cause.name === 'AbortError') {
      const err = new Error('ML service timed out');
      err.status = 504;
      throw err;
    }
    if (cause.status) throw cause;
    const err = new Error(`ML service unreachable at ${env.mlServiceUrl}`);
    err.status = 503;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const mlClient = {
  /** Score + explain one transaction (optionally with graph + sanctions context). */
  score(payload) {
    return postJson('/score', payload);
  },

  /** Liveness + model metadata for the dashboard's model card. */
  async health() {
    const res = await fetch(`${env.mlServiceUrl}/health`).catch(() => null);
    return res?.ok ? res.json() : { status: 'unreachable' };
  },

  async modelMetadata() {
    const res = await fetch(`${env.mlServiceUrl}/model`).catch(() => null);
    if (!res?.ok) {
      const err = new Error('Model metadata unavailable');
      err.status = 503;
      throw err;
    }
    return res.json();
  },
};
