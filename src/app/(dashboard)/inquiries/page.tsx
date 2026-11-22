'use client';

/**
 * Public inquiries (§65 of the Phase 8 brief) — the staff inbox behind the
 * marketing site's contact and partnership forms.
 *
 * The endpoint contract is `GET/PATCH /api/v1/inquiries`, admin-role authorised,
 * and it is the *only* destination for a public submission: the web forms have no
 * `mailto:` fallback and no third-party CRM, so if this page does not work, nobody
 * reads anybody's message. Three consequences shape it:
 *
 *   1. **Filters are server-side.** `status`, `inquiry_type` and `channel` are
 *      passed to the API and mirrored in the URL, so an inbox view can be linked
 *      to a colleague. Client-side filtering over one page of a multi-page inbox
 *      would quietly drop leads, which is exactly the failure this module exists
 *      to prevent.
 *   2. **Marking a state is not sending a message.** The backend has no verified
 *      sending domain, so it never mails a submitter. "Responded" is therefore an
 *      admin's declaration that they replied from their own mailbox, and the copy
 *      says so rather than implying the platform did it.
 *   3. **Nothing disappears.** There is no delete. Junk is `archived`, and the
 *      service refuses an archive without a reason, so a lead is never discarded
 *      silently by whoever was holding the inbox that day.
 *
 * The `message` field is a visitor's own words. It is rendered as a plain text
 * node (`whitespace-pre-wrap`, never as raw HTML) and it is not a health
 * record: the capture form warns senders not to describe symptoms here, and staff
 * who receive clinical detail should move it into the proper patient channel
 * instead of answering it from this screen.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, CircleDashed, Mail, Inbox, Send, CheckCircle2 } from 'lucide-react';
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
import { useInquiries, useInquiry, useInquiryStatusUpdate } from '@/features/inquiries/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/formatting/dates';
import { getStatusConfig, inquiryStatusConfig, type StatusTone } from '@/constants/status';
import type { InquiryStatusDto, PublicInquiryDto } from '@/lib/api/schemas';

const PER_PAGE = 20;

const STATUS_OPTIONS: Array<{ value: InquiryStatusDto | 'all'; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

/** Matches `InquiryType` in the backend model — no value invented here. */
const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Any topic' },
  { value: 'general', label: 'General' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'business', label: 'Business' },
  { value: 'website_feedback', label: 'Website feedback' },
  { value: 'app_question', label: 'App question' },
  { value: 'media_press', label: 'Media / press' },
  { value: 'other', label: 'Other' },
];

const CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Any form' },
  { value: 'website_contact', label: 'Contact form' },
  { value: 'website_partner', label: 'Partnership form' },
];

const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map(({ value, label }) => [value, label]));
const CHANNEL_LABELS: Record<string, string> = {
  website_contact: 'Contact form',
  website_partner: 'Partnership form',
};

/** Actions offered per state, in the order they are meant to be used. */
const NEXT_STATUSES: Record<InquiryStatusDto, Array<{ value: InquiryStatusDto; label: string; variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; icon: typeof Send }>> = {
  new: [
    { value: 'in_review', label: 'Start review', variant: 'primary', icon: CircleDashed },
    { value: 'archived', label: 'Archive', variant: 'ghost', icon: Archive },
  ],
  in_review: [
    { value: 'responded', label: 'Mark responded', variant: 'primary', icon: Send },
    { value: 'closed', label: 'Close', variant: 'outline', icon: CheckCircle2 },
    { value: 'archived', label: 'Archive', variant: 'ghost', icon: Archive },
  ],
  responded: [
    { value: 'closed', label: 'Close', variant: 'primary', icon: CheckCircle2 },
    { value: 'in_review', label: 'Reopen', variant: 'outline', icon: CircleDashed },
  ],
  closed: [{ value: 'in_review', label: 'Reopen', variant: 'outline', icon: CircleDashed }],
  archived: [{ value: 'in_review', label: 'Restore to review', variant: 'outline', icon: CircleDashed }],
};

/** Clamp a URL filter to a known option value, falling back to `all`. */
function knownOptionValue(
  options: Array<{ value: string; label: string }>,
  raw: string | null,
): string {
  return options.some((option) => option.value === raw) ? (raw as string) : 'all';
}

export default function InquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = knownOptionValue(STATUS_OPTIONS, searchParams.get('status')) as InquiryStatusDto | 'all';
  const inquiryType = knownOptionValue(TYPE_OPTIONS, searchParams.get('type'));
  const channel = knownOptionValue(CHANNEL_OPTIONS, searchParams.get('channel'));
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * The note being typed, remembered only while it belongs to the open record.
   *
   * Derived rather than copied into state from an effect: an effect that reseeds
   * a draft from server data renders the whole inbox twice for no reason and
   * shows a stale note for one frame — and a one-frame stale note is how an admin
   * ends up saving the previous person's reason against this one.
   */
  const [noteOverride, setNoteOverride] = useState<{ id: string; value: string } | null>(null);

  const list = useInquiries({ page, pageSize: PER_PAGE, status, inquiryType, channel });
  const detail = useInquiry(openId);
  const updateStatus = useInquiryStatusUpdate();
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
    router.replace(`/inquiries${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const openInquiry = (id: string) => {
    setOpenId(id);
    setActionError(null);
  };

  const closeInquiry = () => {
    setOpenId(null);
    setActionError(null);
  };

  const applyStatus = async (next: InquiryStatusDto) => {
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

  const rows = list.data?.inquiries ?? [];

  const columns: Array<DataTableColumn<PublicInquiryDto>> = [
    {
      key: 'sender',
      header: 'From',
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
      key: 'topic',
      header: 'Topic',
      hideBelow: 'sm',
      cell: (row) => <Badge variant="neutral">{TYPE_LABELS[row.inquiry_type] ?? row.inquiry_type}</Badge>,
    },
    {
      key: 'context',
      header: 'Context',
      hideBelow: 'md',
      cell: (row) =>
        row.organization ? (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{row.organization}</p>
            <p className="truncate text-[11px] text-foreground-subtle">
              {row.partnership_interest ? row.partnership_interest.replace(/_/g, ' ') : CHANNEL_LABELS[row.channel]}
            </p>
          </div>
        ) : (
          <span className="text-xs text-foreground-subtle">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const config = getStatusConfig(inquiryStatusConfig, row.status);
        return <StatusBadge label={config.label} tone={config.tone} title={config.meaning} icon={<config.icon className="h-3 w-3" aria-hidden />} />;
      },
    },
    {
      key: 'received',
      header: 'Received',
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
      header: 'Inquiry',
      align: 'right',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openInquiry(row.id)}
          aria-label={`Open inquiry from ${row.name}`}
        >
          Open
        </Button>
      ),
    },
  ];

  const filtersActive = status !== 'all' || inquiryType !== 'all' || channel !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Support' }, { label: 'Public Inquiries' }]}
        title="Public inquiries"
        description="Messages captured from the public contact and partnership forms."
        actions={
          <span className="inline-flex items-center gap-2 text-sm text-foreground-muted">
            <Inbox className="h-4 w-4" aria-hidden />
            {list.data ? `${list.data.total} total` : 'Loading…'}
          </span>
        }
      />

      <Alert
        variant="info"
        title="Replies are sent from your own mailbox"
        description="The platform stores enquiries; it does not send email on your behalf, because no sending domain has been verified yet. Reply from the address you want the sender to see, then record the outcome here — 'Responded' means you have written back, not that the system did."
      />

      <Card>
        <CardHeader
          title="Inbox"
          description="Filters are applied by the backend, so the count below is the whole result set, not one page of it."
          action={
            filtersActive ? (
              <Button variant="ghost" size="sm" onClick={() => setParams({ status: null, type: null, channel: null, page: null })}>
                Clear filters
              </Button>
            ) : undefined
          }
        />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Status"
            hideLabel
            value={status}
            onChange={(event) => setParams({ status: event.target.value, page: null })}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Topic"
            hideLabel
            value={inquiryType}
            onChange={(event) => setParams({ type: event.target.value, page: null })}
            options={TYPE_OPTIONS}
          />
          <Select
            label="Source form"
            hideLabel
            value={channel}
            onChange={(event) => setParams({ channel: event.target.value, page: null })}
            options={CHANNEL_OPTIONS}
          />
        </div>

        <DataTable<PublicInquiryDto>
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
          emptyTitle={filtersActive ? 'Nothing matches these filters' : 'The inbox is empty'}
          emptyDescription={
            filtersActive
              ? 'No inquiries carry this status, topic, or source form.'
              : 'Submissions from the public contact and partnership forms will appear here.'
          }
        />
      </Card>

      <Drawer
        open={openId !== null}
        onClose={closeInquiry}
        title={detail.data ? `Inquiry from ${detail.data.name}` : 'Inquiry'}
        description={detail.data ? `${TYPE_LABELS[detail.data.inquiry_type] ?? detail.data.inquiry_type} · ${formatDateTime(detail.data.created_at)}` : undefined}
        width="lg"
        footer={
          detail.data ? (
            <div className="space-y-3">
              {actionError ? <p className="text-sm text-danger" role="alert">{actionError}</p> : null}
              <PermissionGate
                permission="support.manage"
                fallback={
                  <p className="text-xs text-foreground-subtle">
                    Your admin role can read inquiries; only support managers can change their state.
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
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : detail.error ? (
          <Alert
            variant="danger"
            title="This inquiry could not be opened"
            description={`${detail.error.message}${detail.error.requestId ? ` (request ${detail.error.requestId})` : ''}`}
            action={
              <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>
                Try again
              </Button>
            }
          />
        ) : detail.data ? (
          <InquiryDetail
            inquiry={detail.data}
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

function InquiryDetail({
  inquiry,
  noteDraft,
  onNoteChange,
}: {
  inquiry: PublicInquiryDto;
  noteDraft: string;
  onNoteChange: (value: string) => void;
}) {
  const config = getStatusConfig(inquiryStatusConfig, inquiry.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={config.label} tone={config.tone ?? TONE_FALLBACK} title={config.meaning} />
        <Badge variant="neutral">{TYPE_LABELS[inquiry.inquiry_type] ?? inquiry.inquiry_type}</Badge>
        <Badge variant="neutral">{CHANNEL_LABELS[inquiry.channel] ?? inquiry.channel}</Badge>
        {inquiry.source_path ? (
          <span className="font-mono text-[11px] text-foreground-subtle">from {inquiry.source_path}</span>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">{inquiry.name}</Field>
        <Field label="Email">
          {/* A mailto on the *sender's* address is the reply affordance — the
              platform has no outbound channel of its own to promise. */}
          <a
            href={`mailto:${inquiry.email}?subject=Re: your message to Bloom Haven Health`}
            className="inline-flex items-center gap-1.5 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {inquiry.email}
          </a>
        </Field>
        {inquiry.phone ? <Field label="Phone">{inquiry.phone}</Field> : null}
        {inquiry.organization ? <Field label="Organisation">{inquiry.organization}</Field> : null}
        {inquiry.organization_type ? <Field label="Organisation type">{inquiry.organization_type}</Field> : null}
        {inquiry.partnership_interest ? (
          <Field label="Partnership interest">{inquiry.partnership_interest.replace(/_/g, ' ')}</Field>
        ) : null}
      </dl>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">Message</h3>
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm leading-relaxed text-foreground">
          {inquiry.message}
        </p>
        <p className="mt-1 text-[11px] text-foreground-subtle">
          Written by the sender. If it contains health information, move it into the proper clinical record rather than
          answering it from this panel.
        </p>
      </section>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Received">{formatDateTime(inquiry.created_at)}</Field>
        <Field label="First response">
          {inquiry.first_responded_at ? formatDateTime(inquiry.first_responded_at) : 'Not yet responded'}
        </Field>
        <Field label="Last updated">{formatRelativeTime(inquiry.updated_at)}</Field>
      </dl>

      <Textarea
        label="Internal note"
        rows={4}
        value={noteDraft}
        maxLength={2000}
        onChange={(event) => onNoteChange(event.target.value)}
        hint="Visible to staff on this record. Required before an inquiry can be archived."
      />
    </div>
  );
}
