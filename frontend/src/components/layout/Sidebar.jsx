import { NavLink } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Primary navigation. Items are filtered by permission so each persona sees only what
 * their role grants — the server enforces the same rules, this just avoids dead links.
 */
const NAV = [
  { to: '/', label: 'Dashboard', perm: 'transaction:read', icon: GridIcon, end: true },
  { to: '/alerts', label: 'Alert Queue', perm: 'transaction:read', icon: ListIcon },
  { to: '/analyze', label: 'Analyze Transaction', perm: 'transaction:analyze', icon: BoltIcon },
  { to: '/reports', label: 'Reports', perm: 'report:generate', icon: DocIcon },
  { to: '/audit', label: 'Audit Log', perm: 'audit:read', icon: ShieldIcon },
  { to: '/admin', label: 'Administration', perm: 'user:manage', icon: UsersIcon },
];

export function Sidebar() {
  const { hasPermission } = useAuth();
  const items = NAV.filter((i) => hasPermission(i.perm));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-xs font-bold text-white">
          DS
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-fg">DarkSentinel</div>
          <div className="text-[11px] text-muted">Risk Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-500/10 text-accent-400'
                  : 'text-muted hover:bg-elevated hover:text-fg'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

/* Inline 18px stroke icons — no icon dependency, consistent weight. */
const ico = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
function GridIcon() { return <svg {...ico}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>; }
function ListIcon() { return <svg {...ico}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>; }
function BoltIcon() { return <svg {...ico}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>; }
function DocIcon() { return <svg {...ico}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>; }
function ShieldIcon() { return <svg {...ico}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function UsersIcon() { return <svg {...ico}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
