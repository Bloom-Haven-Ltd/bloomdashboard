import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  createPermissionChecker,
  isPermission,
  permissionsForRole,
} from '@/lib/permissions';

describe('permissions catalog', () => {
  it('defines a non-empty catalog with no duplicates', () => {
    expect(PERMISSIONS.length).toBeGreaterThan(10);
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('covers the required domains', () => {
    const required = [
      'users.read', 'users.suspend',
      'partners.verify',
      'verification.approve', 'verification.reject',
      'finance.read', 'finance.refund',
      'audit.read',
      'settings.manage',
    ];
    for (const permission of required) {
      expect(isPermission(permission)).toBe(true);
    }
  });

  it('rejects unknown permission strings', () => {
    expect(isPermission('users.delete_everything')).toBe(false);
    expect(isPermission('')).toBe(false);
  });
});

describe('role matrix', () => {
  it('grants ADMIN the full catalog', () => {
    const adminPermissions = permissionsForRole('ADMIN');
    expect(new Set(adminPermissions)).toEqual(new Set(PERMISSIONS));
  });

  it('checker grants catalog permissions to ADMIN', () => {
    const can = createPermissionChecker('ADMIN');
    expect(can('users.read')).toBe(true);
    expect(can('finance.refund')).toBe(true);
    expect(can('verification.approve')).toBe(true);
  });
});

describe('forward compatibility', () => {
  it('keeps every permission assigned to at least one role', () => {
    const assigned = new Set<string>();
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) assigned.add(permission);
    }
    for (const permission of PERMISSIONS) {
      expect(assigned.has(permission)).toBe(true);
    }
  });
});
