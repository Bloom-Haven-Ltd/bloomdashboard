'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
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
  Stethoscope,
  Plug,
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

/** Icon registry — navigation stores icon *names*, never components (§22). */
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
      {/* ── Desktop sidebar (§8) ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-(--z-sticky) hidden flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav groups={groups} pathname={pathname} collapsed={collapsed} />
        <SidebarFooter collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted shadow-sm transition-colors hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
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

      {/* ── Mobile drawer (§8/§52) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-(--z-drawer) lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={onMobileClose} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border pr-3">
              <SidebarBrand collapsed={false} />
              <button
                type="button"
                onClick={onMobileClose}
                className="rounded-md p-2 text-foreground-muted hover:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <SidebarNav groups={groups} pathname={pathname} collapsed={false} />
            <SidebarFooter collapsed={false} />
          </div>
        </div>
      )}
    </>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('flex h-16 shrink-0 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'gap-3 px-5')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        B
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold tracking-tight text-foreground">Bloom Haven Health</span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle">
            Admin Console
          </span>
        </span>
      )}
    </div>
  );
}

function SidebarNav({
  groups,
  pathname,
  collapsed,
}: {
  groups: typeof NAV_GROUPS;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <nav aria-label="Admin navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.id}>
          {!collapsed ? (
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-foreground-subtle">
              {group.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-border" role="presentation" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = ICONS[item.icon] ?? LayoutDashboard;

  const [hrefPath, hrefQuery] = item.href.split('?');
  // §9: parent stays active on nested routes; query-filtered items match exactly.
  const isActive = hrefQuery ? pathname === hrefPath : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);

  if (item.phase === 'later') {
    const disabled = (
      <span
        className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground-subtle/60"
        aria-disabled
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && item.label}
      </span>
    );
    return (
      <li>
        {collapsed ? (
          <Tooltip label={`${item.label} — coming soon`} side="bottom">
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
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-primary',
        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
        isActive
          ? 'bg-primary-subtle text-primary'
          : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-foreground-subtle')} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip label={item.label} side="bottom">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { adminUser } = useAuth();
  const name = adminUser
    ? `${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim() || adminUser.email
    : '…';

  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-border p-3">
        <Tooltip label={name} side="top">
          <Avatar name={name} size="sm" />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{name}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Administrator</p>
        </div>
      </div>
    </div>
  );
}
