'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Search, UserCog } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/providers/AuthProvider';
import { resolveNavItem } from './navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { env } from '@/lib/config/env';

function usePageTitle(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const resolved = resolveNavItem(pathname, search ? `?${search}` : '');
  if (resolved) return resolved.item.label;
  const segment = pathname.split('/').filter(Boolean).pop();
  return segment ? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Overview';
}

/** Global search entry (§11) — visual + keyboard entry point; backend powers results later. */
function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search (§11); Escape clears.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    // Phase 3: users directory is the first searchable, permission-filtered surface.
    router.push(`/users?search=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} role="search" aria-label="Global search" className="hidden min-w-0 flex-1 max-w-md md:block">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users… (press /)"
          aria-keyshortcuts="/"
          className="h-9 w-full rounded-md border border-border bg-surface-muted pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-subtle focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </form>
  );
}

export function AdminHeader({ onMobileNavOpen }: { onMobileNavOpen?: () => void }) {
  const { adminUser, logout } = useAuth();
  const title = usePageTitle();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = adminUser
    ? `${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim() || adminUser.email
    : '…';

  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-14 items-center gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-6">
      {/* Mobile nav trigger (§10) */}
      <button
        type="button"
        onClick={() => onMobileNavOpen?.()}
        className="rounded-md p-2 text-foreground-muted hover:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-primary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <h1 className="shrink-0 text-base font-bold tracking-tight text-foreground">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-2">
        <GlobalSearch />

        {/* Environment indicator (§13): always visible when not production */}
        {!env.isProduction && (
          <span className="hidden rounded-pill bg-warning-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-warning ring-1 ring-inset ring-warning/20 sm:inline-flex">
            Development
          </span>
        )}

        <Tooltip label="Notifications" side="bottom">
          <button
            type="button"
            className="relative rounded-md p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" aria-hidden />
          </button>
        </Tooltip>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="hidden text-right sm:block">
              <span className="block max-w-[12rem] truncate text-sm font-semibold text-foreground">{displayName}</span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-primary">Administrator</span>
            </span>
            <Avatar name={displayName} size="sm" />
            <ChevronDown className={menuOpen ? 'h-3.5 w-3.5 rotate-180 text-foreground-muted' : 'h-3.5 w-3.5 text-foreground-muted'} aria-hidden />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-(--z-dropdown)" onClick={() => setMenuOpen(false)} aria-hidden />
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-(--z-popover) mt-2 w-60 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-subtle">Signed in as</p>
                    <p className="truncate text-xs font-medium text-foreground">{adminUser?.email}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-success">Active</p>
                  </div>
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    <UserCog className="h-4 w-4 text-foreground-subtle" aria-hidden />
                    Profile & sessions
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger-subtle"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
