import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50">
      <div className="text-sm font-medium text-neutral-400">404</div>
      <h1 className="text-lg font-semibold text-neutral-900">Page not found</h1>
      <Link to="/" className="text-sm font-medium text-accent-600 hover:text-accent-700">
        Back to dashboard
      </Link>
    </div>
  );
}
