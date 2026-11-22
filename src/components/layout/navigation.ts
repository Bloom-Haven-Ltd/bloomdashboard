/**
 * Admin navigation model (§6) — grouped by operational responsibility.
 * Single source consumed by the sidebar, breadcrumbs, and page titles.
 * Routes marked `phase: 'later'` are scaffolding for upcoming phases; they
 * are rendered disabled rather than hidden so the IA is visible to admins.
 */

export type NavPermission =
  | 'admin.read'
  | 'users.read'
  | 'partners.read'
  | 'verification.read'
  | 'trust_safety.read'
  | 'appointments.read'
  | 'consultations.read'
  | 'prescriptions.read'
  | 'pharmacy.read'
  | 'laboratory.read'
  | 'finance.read'
  | 'support.read'
  | 'content.read'
  | 'audit.read'
  | 'settings.read';

export interface NavItem {
  label: string;
  href: string;
  permission: NavPermission;
  icon: string;
  /** 'now' = implemented in this phase; 'later' = placeholder route. */
  phase: 'now' | 'later';
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', permission: 'admin.read', icon: 'LayoutDashboard', phase: 'now' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Patients', href: '/users?role=patient', permission: 'users.read', icon: 'Users', phase: 'now' },
      { label: 'All Users', href: '/users', permission: 'users.read', icon: 'UserCircle', phase: 'now' },
      { label: 'Partners', href: '/partners', permission: 'partners.read', icon: 'Handshake', phase: 'now' },
      { label: 'Restricted Accounts', href: '/users?status=suspended', permission: 'users.read', icon: 'UserX', phase: 'later' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { label: 'Appointments', href: '/appointments', permission: 'appointments.read', icon: 'CalendarDays', phase: 'now' },
      { label: 'Consultations', href: '/consultations', permission: 'consultations.read', icon: 'Stethoscope', phase: 'now' },
      { label: 'Telehealth', href: '/telehealth', permission: 'consultations.read', icon: 'Video', phase: 'now' },
      { label: 'Pharmacy', href: '/pharmacy', permission: 'pharmacy.read', icon: 'Building2', phase: 'now' },
      { label: 'Prescriptions', href: '/prescriptions', permission: 'prescriptions.read', icon: 'Pill', phase: 'now' },
      { label: 'Pharmacy Orders', href: '/orders', permission: 'pharmacy.read', icon: 'Package', phase: 'now' },
      { label: 'Laboratory', href: '/laboratory', permission: 'laboratory.read', icon: 'Microscope', phase: 'now' },
      { label: 'Lab Bookings', href: '/lab-bookings', permission: 'laboratory.read', icon: 'TestTubes', phase: 'now' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { label: 'Finance Overview', href: '/finance', permission: 'finance.read', icon: 'Wallet', phase: 'now' },
      { label: 'Payments', href: '/finance/payments', permission: 'finance.read', icon: 'CreditCard', phase: 'now' },
      { label: 'Withdrawal Review', href: '/finance/withdrawals', permission: 'finance.read', icon: 'Banknote', phase: 'now' },
      { label: 'Reconciliation', href: '/finance/reconciliation', permission: 'finance.read', icon: 'Scale', phase: 'now' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { label: 'Daily Affirmations', href: '/affirmations', permission: 'content.read', icon: 'Sparkles', phase: 'now' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Platform Health', href: '/platform', permission: 'admin.read', icon: 'Activity', phase: 'now' },
      { label: 'Audit Logs', href: '/audit-logs', permission: 'audit.read', icon: 'ScrollText', phase: 'now' },
      { label: 'Security Events', href: '/platform/security', permission: 'audit.read', icon: 'Lock', phase: 'now' },
      { label: 'Feature Flags', href: '/platform/feature-flags', permission: 'settings.read', icon: 'ToggleLeft', phase: 'now' },
      // Backend does not expose jobs, WebSocket metrics or API metrics yet
      // (platform-audit.md PS-6/PS-7/PS-9) — scaffolding, not fake pages.
      { label: 'Jobs & Workers', href: '/platform/jobs', permission: 'admin.read', icon: 'Timer', phase: 'later' },
      { label: 'Integrations', href: '/platform/integrations', permission: 'admin.read', icon: 'Plug', phase: 'later' },
    ],
  },
  {
    id: 'trust-safety',
    label: 'Trust & Safety',
    items: [
      { label: 'Verification', href: '/verification', permission: 'verification.read', icon: 'ShieldCheck', phase: 'now' },
      // Backend has no case model yet (trust-safety-audit.md BG-4) — kept as
      // scaffolding so the IA is visible without faking capability.
      { label: 'Trust & Safety Cases', href: '/trust-safety', permission: 'trust_safety.read', icon: 'ShieldAlert', phase: 'later' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { label: 'Disputes & Tickets', href: '/support', permission: 'support.read', icon: 'LifeBuoy', phase: 'now' },
      // Leads captured from the public site (contact + partnership forms).
      // `support.read`/`support.manage` are reused deliberately: the backend
      // authorises these endpoints on the single `admin` role, so inventing a
      // finer-grained permission here would be a frontend fiction (§7/§9).
      { label: 'Public Inquiries', href: '/inquiries', permission: 'support.read', icon: 'Inbox', phase: 'now' },
      // App-launch waitlist (marketing site /waitlist). Same authorisation
      // posture as inquiries: the backend gates /waitlist on the admin role.
      { label: 'Waitlist', href: '/waitlist', permission: 'support.read', icon: 'Users', phase: 'now' },
    ],
  },
  {
    id: 'account-settings',
    label: 'Account & Settings',
    items: [
      { label: 'Settings', href: '/settings', permission: 'settings.read', icon: 'Settings', phase: 'now' },
      { label: 'Profile', href: '/profile', permission: 'admin.read', icon: 'UserCog', phase: 'now' },
    ],
  },
];

/** Flatten for breadcrumb/title lookup. Longest href match wins. */
export function resolveNavItem(pathname: string, search = ''): { item: NavItem; group: NavGroup } | null {
  let best: { item: NavItem; group: NavGroup } | null = null;
  let bestLength = 0;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const [hrefPath, hrefQuery] = item.href.split('?');
      const matchesPath = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
      const matchesQuery = !hrefQuery || search.includes(hrefQuery);
      if (matchesPath && matchesQuery && item.href.length > bestLength) {
        best = { item, group };
        bestLength = item.href.length;
      }
    }
  }
  return best ?? null;
}
