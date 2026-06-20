/**
 * Thin API client.
 *
 * Wraps fetch with: bearer-token injection, JSON handling, a single place for error
 * normalisation, and transparent access-token refresh on 401. Tokens live in memory with
 * a localStorage mirror so a page reload keeps the session.
 */
const ACCESS_KEY = 'ds.accessToken';
const REFRESH_KEY = 'ds.refreshToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function rawRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(payload.error ?? res.statusText, res.status, payload);
  }
  return payload;
}

let refreshing = null;

async function request(path, opts = {}) {
  try {
    return await rawRequest(path, opts);
  } catch (err) {
    // Attempt one transparent refresh on an expired access token.
    if (err.status === 401 && opts.auth !== false && tokenStore.refresh && !opts._retried) {
      refreshing ??= rawRequest('/auth/refresh', {
        method: 'POST',
        auth: false,
        body: { refreshToken: tokenStore.refresh },
      })
        .then((tokens) => {
          tokenStore.set(tokens);
          return tokens;
        })
        .finally(() => {
          refreshing = null;
        });
      try {
        await refreshing;
        return await rawRequest(path, { ...opts, _retried: true });
      } catch {
        tokenStore.clear();
        throw err;
      }
    }
    throw err;
  }
}

export const api = {
  login: (email, password) =>
    rawRequest('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  dashboardSummary: () => request('/dashboard/summary'),

  listTransactions: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ''),
    ).toString();
    return request(`/transactions${q ? `?${q}` : ''}`);
  },
  getTransaction: (id) => request(`/transactions/${id}`),
  getTransactionGraph: (id) => request(`/transactions/${id}/graph`),
  analyzeTransaction: (payload) =>
    request('/transactions/analyze', { method: 'POST', body: payload }),

  generateReport: (assessmentId) =>
    request(`/reports/${assessmentId}/generate`, { method: 'POST' }),
  getReport: (id) => request(`/reports/${id}`),
  listReports: () => request('/reports'),

  auditLogs: () => request('/admin/audit-logs'),
  listUsers: () => request('/admin/users'),
};
