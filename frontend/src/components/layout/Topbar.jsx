import { useState } from 'react';

import { useAuth } from '../../context/AuthContext.jsx';
import { titleCase } from '../../lib/format.js';

/** Page header with title slot and a user menu (identity + sign out). */
export function Topbar({ title, subtitle, actions }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-neutral-100"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium text-neutral-900">{user?.name}</span>
              <span className="block text-[11px] text-neutral-500">{titleCase(user?.role)}</span>
            </span>
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-md border border-neutral-200 bg-white py-1 shadow-card">
                <div className="border-b border-neutral-100 px-3 py-2">
                  <div className="text-sm font-medium text-neutral-900">{user?.name}</div>
                  <div className="text-xs text-neutral-500">{user?.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
