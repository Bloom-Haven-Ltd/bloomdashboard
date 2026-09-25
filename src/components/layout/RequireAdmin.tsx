'use client';

/**
 * RequireAdmin — the single route guard for the dashboard (replaces
 * AdminGuard + ProtectedRoute).
 *
 * UX boundary only: redirects unauthenticated visitors and renders nothing
 * until the backend session validation completes. Authorization itself is
 * enforced by the backend on every request (§9/§36).
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Verifying session…</p>
      </div>
    );
  }

  if (!firebaseUser || !adminUser) return null;

  return <>{children}</>;
}
