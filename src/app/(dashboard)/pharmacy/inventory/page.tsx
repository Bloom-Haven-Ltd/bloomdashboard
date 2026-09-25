'use client';

/**
 * Medication availability (§16) — read-only view over the public global
 * inventory search (GET /pharmacies/inventory/search). This is the only
 * inventory surface admins can reach: per-pharmacy inventory CRUD is
 * pharmacy-scoped (audit PL-9), and the dashboard never mutates stock (§16).
 * Three-tier stock (physical / reserved / available) is backend-authoritative.
 */

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useInventory } from '@/features/pharmacy/hooks';
import { formatGhs } from '@/lib/formatting/money';
import type { InventoryItemDto } from '@/lib/api/schemas';

export default function PharmacyInventoryPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  // Debounce-free server search: Enter commits, so keystrokes never spam the API (§50).
  const [committedSearch, setCommittedSearch] = useState('');

  const query = useInventory(page, 20, { search: committedSearch });

  const columns: Array<DataTableColumn<InventoryItemDto>> = [
    {
      key: 'product',
      header: 'Medication',
      cell: (item) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{item.product_name}</p>
          <p className="truncate text-xs text-foreground-subtle">
            {[item.generic_name, item.dosage_form, item.strength].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Available',
      cell: (item) => {
        const available = item.available_quantity ?? Math.max(0, item.quantity_in_stock - (item.reserved_quantity ?? 0));
        const low = available <= item.reorder_level;
        return (
          <div className="flex items-center gap-2">
            <span className={low ? 'font-semibold text-warning' : 'font-semibold text-foreground'}>{available}</span>
            {low && <Badge variant="warning">Low stock</Badge>}
          </div>
        );
      },
    },
    {
      key: 'detail',
      header: 'Stock detail',
      hideBelow: 'md',
      cell: (item) => (
        <span className="text-xs text-foreground-muted">
          {item.quantity_in_stock} physical · {item.reserved_quantity ?? 0} reserved
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      hideBelow: 'sm',
      align: 'right',
      cell: (item) => <span className="text-foreground">{formatGhs(item.unit_price)}</span>,
    },
    {
      key: 'rx',
      header: 'Rx',
      hideBelow: 'lg',
      cell: (item) => (item.requires_prescription ? <Badge variant="info">Rx only</Badge> : <span className="text-foreground-subtle">OTC</span>),
    },
    {
      key: 'actions',
      header: 'Pharmacy',
      align: 'right',
      cell: (item) => (
        <Link href={`/partners/pharmacy/${item.pharmacy_id}`} className="inline-flex">
          <Button variant="ghost" size="sm">
            Open
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Operations' }, { label: 'Pharmacy', href: '/pharmacy' }, { label: 'Inventory' }]}
        title="Medication availability"
        description="Platform-wide medication stock from partner pharmacies. Availability is computed by the backend; the dashboard never modifies inventory (§16)."
      />

      <DataTable<InventoryItemDto>
        columns={columns}
        rows={query.data?.items ?? []}
        getRowKey={(item) => item.id}
        page={query.data?.page}
        totalPages={query.data?.totalPages}
        total={query.data?.total}
        pageSize={20}
        onPageChange={setPage}
        loading={query.isLoading}
        error={
          query.error
            ? { code: query.error.code, message: query.error.message, requestId: query.error.requestId }
            : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No medications found"
        emptyDescription={
          committedSearch
            ? `Nothing matches "${committedSearch}". Try a different product or generic name.`
            : 'Inventory will appear here as pharmacies add medications.'
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-72">
              <Input
                label="Search medications"
                hideLabel
                placeholder="Search product or generic name (server-side — press Enter)"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setCommittedSearch(searchInput);
                    setPage(1);
                  }
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
        Public inventory search endpoint — supports server-side search and pagination. Stock adjustments, expiry
        handling, and movement ledgers are pharmacy-app operations (audit PL-9). This view is intentionally read-only
        (§16).
      </p>
    </div>
  );
}
