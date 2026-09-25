'use client';

/**
 * Diagnostic test catalog (§24) — the platform-standard test list with
 * categories, sample types, and turnaround times. Public backend endpoint
 * (GET /labs/catalog, unpaginated array) with server-side search. Pricing
 * lives on per-lab offerings, which are lab-scoped (audit PL-9 pattern) and
 * not shown here; no clinical details beyond catalog metadata (§38).
 */

import { useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useLabCatalog } from '@/features/laboratory/hooks';
import { humanizeStatusKey } from '@/constants/status';
import type { LabTestCatalogDto } from '@/lib/api/schemas';

export default function LaboratoryTestsPage() {
  const [searchInput, setSearchInput] = useState('');
  // Enter-committed server-side search — the endpoint accepts search/category.
  const [committedSearch, setCommittedSearch] = useState('');

  const query = useLabCatalog({ search: committedSearch });

  const columns: Array<DataTableColumn<LabTestCatalogDto>> = [
    {
      key: 'test',
      header: 'Test',
      cell: (test) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{test.name}</p>
          <p className="font-mono text-xs text-foreground-subtle">{test.code}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelow: 'sm',
      cell: (test) => <Badge variant="neutral">{humanizeStatusKey(test.category)}</Badge>,
    },
    {
      key: 'sample',
      header: 'Sample',
      hideBelow: 'md',
      cell: (test) => <span className="text-foreground-muted">{humanizeStatusKey(test.sample_type)}</span>,
    },
    {
      key: 'tat',
      header: 'Turnaround',
      hideBelow: 'md',
      cell: (test) => (
        <span className="text-foreground">
          {test.turnaround_hours}h
        </span>
      ),
    },
    {
      key: 'status',
      header: 'State',
      hideBelow: 'lg',
      cell: (test) =>
        test.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Laboratory', href: '/laboratory' }, { label: 'Tests' }]}
        title="Diagnostic test catalog"
        description="Platform-standard tests with sample types and turnaround targets. Per-lab pricing and availability are managed in the laboratory app (§24)."
      />

      <DataTable<LabTestCatalogDto>
        columns={columns}
        rows={query.data ?? []}
        getRowKey={(test) => test.id}
        loading={query.isLoading}
        error={
          query.error
            ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId }
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No tests found"
        emptyDescription={
          committedSearch
            ? `Nothing matches "${committedSearch}". Try another test name or code.`
            : 'The catalog will appear here once tests are defined.'
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-72">
              <Input
                label="Search catalog"
                hideLabel
                placeholder="Search test name or code (server-side — press Enter)"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setCommittedSearch(searchInput);
                }}
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                type="search"
              />
            </div>
          </div>
        }
      />

      <p className="flex items-start gap-1.5 text-xs text-foreground-subtle">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Catalog data is public by backend design. Booking volumes, per-lab availability, and exception counts are not
        exposed to admins (audit PL-2/PL-6) and are not fabricated here (§64). Preparation instructions are clinical
        guidance and render only in patient/partner contexts (§38).
      </p>
    </div>
  );
}
