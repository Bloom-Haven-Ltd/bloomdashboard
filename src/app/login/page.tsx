'use client';

/**
 * Administrator sign-in.
 *
 * Security behavior:
 * - Errors are generic (no user enumeration) and never echo raw exception text.
 * - The password field uses autocomplete="current-password"; the form disables
 *   double submission.
 * - Failed sign-ins are audited server-side by the backend session endpoint;
 *   no credentials or emails are logged client-side.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/lib/api/error';
import { env } from '@/lib/config/env';

export default function LoginPage() {
  const { signIn, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState(false);

  // Already signed in as a validated admin → straight to the console.
  useEffect(() => {
    if (!loading && isAdmin) {
      router.replace('/dashboard');
    }
  }, [loading, isAdmin, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/dashboard');
    } catch (cause) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Sign-in failed:', cause);
      }
      const apiError = ApiError.from(cause);
      // Generic copy: never leak whether the account exists (§62).
      setError(
        apiError.code === 'FORBIDDEN'
          ? 'This account does not have administrator access.'
          : 'Sign-in failed. Check your credentials and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      setError('Enter your email address first, then press "Forgot password".');
      return;
    }
    // Password reset is initiated from the mobile/backend flow; the dashboard
    // deliberately does not implement credential flows beyond sign-in.
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 6000);
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:block">
        <Image
          src="/images/login-bg.png"
          alt=""
          fill
          sizes="50vw"
          className="object-cover object-center opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-end p-14">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <ShieldCheck className="h-6 w-6 text-white" aria-hidden />
            </span>
            <span className="text-3xl font-extrabold italic tracking-tight text-white">Bloom.</span>
          </div>
          <h2 className="max-w-md text-2xl font-bold leading-snug text-white">
            Administrative control for Bloom Haven Health
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
            Secure access to operations, verification, finance and platform oversight.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-slate-50 p-6 sm:p-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="text-2xl font-extrabold italic tracking-tight text-slate-900">Bloom.</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administrator sign-in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Authorized personnel only. Sessions are validated against the platform backend.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            )}
            {resetNotice && (
              <div
                role="status"
                className="mb-6 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700"
              >
                Password recovery is handled by the platform team. Contact your administrator if you
                lost access.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <Input
                label="Email address"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@bloomhaven.health"
                required
              />
              <div>
                <Input
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="mt-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="w-full" isLoading={submitting} disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
                {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Bloom Haven Health Admin · v{env.appVersion}
          </p>
        </div>
      </div>
    </div>
  );
}
