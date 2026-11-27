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
      const apiError = ApiError.from(cause);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Sign-in failed:', apiError.code);
      }
      // Generic copy: never leak whether the account exists (§62).
      if (apiError.code === 'FORBIDDEN') {
        setError('This account does not have administrator access.');
      } else if (apiError.code === 'TIMEOUT') {
        setError('The server took too long to respond (it may be waking up). Please try again.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Unable to reach the server. Check your connection and try again.');
      } else {
        setError('Sign-in failed. Check your credentials and try again.');
      }
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
    <div className="flex min-h-screen bg-surface">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#004D4D] lg:block">
        <Image
          src="/images/login-bg.png"
          alt=""
          fill
          sizes="50vw"
          className="object-cover object-center opacity-50"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#003D3D]/90 via-[#004D4D]/40 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-end p-14">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
              <ShieldCheck className="h-6 w-6 text-white" aria-hidden />
            </span>
            <span className="text-3xl font-extrabold italic tracking-tight text-white">Bloom.</span>
          </div>
          <h2 className="max-w-md text-2xl font-bold leading-snug text-white">
            Administrative control for Bloom Haven Health
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
            Secure access to operations, verification, finance and platform oversight.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-background p-6 sm:p-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="text-2xl font-extrabold italic tracking-tight text-foreground">Bloom.</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">Administrator sign-in</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Authorized personnel only. Sessions are validated against the platform backend.
          </p>

          <div className="mt-8 rounded-lg border border-border bg-surface p-8 shadow-sm">
            {error && (
              <div
                role="alert"
                className="mb-6 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
              >
                {error}
              </div>
            )}
            {resetNotice && (
              <div
                role="status"
                className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"
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

          <p className="mt-6 text-center text-xs text-foreground-subtle">
            Bloom Haven Health Admin · v{env.appVersion}
          </p>
        </div>
      </div>
    </div>
  );
}
