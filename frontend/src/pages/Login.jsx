import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Sign-in screen.
 *
 * Calm, centred, single-column. The demo credentials are surfaced explicitly because this
 * is a local evaluation build — in production that panel would not exist.
 */
const DEMO_ACCOUNTS = [
  { role: 'Analyst', email: 'analyst@darksentinel.io', password: 'Analyst#2026' },
  { role: 'Risk Manager', email: 'manager@darksentinel.io', password: 'Manager#2026' },
  { role: 'Admin', email: 'admin@darksentinel.io', password: 'Admin#2026' },
];

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Invalid email or password.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-sm font-bold text-white">
            DS
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-900">DarkSentinel</div>
            <div className="text-xs text-neutral-500">Risk Intelligence Console</div>
          </div>
        </div>

        <div className="surface p-6">
          <h1 className="text-lg font-semibold text-neutral-900">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">Access the financial-crime console.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-accent-500"
                placeholder="you@darksentinel.io"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-accent-500"
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </div>

        <div className="mt-4 rounded-md border border-neutral-200 bg-white/60 p-3">
          <p className="mb-2 text-xs font-medium text-neutral-500">Demo accounts (local build)</p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-neutral-100"
              >
                <span className="font-medium text-neutral-700">{a.role}</span>
                <span className="font-mono text-neutral-400">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
    </div>
  );
}
