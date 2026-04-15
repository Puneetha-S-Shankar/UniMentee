import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldOff className="h-16 w-16 text-amber-500" aria-hidden />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">403 — Access denied</h1>
      <p className="max-w-md text-gray-600 dark:text-gray-400">
        You do not have permission to view this page. Contact your administrator if you believe this is an error.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Go to home
      </Link>
    </div>
  );
}
