import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base">
      <div className="text-sm font-medium text-faint">404</div>
      <h1 className="text-lg font-semibold text-fg">Page not found</h1>
      <Link to="/" className="text-sm font-medium text-accent-400 hover:text-accent-300">
        Back to dashboard
      </Link>
    </div>
  );
}
