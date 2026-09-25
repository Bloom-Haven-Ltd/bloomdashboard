import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Compass className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-900">Page not found</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        The page you requested does not exist or was moved.
      </p>
      <Link href="/dashboard" className="mt-5">
        <Button variant="outline" size="sm">
          Back to dashboard
        </Button>
      </Link>
    </div>
  );
}
