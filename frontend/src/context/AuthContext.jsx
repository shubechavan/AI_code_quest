/**
 * Authentication context.
 *
 * Holds the current user and exposes login/logout. On mount it restores a session from a
 * persisted token by calling /auth/me, so a refresh keeps the user signed in. While that
 * check is in flight, `loading` is true and the app shows a splash rather than flashing
 * the login screen.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.me();
        if (active) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: me, accessToken, refreshToken } = await api.login(email, password);
    tokenStore.set({ accessToken, refreshToken });
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* best-effort */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (perm) => {
      // The token carries permissions; for UI gating we rely on role since the public
      // user object exposes role. The server remains the source of truth.
      const ROLE_PERMS = {
        analyst: ['transaction:read', 'transaction:analyze', 'report:generate'],
        risk_manager: [
          'transaction:read', 'transaction:analyze', 'report:generate',
          'alert:resolve', 'audit:read',
        ],
        admin: [
          'transaction:read', 'transaction:analyze', 'report:generate',
          'alert:resolve', 'audit:read', 'user:manage',
        ],
      };
      return (ROLE_PERMS[user?.role] ?? []).includes(perm);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
