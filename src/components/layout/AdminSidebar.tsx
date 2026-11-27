'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  FlaskConical,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Microscope,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Plug,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTubes,
  Timer,
  ToggleLeft,
  UserCircle,
  UserCog,
  UserX,
  Users,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { NAV_GROUPS, type NavItem } from './navigation';
import { isPermission, type Permission } from '@/lib/permissions';
import { Tooltip } from '@/components/ui/Tooltip';
import { Avatar } from '@/components/ui/Avatar';
import { MOTION_EASE } from '@/lib/motion';

/** Icon registry — navigation stores icon names, never components. */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  FlaskConical,
  Plug,
  Timer,
  ToggleLeft,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Microscope,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTubes,
  UserCircle,
  UserCog,
  UserX,
  Users,
  Video,
  Wallet,
  X,
};

export interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({ collapsed, onToggleCollapsed, mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { can, role } = useAuth();

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => isPermission(item.permission) && can(item.permission as Permission)),
      })).filter((group) => group.items.length > 0),
    [can]
  );

  if (!role) return null;

  return (
    <>
      {/* ── Desktop collapsible sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-(--z-sticky) hidden flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav groups={groups} pathname={pathname} collapsed={collapsed} />
        <SidebarFooter collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-14 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted shadow-sm transition-colors hover:border-border-strong hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-pressed={collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </aside>

      {/* ── Mobile slide-in drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-(--z-drawer) lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
              onClick={onMobileClose}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: MOTION_EASE }}
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-border pr-3">
                <SidebarBrand collapsed={false} />
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="rounded-md p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <SidebarNav groups={groups} pathname={pathname} collapsed={false} onNavigate={onMobileClose} />
              <SidebarFooter collapsed={false} onNavigate={onMobileClose} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        'flex h-14 shrink-0 items-center border-b border-border transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-primary',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4'
      )}
    >
      <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold tracking-tight text-primary-foreground shadow-sm">
        BH
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold tracking-tight text-foreground">Bloom Haven Health</span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-primary">
            Operations Console
          </span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: typeof NAV_GROUPS;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin navigation" className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
      {groups.map((group) => (
        <div key={group.id}>
          {!collapsed ? (
            <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-widest text-foreground-subtle">
              {group.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-border" role="presentation" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon] ?? LayoutDashboard;

  const [hrefPath, hrefQuery] = item.href.split('?');
  const isActive = hrefQuery ? pathname === hrefPath : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);

  if (item.phase === 'later') {
    const disabled = (
      <span
        className={cn(
          'flex w-full cursor-not-allowed items-center gap-3 rounded-md text-xs font-medium text-foreground-subtle/60',
          collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
        )}
        aria-disabled
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>
    );
    return (
      <li>
        {collapsed ? (
          <Tooltip label={`${item.label} — coming soon`} side="right">
            {disabled}
          </Tooltip>
        ) : (
          disabled
        )}
      </li>
    );
  }

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-primary',
        collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
        isActive ? 'text-primary-hover font-semibold' : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
      )}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active-indicator"
          transition={{ duration: 0.2, ease: MOTION_EASE }}
          className="absolute inset-0 rounded-md bg-primary-subtle"
          aria-hidden
        />
      )}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" aria-hidden />
      )}
      <Icon
        className={cn(
          'relative z-10 h-4 w-4 shrink-0 transition-colors duration-150',
          isActive ? 'text-primary-hover' : 'text-foreground-subtle group-hover:text-foreground'
        )}
        aria-hidden
      />
      {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip label={item.label} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}

function SidebarFooter({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { adminUser, logout } = useAuth();
  const name = adminUser
    ? `${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim() || adminUser.email
    : '…';

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-border p-2.5">
        <Tooltip label={`${name} · Profile`} side="right">
          <Link
            href="/profile"
            onClick={onNavigate}
            className="rounded-full focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Avatar name={name} size="sm" />
          </Link>
        </Tooltip>
        <Tooltip label="Sign out" side="right">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-danger-subtle hover:text-danger focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-3 space-y-2">
      <Link
        href="/profile"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Avatar name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{name}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Administrator</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-muted transition-colors hover:bg-danger-subtle hover:text-danger focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Sign out
      </button>
    </div>
  );
}
