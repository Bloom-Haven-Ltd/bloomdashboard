'use client';

/**
 * Partners directory (§16/§17) — one shared architecture across doctor /
 * laboratory / pharmacy, type-switched via URL tab (§31/§68). Lists consume
 * the verified public profile endpoints; sensitive documents are not fetched
 * (see docs/admin/users-partners-audit.md).
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, FlaskConical, Search, Stethoscope } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/data-display/DataTable';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDoctors, useLabs, usePharmacies } from '@/features/partners/hooks';
import { formatDate } from '@/lib/formatting/dates';
import { partnerStatusConfig, getStatusConfig, verificationStatusConfig } from '@/constants/status';

type TabId = 'doctor' | 'lab' | 'pharmacy';

const TABS: Array<{ id: TabId; label: string; icon: typeof Stethoscope }> = [
  { id: 'doctor', label: 'Doctors', icon: Stethoscope },
  { id: 'lab', label: 'Laboratories', icon: FlaskConical },
  { id: 'pharmacy', label: 'Pharmacies', icon: Building2 },
];

const PER_PAGE = 20;

export default function PartnersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = (TABS.find((t) => t.id === searchParams.get('type'))?.id ?? 'doctor') as TabId;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const search = searchParams.get('search') ?? '';

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || (key === 'page' && value === '1') || (key === 'type' && value === 'doctor')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace(`/partners${next.toString() ? `?${next.toString()}` : ''}`);
  };

  useEffect(() => {
    if (searchDraft === search) return;
    const timer = setTimeout(() => setParams({ search: searchDraft || null, page: null }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const doctors = useDoctors(type === 'doctor' ? page : 1, PER_PAGE, type === 'doctor' ? search : '');
  const labs = useLabs(type === 'lab' ? page : 1, PER_PAGE, type === 'lab' ? search : '');
  const pharmacies = usePharmacies(type === 'pharmacy' ? page : 1, PER_PAGE, type === 'pharmacy' ? search : '');

  const activeQuery = type === 'doctor' ? doctors : type === 'lab' ? labs : pharmacies;

  // Type-specific columns share the row-shape contract: id, name, meta, verified/status, rating, joined.
  const columns = [
    {
      key: 'partner',
      header: 'Partner',
      cell: (row: { id: string; name: string; sub: string }) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{row.name}</p>
            <p className="truncate text-xs text-foreground-muted">{row.sub}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: { statusLabel: string; statusTone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary'; meaning: string }) => (
        <StatusBadge label={row.statusLabel} tone={row.statusTone} title={row.meaning} />
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      hideBelow: 'sm' as const,
      cell: (row: { rating: number | undefined }) => (
        <span className="text-foreground-muted">{row.rating != null ? row.rating.toFixed(1) : '—'}</span>
      ),
    },
    {
      key: 'joined',
      header: 'Registered',
      hideBelow: 'md' as const,
      cell: (row: { joined: string }) => <span className="text-foreground-muted">{formatDate(row.joined)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      cell: (row: { id: string }) => (
        <Link
          href={`/partners/${type}/${row.id}`}
          className="text-sm font-semibold text-primary hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
        >
          View profile
        </Link>
      ),
    },
  ];

  const rows = (() => {
    if (type === 'doctor') {
      return (doctors.data?.items ?? []).map((d) => ({
        id: d.id,
        name: [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Doctor profile',
        sub: d.specialty,
        statusLabel: d.is_verified
          ? verificationStatusConfig.approved.label
          : verificationStatusConfig.pending.label,
        statusTone: d.is_verified ? verificationStatusConfig.approved.tone : verificationStatusConfig.pending.tone,
        meaning: d.is_verified ? 'Verified provider' : 'Awaiting verification review',
        rating: d.rating,
        joined: d.created_at,
      }));
    }
    if (type === 'lab') {
      return (labs.data?.items ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        sub: 'Laboratory',
        statusLabel: l.is_verified ? verificationStatusConfig.approved.label : verificationStatusConfig.pending.label,
        statusTone: l.is_verified ? verificationStatusConfig.approved.tone : verificationStatusConfig.pending.tone,
        meaning: l.is_verified ? 'Verified laboratory' : 'Awaiting verification review',
        rating: l.rating,
        joined: l.created_at,
      }));
    }
    return (pharmacies.data?.items ?? []).map((p) => {
      const statusConfig = getStatusConfig(partnerStatusConfig, p.status);
      return {
        id: p.id,
        name: p.name,
        sub: p.pharmacy_type,
        statusLabel: statusConfig.label,
        statusTone: statusConfig.tone,
        meaning: statusConfig.meaning,
        rating: p.rating,
        joined: p.created_at,
      };
    });
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'People' }, { label: 'Partners' }]}
        title="Partners"
        description="Doctor, laboratory and pharmacy organizations operating on the platform."
      />

      {/* Type switcher (§18) */}
      <div role="tablist" aria-label="Partner type" className="flex gap-1 rounded-lg bg-surface-muted p-1 w-fit">
        {TABS.map((tab) => {
          const selected = tab.id === type;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setParams({ type: tab.id === 'doctor' ? null : tab.id, page: null })}
              className={
                selected
                  ? 'inline-flex items-center gap-2 rounded-md bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-sm'
                  : 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary'
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <DataTable<(typeof rows)[number]>
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        page={activeQuery.data?.page}
        totalPages={activeQuery.data?.totalPages}
        total={activeQuery.data?.total}
        pageSize={PER_PAGE}
        onPageChange={(next) => setParams({ page: String(next) })}
        loading={activeQuery.isLoading}
        error={
          activeQuery.error
            ? { code: activeQuery.error.code, message: activeQuery.error.message, requestId: activeQuery.error.requestId }
            : null
        }
        onRetry={() => void activeQuery.refetch()}
        emptyTitle={`No ${type === 'lab' ? 'laboratories' : `${type}s`} found`}
        emptyDescription="No partners match the current filters."
        toolbar={
          <div className="max-w-md">
            <Input
              label="Search partners"
              hideLabel
              placeholder="Search by name…"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              type="search"
            />
          </div>
        }
      />

      {activeQuery.error === null && rows.length === 0 && !activeQuery.isLoading ? (
        <EmptyState title="Nothing to show" description="Adjust the search or switch partner type." />
      ) : null}
    </div>
  );
}
