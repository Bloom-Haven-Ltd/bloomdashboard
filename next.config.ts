import type { NextConfig } from "next";

/**
 * Origin of the FastAPI backend used by the same-origin `/api/v1` rewrite.
 * - Development: leave unset to use the local backend (127.0.0.1:8000).
 * - Production: MUST be set to the platform's internal API service.
 *
 * This value is server-side only — it is never shipped to the browser.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

/** Baseline security headers applied to every response.
 *  Content-Security-Policy is injected by middleware (see src/middleware.ts)
 *  because it needs to differ between development (HMR, React strict) and
 *  production. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
