import { useState } from 'react';

import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { titleCase } from '../../lib/format.js';

/** Page header with title slot, theme toggle, and a user menu (identity + sign out). */
export function Topbar({ title, subtitle, actions }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface/80 px-6 backdrop-blur">
      <div>
        <h1 className="text-base font-semibold text-fg">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-elevated"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium text-fg">{user?.name}</span>
              <span className="block text-[11px] text-muted">{titleCase(user?.role)}</span>
            </span>
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-lg border border-line bg-surface py-1 shadow-elevated">
                <div className="border-b border-line px-3 py-2">
                  <div className="text-sm font-medium text-fg">{user?.name}</div>
                  <div className="text-xs text-muted">{user?.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-3 py-2 text-left text-sm text-muted hover:bg-elevated hover:text-fg"
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

const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
function SunIcon() { return <svg {...ico}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>; }
function MoonIcon() { return <svg {...ico}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>; }
