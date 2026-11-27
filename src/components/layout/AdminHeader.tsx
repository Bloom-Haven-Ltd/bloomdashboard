'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Video,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/providers/AuthProvider';
import { resolveNavItem } from './navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { env } from '@/lib/config/env';
import { useSystemStats } from '@/features/dashboard/hooks';
import { formatCount } from '@/lib/formatting/money';
import { isPermission, type Permission } from '@/lib/permissions';
import { dropdownVariants } from '@/lib/motion';

function useHeaderContext(): { groupLabel: string | null; title: string } {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const resolved = resolveNavItem(pathname, search ? `?${search}` : '');
  if (resolved) {
    return { groupLabel: resolved.group.label, title: resolved.item.label };
  }
  const segment = pathname.split('/').filter(Boolean).pop();
  return {
    groupLabel: null,
    title: segment ? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Overview',
  };
}

/** Global search entry — keyboard "/" shortcut supported. */
function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    router.push(`/users?search=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} role="search" aria-label="Global search" className="hidden min-w-0 flex-1 max-w-sm md:block">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users…"
          aria-keyshortcuts="/"
          className="h-8.5 w-full rounded-lg border border-border bg-surface-muted/70 pl-8.5 pr-9 text-xs text-foreground placeholder:text-foreground-subtle transition-colors focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground-subtle"
        >
          /
        </kbd>
      </div>
    </form>
  );
}

/**
 * Operational notification center powered by live `/admin/stats` counts.
 * Zero fabricated alerts — only surfaces real actionable queues.
 */
function NotificationCenter() {
  const { can } = useAuth();
  const stats = useSystemStats();
  const [open, setOpen] = useState(false);

  const items = stats.data
    ? (
        [
          stats.data.pending_verifications > 0 && {
            key: 'verifications',
            title: `${formatCount(stats.data.pending_verifications)} pending verification${stats.data.pending_verifications === 1 ? '' : 's'}`,
            description: 'Partner applications awaiting review.',
            href: '/verification',
            icon: ShieldCheck,
            permission: 'verification.read' as Permission,
          },
          stats.data.total_disputes > 0 && {
            key: 'disputes',
            title: `${formatCount(stats.data.total_disputes)} open dispute${stats.data.total_disputes === 1 ? '' : 's'}`,
            description: 'Support tickets requiring resolution.',
            href: '/support',
            icon: LifeBuoy,
            permission: 'support.read' as Permission,
          },
          stats.data.active_consultations > 0 && {
            key: 'consultations',
            title: `${formatCount(stats.data.active_consultations)} active consultation${stats.data.active_consultations === 1 ? '' : 's'}`,
            description: 'Live clinical sessions in progress.',
            href: '/consultations',
            icon: Video,
            permission: 'consultations.read' as Permission,
          },
        ].filter(Boolean) as Array<{
          key: string;
          title: string;
          description: string;
          href: string;
          icon: typeof ShieldCheck;
          permission: Permission;
        }>
      ).filter((item) => isPermission(item.permission) && can(item.permission))
    : [];

  const hasUnread = items.length > 0;

  return (
    <div className="relative">
      <Tooltip label="Operational alerts" side="bottom">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={hasUnread ? `Operational alerts (${items.length} active)` : 'Operational alerts'}
          className="relative rounded-md p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Bell className="h-4.5 w-4.5" aria-hidden />
          {hasUnread && (
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-secondary ring-2 ring-surface"
              aria-hidden
            />
          )}
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-(--z-dropdown)" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              role="region"
              aria-label="Operational alerts"
              variants={dropdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute right-0 z-(--z-popover) mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Operational Alerts</p>
                <span className="rounded-pill bg-primary-subtle px-2 py-0.5 text-[10px] font-bold text-primary">
                  {items.length} active
                </span>
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">All clear</p>
                  <p className="mt-0.5 text-xs text-foreground-muted">No pending operational alerts right now.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {items.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary-subtle text-warning">
                          <item.icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-foreground">{item.title}</span>
                          <span className="block text-[11px] text-foreground-muted">{item.description}</span>
                        </span>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AdminHeader({ onMobileNavOpen }: { onMobileNavOpen?: () => void }) {
  const { adminUser, can, logout } = useAuth();
  const { groupLabel, title } = useHeaderContext();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = adminUser
    ? `${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim() || adminUser.email
    : '…';

  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur-sm lg:px-6">
      {/* Mobile nav trigger */}
      <button
        type="button"
        onClick={() => onMobileNavOpen?.()}
        className="rounded-md p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {/* Contextual breadcrumb + title */}
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        {groupLabel && (
          <>
            <span className="hidden text-xs font-medium text-foreground-subtle sm:inline">{groupLabel}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-border-strong sm:inline" aria-hidden />
          </>
        )}
        <h1 className="truncate text-sm font-bold tracking-tight text-foreground sm:text-base">{title}</h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <GlobalSearch />

        {!env.isProduction && (
          <span className="hidden rounded-pill bg-secondary-subtle px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-warning ring-1 ring-inset ring-secondary/30 sm:inline-flex">
            Dev
          </span>
        )}

        <NotificationCenter />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={displayName} size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block max-w-[10rem] truncate text-xs font-semibold text-foreground">{displayName}</span>
              <span className="block text-[10px] font-semibold text-primary">Administrator</span>
            </span>
            <ChevronDown
              className={
                menuOpen
                  ? 'h-3.5 w-3.5 rotate-180 text-foreground-muted transition-transform duration-150'
                  : 'h-3.5 w-3.5 text-foreground-muted transition-transform duration-150'
              }
              aria-hidden
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-(--z-dropdown)" onClick={() => setMenuOpen(false)} aria-hidden />
                <motion.div
                  role="menu"
                  variants={dropdownVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="absolute right-0 z-(--z-popover) mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-subtle">Signed in as</p>
                    <p className="truncate text-xs font-semibold text-foreground">{adminUser?.email}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-success-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                      Active session
                    </span>
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
                  {can('settings.read') && (
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      <Settings className="h-4 w-4 text-foreground-subtle" aria-hidden />
                      Platform settings
                    </Link>
                  )}
                  <div className="my-1 border-t border-border" />
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
