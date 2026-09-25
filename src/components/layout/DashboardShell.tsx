'use client';

import { useState, type ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'bloom.admin.nav_collapsed';

function readInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Application shell (§6): sidebar + header + main content with a skip link
 * (§53). Owns the sidebar collapsed/mobile state so the content margin stays
 * in sync with the sidebar width on desktop. Initial collapsed state is read
 * lazily during first render — no setState-in-effect.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  // Lazy initializer keeps SSR output (false) consistent and avoids effects.
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Ignore persistence failures.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* §53: skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-toast) focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <AdminHeader onMobileNavOpen={() => setMobileOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
