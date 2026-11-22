/**
 * Admin RBAC scaffold (§7).
 *
 * The FastAPI backend currently enforces a single `admin` role server-side;
 * this module is the frontend authorization *UX* layer: it drives which
 * navigation and actions are offered to which administrator. It is never a
 * security boundary — the backend re-authorizes every request (§9).
 *
 * When the backend introduces granular admin roles, extend `ROLE_PERMISSIONS`
 * and map the backend role here — no page code changes required.
 */

// ---------------------------------------------------------------------------
// Permission catalog
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  // People
  'users.read',
  'users.update',
  'users.suspend',
  'partners.read',
  'partners.verify',
  'partners.suspend',
  // Operations
  'appointments.read',
  'appointments.manage',
  'consultations.read',
  'consultations.manage',
  'prescriptions.read',
  'prescriptions.clinical',
  'prescriptions.manage',
  'pharmacy.read',
  'pharmacy.manage',
  'laboratory.read',
  'laboratory.manage',
  // Finance
  'finance.read',
  'finance.refund',
  'finance.reconcile',
  'finance.withdrawal.review',
  // Trust & safety
  'verification.read',
  'verification.review',
  'verification.approve',
  'verification.reject',
  'trust_safety.read',
  'documents.read',
  'documents.download',
  'audit.read',
  'security.read',
  // Support
  'support.read',
  'support.manage',
  // Platform
  'notifications.send',
  'settings.read',
  'settings.manage',
  // Content
  'content.read',
  'content.manage',
  // Meta
  'admin.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET = new Set<string>(PERMISSIONS);

/** Type-safe permission lookup for string sources (e.g. navigation config). */
export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

// ---------------------------------------------------------------------------
// Roles — mirrors the backend today (single admin role) with forward path
// ---------------------------------------------------------------------------

export type AdminRole = 'ADMIN';

/**
 * Role → permission matrix. ADMIN holds everything the dashboard offers.
 * Future roles should be subsets — e.g. a FINANCE_ADMIN would hold
 * finance.* + audit.read but not prescriptions.manage.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>(PERMISSIONS),
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export type CheckPermission = (permission: Permission) => boolean;

export function createPermissionChecker(role: AdminRole): CheckPermission {
  const granted = ROLE_PERMISSIONS[role];
  return (permission) => granted.has(permission);
}

/** All permissions held by a role (for debugging/tests). */
export function permissionsForRole(role: AdminRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
