'use client';

/**
 * App-launch waitlist — the signups captured by the marketing site's
 * `/waitlist` form (`bloom-health-web` → `POST /api/waitlist` → FastAPI
 * `/public/waitlist` → `waitlist_signups`).
 *
 * What this list is, and is not: each row is one address that asked to be told
 * when the Bloom apps open. The backend makes re-joining idempotent (the same
 * email returns the existing row untouched), so one address is one row — no
 * dedup UI is needed here. The endpoint contract is `GET/PATCH /api/v1/waitlist`,
 * admin-role authorised, and two rules shape this screen:
 *
 *   1. **Filters are server-side.** `status` and `interest` are passed to the
 *      API and mirrored in the URL, so a view of the list can be linked to a
 *      colleague. Client-side filtering over one page would quietly drop
 *      people who are waiting on an invite.
 *   2. **Marking a state is not sending an invite.** The platform has no
 *      verified outbound channel, so "Contacted" and "Invited" are an admin's
 *      declaration about mail they sent from their own outbox, and the copy
 *      says so rather than implying the system did it.
 *
 * There is no message column and no search box, and that is the point: the
 * capture form collects no prose at all — `interest` is a product choice
 * (which app), never a clinical topic — so this table cannot become a queryable
 * shadow medical record.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, Send, Ticket, Undo2, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useWaitlistSignups, useWaitlistSignup, useWaitlistStatusUpdate } from '@/features/waitlist/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { getStatusConfig, waitlistStatusConfig, type StatusTone } from '@/constants/status';
import type { WaitlistSignupDto, WaitlistStatusDto } from '@/lib/api/schemas';

const PER_PAGE = 20;

const STATUS_OPTIONS: Array<{ value: WaitlistStatusDto | 'all'; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'invited', label: 'Invited' },
  { value: 'archived', label: 'Archived' },
];

/** Matches `WaitlistInterest` in the backend model — no value invented here. */
const INTEREST_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Any interest' },
  { value: 'patient_app', label: 'Bloom Haven (patient app)' },
  { value: 'partner_app', label: 'Bloom Partner (practice app)' },
  { value: 'both', label: 'Both apps' },
  { value: 'curious', label: 'Just exploring' },
];

const INTEREST_LABELS = Object.fromEntries(INTEREST_OPTIONS.map(({ value, label }) => [value, label]));

/** Actions offered per state, in the order they are meant to be used. */
const NEXT_STATUSES: Record<WaitlistStatusDto, Array<{ value: WaitlistStatusDto; label: string; variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; icon: typeof Send }>> = {
  new: [
    { value: 'contacted', label: 'Mark contacted', variant: 'primary', icon: Send },
    { value: 'invited', label: 'Invite', variant: 'secondary', icon: Ticket },
    { value: 'archived', label: 'Archive', variant: 'ghost', icon: Archive },
  ],
  contacted: [
    { value: 'invited', label: 'Invite', variant: 'primary', icon: Ticket },
    { value: 'archived', label: 'Archive', variant: 'ghost', icon: Archive },
  ],
  invited: [
    { value: 'contacted', label: 'Follow up', variant: 'outline', icon: Undo2 },
    { value: 'archived', label: 'Archive', variant: 'ghost', icon: Archive },
  ],
  archived: [{ value: 'contacted', label: 'Restore', variant: 'outline', icon: Undo2 }],
};

/** Clamp a URL filter to a known option value, falling back to `all`. */
function knownOptionValue(
  options: Array<{ value: string; label: string }>,
  raw: string | null,
): string {
  return options.some((option) => option.value === raw) ? (raw as string) : 'all';
}

export default function WaitlistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = knownOptionValue(STATUS_OPTIONS, searchParams.get('status')) as WaitlistStatusDto | 'all';
  const interest = knownOptionValue(INTEREST_OPTIONS, searchParams.get('interest'));
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * The note being typed, remembered only while it belongs to the open record.
   * Derived rather than reseeded from an effect — same invariant as the inbox:
   * a one-frame stale note is how an admin saves the previous person's note
   * against this one.
   */
  const [noteOverride, setNoteOverride] = useState<{ id: string; value: string } | null>(null);

  const list = useWaitlistSignups({ page, pageSize: PER_PAGE, status, interest });
  const detail = useWaitlistSignup(openId);
  const updateStatus = useWaitlistStatusUpdate();
  const [actionError, setActionError] = useState<string | null>(null);

  const noteDraft = detail.data
    ? noteOverride?.id === detail.data.id
      ? noteOverride.value
      : (detail.data.internal_note ?? '')
    : '';

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'all' || (key === 'page' && value === '1')) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`/waitlist${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const openSignup = (id: string) => {
    setOpenId(id);
    setActionError(null);
  };

  const closeSignup = () => {
    setOpenId(null);
    setActionError(null);
  };

  const applyStatus = async (next: WaitlistStatusDto) => {
    if (!detail.data) return;
    setActionError(null);
    try {
      await updateStatus.mutateAsync({
        id: detail.data.id,
        status: next,
        internalNote: noteDraft.trim() || undefined,
      });
      // The saved value is now the server value; drop the local draft so the next
      // read wins.
      setNoteOverride(null);
    } catch (cause) {
      // The service's own guard fires before the network for a missing archive
      // reason; its message is written for the reader, so surface it verbatim.
      setActionError(cause instanceof Error ? cause.message : 'The status could not be saved.');
    }
  };

  const rows = list.data?.signups ?? [];

  const columns: Array<DataTableColumn<WaitlistSignupDto>> = [
    {
      key: 'person',
      header: 'Who',
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{row.name}</p>
            <p className="truncate text-xs text-foreground-muted">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'interest',
      header: 'Waiting for',
      hideBelow: 'sm',
      cell: (row) => (
        <Badge variant="neutral">{row.interest ? INTEREST_LABELS[row.interest] ?? row.interest : 'No preference'}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const config = getStatusConfig(waitlistStatusConfig, row.status);
        return <StatusBadge label={config.label} tone={config.tone} title={config.meaning} icon={<config.icon className="h-3 w-3" aria-hidden />} />;
      },
    },
    {
      key: 'joined',
      header: 'Joined',
      hideBelow: 'sm',
      cell: (row) => (
        <div className="text-foreground-muted">
          <p>{formatDateTime(row.created_at)}</p>
          <p className="text-[11px] text-foreground-subtle">{formatRelativeTime(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Signup',
      align: 'right',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openSignup(row.id)}
          aria-label={`Open waitlist signup from ${row.name}`}
        >
          Open
        </Button>
      ),
    },
  ];

  const filtersActive = status !== 'all' || interest !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Support' }, { label: 'Waitlist' }]}
        title="App-launch waitlist"
        description="Visitors who asked to be told when the Bloom Haven and Bloom Partner apps open."
        actions={
          <span className="inline-flex items-center gap-2 text-sm text-foreground-muted">
            <Users className="h-4 w-4" aria-hidden />
            {list.data ? `${list.data.total} total` : 'Loading…'}
          </span>
        }
      />

      <Alert
        variant="info"
        title="Invites are sent from your own mailbox"
        description="The platform stores signups; it does not send email on your behalf, because no sending domain has been verified yet. Contact someone from the address you want them to see, then record the outcome here — ‘Contacted’ and ‘Invited’ mean you have written, not that the system did."
      />

      <Card>
        <CardHeader
          title="Signups"
          description="Filters are applied by the backend, so the count below is the whole result set, not one page of it."
          action={
            filtersActive ? (
              <Button variant="ghost" size="sm" onClick={() => setParams({ status: null, interest: null, page: null })}>
                Clear filters
              </Button>
            ) : undefined
          }
        />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Status"
            hideLabel
            value={status}
            onChange={(event) => setParams({ status: event.target.value, page: null })}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Interest"
            hideLabel
            value={interest}
            onChange={(event) => setParams({ interest: event.target.value, page: null })}
            options={INTEREST_OPTIONS}
          />
        </div>

        <DataTable<WaitlistSignupDto>
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          page={list.data?.page}
          totalPages={list.data?.totalPages}
          total={list.data?.total}
          pageSize={PER_PAGE}
          onPageChange={(next) => setParams({ page: String(next) })}
          loading={list.isLoading}
          error={
            list.error
              ? { code: list.error.code, message: list.error.message, requestId: list.error.requestId }
              : null
          }
          onRetry={() => void list.refetch()}
          emptyTitle={filtersActive ? 'Nothing matches these filters' : 'The waitlist is empty'}
          emptyDescription={
            filtersActive
              ? 'No signups carry this status or interest.'
              : 'Submissions from the public "Join the waitlist" form will appear here.'
          }
        />
      </Card>

      <Drawer
        open={openId !== null}
        onClose={closeSignup}
        title={detail.data ? `Signup: ${detail.data.name}` : 'Waitlist signup'}
        description={detail.data ? `${detail.data.interest ? INTEREST_LABELS[detail.data.interest] ?? detail.data.interest : 'No preference'} · joined ${formatDateTime(detail.data.created_at)}` : undefined}
        width="lg"
        footer={
          detail.data ? (
            <div className="space-y-3">
              {actionError ? <p className="text-sm text-danger" role="alert">{actionError}</p> : null}
              <PermissionGate
                permission="support.manage"
                fallback={
                  <p className="text-xs text-foreground-subtle">
                    Your admin role can read the waitlist; only support managers can change a signup’s state.
                  </p>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  {NEXT_STATUSES[detail.data.status]?.map(({ value, label, variant, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={variant}
                      size="sm"
                      onClick={() => void applyStatus(value)}
                      isLoading={updateStatus.isPending && updateStatus.variables?.status === value}
                      disabled={updateStatus.isPending}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void applyStatus(detail.data!.status)}
                    disabled={updateStatus.isPending || noteDraft.trim() === (detail.data.internal_note ?? '').trim()}
                  >
                    Save note
                  </Button>
                </div>
              </PermissionGate>
            </div>
          ) : null
        }
      >
        {detail.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : detail.error ? (
          <Alert
            variant="danger"
            title="This signup could not be opened"
            description={`${detail.error.message}${detail.error.requestId ? ` (request ${detail.error.requestId})` : ''}`}
            action={
              <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>
                Try again
              </Button>
            }
          />
        ) : detail.data ? (
          <SignupDetail
            signup={detail.data}
            noteDraft={noteDraft}
            onNoteChange={(value) => setNoteOverride({ id: detail.data.id, value })}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── Detail body ── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

const TONE_FALLBACK: StatusTone = 'neutral';

function SignupDetail({
  signup,
  noteDraft,
  onNoteChange,
}: {
  signup: WaitlistSignupDto;
  noteDraft: string;
  onNoteChange: (value: string) => void;
}) {
  const config = getStatusConfig(waitlistStatusConfig, signup.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={config.label} tone={config.tone ?? TONE_FALLBACK} title={config.meaning} />
        <Badge variant="neutral">{signup.interest ? INTEREST_LABELS[signup.interest] ?? signup.interest : 'No preference'}</Badge>
        {signup.source_path ? (
          <span className="font-mono text-[11px] text-foreground-subtle">from {signup.source_path}</span>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">{signup.name}</Field>
        <Field label="Email">
          {/* A mailto on the *signup's* address is the invite affordance — the
              platform has no outbound channel of its own to promise. */}
          <a
            href={`mailto:${signup.email}?subject=Your Bloom Haven waitlist spot`}
            className="inline-flex items-center gap-1.5 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {signup.email}
          </a>
        </Field>
        {signup.phone ? <Field label="Phone">{signup.phone}</Field> : null}
      </dl>

      <p className="rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-foreground-muted">
        This is the whole record: the form collects no messages and no health
        information, so there is nothing here beyond what is shown above. If a
        signup writes to you separately with personal or clinical detail, that
        conversation belongs in the inquiry inbox or the patient record — not in
        this note field.
      </p>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Joined">{formatDateTime(signup.created_at)}</Field>
        <Field label="Last updated">{formatRelativeTime(signup.updated_at)}</Field>
      </dl>

      <Textarea
        label="Internal note"
        rows={4}
        value={noteDraft}
        maxLength={2000}
        onChange={(event) => onNoteChange(event.target.value)}
        hint="Visible to staff on this record. Required before a signup can be archived."
      />
    </div>
  );
}
