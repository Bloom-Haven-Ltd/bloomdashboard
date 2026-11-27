'use client';

/**
 * RequireAdmin — the single route guard for the dashboard.
 *
 * UX boundary only: redirects unauthenticated visitors and renders nothing
 * until the backend session validation completes. Authorization itself is
 * enforced by the backend on every request.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { firebaseUser, adminUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace('/login');
    }
  }, [loading, firebaseUser, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-subtle">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-foreground">Bloom Haven Health</p>
          <p className="mt-1 text-xs text-foreground-muted">Verifying secure session…</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !adminUser) return null;

  return <>{children}</>;
}
