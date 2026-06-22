import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Sign-in screen.
 *
 * Calm, centred, single-column. Role quick-select fills the credentials for each of the
 * three personas so a reviewer can move between the analyst, risk-manager, and admin views
 * without re-typing.
 */
const ROLES = [
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
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-sm font-bold text-white">
            DS
          </div>
          <div>
            <div className="text-base font-semibold text-fg">DarkSentinel</div>
            <div className="text-xs text-muted">Financial Crime Intelligence</div>
          </div>
        </div>

        <div className="surface p-6">
          <h1 className="text-lg font-semibold text-fg">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Access the financial-crime console.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email" type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-base px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent-500"
                placeholder="you@darksentinel.io"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <input
                id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line bg-base px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent-500"
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">Sign in</Button>
          </form>

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium text-muted">Sign in as</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((a) => (
                <button
                  key={a.email}
                  onClick={() => { setEmail(a.email); setPassword(a.password); }}
                  className="rounded-lg border border-line bg-elevated px-2 py-1.5 text-xs font-medium text-muted hover:border-accent-500/40 hover:text-fg"
                >
                  {a.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      {children}
    </div>
  );
}
