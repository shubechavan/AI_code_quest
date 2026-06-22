import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar.jsx';

/** Authenticated shell: persistent sidebar + routed content. The Topbar is rendered per
 * page so each screen owns its title and header actions. */
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
