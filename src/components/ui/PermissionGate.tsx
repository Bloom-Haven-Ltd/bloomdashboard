'use client';

/**
 * PermissionGate — conditional rendering based on session permissions (§7/§79).
 *
 * UX gate only: hiding a control here never authorizes anything. The backend
 * re-checks the permission on every request.
 */

import type { ReactNode } from 'react';
import { usePermissions } from '@/providers/AuthProvider';
import type { Permission } from '@/lib/permissions';

interface PermissionGateProps {
  permission: Permission | Permission[];
  /** Require every permission in the list (default: any one). */
  requireAll?: boolean;
  /** Render this instead when permission is missing. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ permission, requireAll = false, fallback = null, children }: PermissionGateProps) {
  const { can } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = requireAll
    ? permissions.every((p) => can(p))
    : permissions.some((p) => can(p));

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
