import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge proxy (Next.js 16 convention, formerly `middleware.ts`) — UX protection
 * layer, NOT an authorization boundary (§36).
 *
 * Responsibilities here:
 * - Redirect unauthenticated visitors away from dashboard routes (the real
 *   check happens when the backend validates the session; API requests are
 *   authorized server-side per request).
 * - Apply security headers, including a CSP tuned for this app's needs.
 *
 * Never treat a passing proxy check as permission: the backend is the
 * sole authority for every protected operation.
 */

const SESSION_HINT_COOKIE = 'bloom.admin.hint';

/** Route prefixes that require a signed-in administrator. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/users',
  '/appointments',
  '/consultations',
  '/prescriptions',
  '/orders',
  '/pharmacies',
  '/lab-bookings',
  '/finance',
  '/verification',
  '/audit-logs',
  '/support',
  '/settings',
  '/profile',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Content-Security-Policy. 'unsafe-inline'/'unsafe-eval' are required by
 * Next.js hydration + Recharts' style injection today. Tightening to nonces
 * is tracked for the production-hardening phase — do not "fix" this blindly,
 * it will break hydration and Firebase Auth popups.
 */
function contentSecurityPolicy(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // Next.js inline scripts/styles + recharts dynamic styles.
    `style-src 'self' 'unsafe-inline'${isDev ? ' ' : ''}`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    // Firebase Auth (identitytoolkit, securetoken) + API + recharts data.
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
    'img-src \'self\' data: blob: https:',
    "font-src 'self' data:",
    'frame-ancestors \'none\'',
    'base-uri \'self\'',
    "form-action 'self'",
  ];
  return directives.join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  // Unauthenticated visitors never reach dashboard HTML (presence check only).
  const hasSessionHint = request.cookies.has(SESSION_HINT_COOKIE);

  if (pathname === '/') {
    const destination = hasSessionHint ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isProtected(pathname) && !hasSessionHint) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'authentication_required');
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(isDev));
  return response;
}

export const config = {
  matcher: [
    // Apply to all app pages but never to API proxies, static assets or favicon.
    '/((?!api/|_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
