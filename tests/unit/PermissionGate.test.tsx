import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { usePermissions } from '@/providers/AuthProvider';
import type { ReactNode } from 'react';

// AuthProvider touches Firebase/network on mount; stub the consumed hooks.
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
}));

const mockedUsePermissions = vi.mocked(usePermissions);

function renderWithPermissions(can: (permission: string) => boolean, ui: ReactNode) {
  mockedUsePermissions.mockReturnValue({
    can: can as never,
    isAdmin: true,
  });
  return render(ui);
}

describe('PermissionGate', () => {
  it('renders children when the permission is granted', () => {
    renderWithPermissions(
      () => true,
      <PermissionGate permission="users.read">
        <p>protected content</p>
      </PermissionGate>
    );
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('renders fallback when the permission is denied', () => {
    renderWithPermissions(
      () => false,
      <PermissionGate permission="finance.refund" fallback={<p>no access</p>}>
        <p>protected content</p>
      </PermissionGate>
    );
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByText('no access')).toBeInTheDocument();
  });

  it('supports multi-permission gating with requireAll', () => {
    const partial = (p: string) => p !== 'finance.reconcile';

    renderWithPermissions(
      partial,
      <PermissionGate permission={['finance.read', 'finance.reconcile']} requireAll>
        <p>all required</p>
      </PermissionGate>
    );
    expect(screen.queryByText('all required')).not.toBeInTheDocument();

    renderWithPermissions(
      () => true,
      <PermissionGate permission={['finance.read', 'finance.reconcile']} requireAll>
        <p>all required</p>
      </PermissionGate>
    );
    expect(screen.getByText('all required')).toBeInTheDocument();
  });

  it('any-of semantics by default', () => {
    renderWithPermissions(
      (p) => p === 'audit.read',
      <PermissionGate permission={['audit.read', 'security.read']}>
        <p>any of</p>
      </PermissionGate>
    );
    expect(screen.getByText('any of')).toBeInTheDocument();
  });
});
