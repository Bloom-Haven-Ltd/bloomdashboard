/**
 * Centralized status configuration (§34–§36) — reconciled against the
 * verified FastAPI enums:
 *
 * - ConsultationStatus  (lowercase): pending, confirmed, ready, in_progress,
 *   interrupted, documentation_pending, completed, cancelled, no_show, rescheduled
 * - PaymentStatus (payments module, UPPERCASE): INITIATED…PARTIALLY_REFUNDED
 * - PaymentStatus (consultations module, lowercase): pending/paid/refunded/failed/waived
 * - OrderStatus (pharmacy): pending…completed
 * - LabBookingStatus: pending, confirmed, completed, cancelled, no_show
 * - PharmacyStatus: pending, approved, active, suspended, rejected
 *
 * Backend state machines are authoritative; this map only renders them.
 * Unknown values never crash — they render as neutral "Unknown".
 */

import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  FileClock,
  LifeBuoy,
  Lock,
  PauseCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Ticket,
  Truck,
  Undo2,
  Wrench,
  XCircle,
} from 'lucide-react';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

export interface StatusConfig {
  label: string;
  /** Semantic meaning surfaced via tooltip / aria (never color-only, §36). */
  meaning: string;
  tone: StatusTone;
  icon: LucideIcon;
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------

const pending: StatusConfig = {
  label: 'Pending',
  meaning: 'Awaiting action.',
  tone: 'warning',
  icon: Clock,
};
const confirmed: StatusConfig = {
  label: 'Confirmed',
  meaning: 'Accepted and confirmed by the partner.',
  tone: 'info',
  icon: CircleCheck,
};
const cancelled: StatusConfig = {
  label: 'Cancelled',
  meaning: 'Cancelled before completion.',
  tone: 'neutral',
  icon: Undo2,
};
const noShow: StatusConfig = {
  label: 'No-show',
  meaning: 'The patient or partner did not attend.',
  tone: 'danger',
  icon: XCircle,
};
const completed: StatusConfig = {
  label: 'Completed',
  meaning: 'Completed successfully.',
  tone: 'success',
  icon: CircleCheck,
};
const rejected: StatusConfig = {
  label: 'Rejected',
  meaning: 'Rejected after review.',
  tone: 'danger',
  icon: Ban,
};

// ---------------------------------------------------------------------------
// Domain maps — keys match backend enum values (case-insensitively)
// ---------------------------------------------------------------------------

/** ConsultationStatus (appointments/consultations feeds). */
export const consultationStatusConfig: Record<string, StatusConfig> = {
  pending,
  confirmed,
  ready: {
    label: 'Ready',
    meaning: 'Consultation room is ready for the patient to join.',
    tone: 'info',
    icon: CircleDot,
  },
  in_progress: {
    label: 'In Progress',
    meaning: 'Consultation is underway.',
    tone: 'primary',
    icon: CircleDot,
  },
  interrupted: {
    label: 'Interrupted',
    meaning: 'Consultation was interrupted and may need resuming.',
    tone: 'warning',
    icon: PauseCircle,
  },
  documentation_pending: {
    label: 'Documentation Pending',
    meaning: 'Consultation ended; the provider must complete documentation.',
    tone: 'warning',
    icon: FileClock,
  },
  completed,
  cancelled,
  no_show: noShow,
  rescheduled: {
    label: 'Rescheduled',
    meaning: 'Moved to a new time by patient or partner.',
    tone: 'neutral',
    icon: RotateCcw,
  },
};

/** PaymentStatus (payments module — UPPERCASE values). */
export const paymentStatusConfig: Record<string, StatusConfig> = {
  initiated: { label: 'Initiated', meaning: 'Payment started.', tone: 'info', icon: CircleDashed },
  pending,
  processing: { label: 'Processing', meaning: 'Provider is processing the payment.', tone: 'info', icon: CircleDot },
  paid: { label: 'Paid', meaning: 'Payment confirmed.', tone: 'success', icon: CircleCheck },
  success: { label: 'Successful', meaning: 'Payment completed.', tone: 'success', icon: CircleCheck },
  failed: { label: 'Failed', meaning: 'Payment failed.', tone: 'danger', icon: XCircle },
  abandoned: { label: 'Abandoned', meaning: 'Payment was started but never completed.', tone: 'neutral', icon: CircleDashed },
  reversed: { label: 'Reversed', meaning: 'Payment was reversed by the provider.', tone: 'warning', icon: RotateCcw },
  refunded: { label: 'Refunded', meaning: 'Payment has been fully refunded.', tone: 'neutral', icon: Undo2 },
  partially_refunded: {
    label: 'Partially Refunded',
    meaning: 'Part of the payment has been refunded.',
    tone: 'warning',
    icon: Undo2,
  },
  waived: { label: 'Waived', meaning: 'Payment was waived.', tone: 'neutral', icon: CircleCheck },
  cancelled,
};

/** OrderStatus (pharmacy). */
export const orderStatusConfig: Record<string, StatusConfig> = {
  pending,
  confirmed,
  preparing: { label: 'Preparing', meaning: 'Pharmacy is preparing the order.', tone: 'info', icon: Wrench },
  ready: {
    label: 'Ready',
    meaning: 'Order is ready for pickup or dispatch.',
    tone: 'info',
    icon: CircleDot,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    meaning: 'Order is with the delivery channel.',
    tone: 'primary',
    icon: Truck,
  },
  delivered: { label: 'Delivered', meaning: 'Order has been delivered.', tone: 'success', icon: CircleCheck },
  completed,
  rejected,
  returned: { label: 'Returned', meaning: 'Order was returned to the pharmacy.', tone: 'warning', icon: Undo2 },
  failed: { label: 'Failed', meaning: 'Order could not be fulfilled.', tone: 'danger', icon: XCircle },
  cancelled,
};

/** WithdrawalStatus (wallets module). Transitions are server-enforced. */
export const withdrawalStatusConfig: Record<string, StatusConfig> = {
  pending: { label: 'Pending', meaning: 'Awaiting administrative review.', tone: 'warning', icon: Clock },
  approved: { label: 'Approved', meaning: 'Transfer initiated with the payment provider.', tone: 'info', icon: CircleDot },
  completed: { label: 'Completed', meaning: 'Funds transferred and confirmed by the provider.', tone: 'success', icon: CircleCheck },
  rejected: { label: 'Rejected', meaning: 'Rejected; reserved funds returned to the wallet.', tone: 'danger', icon: XCircle },
  cancelled: { label: 'Cancelled', meaning: 'Cancelled by the partner before processing.', tone: 'neutral', icon: Ban },
};

/** LabBookingStatus. */
export const labBookingStatusConfig: Record<string, StatusConfig> = {
  pending,
  confirmed,
  completed,
  cancelled,
  no_show: noShow,
};

/** PrescriptionStatus (prescriptions module). */
export const prescriptionStatusConfig: Record<string, StatusConfig> = {
  pending,
  sent_to_pharmacy: {
    label: 'Sent to Pharmacy',
    meaning: 'Prescription routed to the assigned pharmacy.',
    tone: 'info',
    icon: Truck,
  },
  approved: { label: 'Approved', meaning: 'Approved for platform participation.', tone: 'success', icon: ShieldCheck },
  fulfilled: {
    label: 'Fulfilled',
    meaning: 'Medications dispensed and the prescription is closed.',
    tone: 'success',
    icon: CircleCheck,
  },
  cancelled,
};

/** PharmacyStatus / partner account state. */
export const partnerStatusConfig: Record<string, StatusConfig> = {
  pending,
  approved: { label: 'Approved', meaning: 'Approved for platform participation.', tone: 'success', icon: ShieldCheck },
  active: { label: 'Active', meaning: 'Actively participating.', tone: 'success', icon: CircleCheck },
  suspended: { label: 'Suspended', meaning: 'Temporarily disabled.', tone: 'danger', icon: Lock },
  rejected,
};

/** User account status (is_active). */
export const userStatusConfig: Record<'active' | 'suspended', StatusConfig> = {
  active: { label: 'Active', meaning: 'Account is active.', tone: 'success', icon: CircleCheck },
  suspended: { label: 'Suspended', meaning: 'Account has been suspended.', tone: 'danger', icon: Ban },
};

/** Dispute/support status (admin disputes endpoint). */
export const supportStatusConfig: Record<string, StatusConfig> = {
  pending,
  open: { label: 'Open', meaning: 'Awaiting first response.', tone: 'warning', icon: CircleDashed },
  in_progress: { label: 'In Progress', meaning: 'Being handled by support.', tone: 'info', icon: CircleDot },
  escalated: { label: 'Escalated', meaning: 'Escalated to a senior team.', tone: 'danger', icon: LifeBuoy },
  resolved: { label: 'Resolved', meaning: 'Resolved and closed.', tone: 'success', icon: CircleCheck },
  rejected,
  cancelled,
};

/**
 * Public-inquiry inbox (GET/PATCH /inquiries). These five states are the
 * complete backend vocabulary (`InquiryStatus` in app/modules/inquiries/models.py);
 * `first_responded_at` is stamped server-side when a record first leaves `new`,
 * so response timing is derived, never typed in.
 */
export const inquiryStatusConfig: Record<string, StatusConfig> = {
  new: {
    label: 'New',
    meaning: 'Received and awaiting a first response.',
    tone: 'warning',
    icon: CircleDashed,
  },
  in_review: {
    label: 'In Review',
    meaning: 'Someone has taken the enquiry; a reply is being written.',
    tone: 'info',
    icon: CircleDot,
  },
  responded: {
    label: 'Responded',
    meaning: 'A reply has been sent to the submitter.',
    tone: 'primary',
    icon: Send,
  },
  closed: {
    label: 'Closed',
    meaning: 'Conversation finished; no further action planned.',
    tone: 'success',
    icon: CircleCheck,
  },
  archived: {
    label: 'Archived',
    meaning: 'Kept for record only (spam, duplicate, or no longer relevant).',
    tone: 'neutral',
    icon: Archive,
  },
};

/**
 * App-launch waitlist (GET/PATCH /waitlist). These four states are the complete
 * backend vocabulary (`WaitlistStatus` in app/modules/waitlist/models.py).
 * Unlike the inquiry inbox, nothing here is a reply: `contacted` and `invited`
 * are the admin's declarations about mail they sent from their own outbox,
 * because the platform has no verified sending channel of its own.
 */
export const waitlistStatusConfig: Record<string, StatusConfig> = {
  new: {
    label: 'New',
    meaning: 'Just joined; nobody on the team has touched this address yet.',
    tone: 'warning',
    icon: CircleDashed,
  },
  contacted: {
    label: 'Contacted',
    meaning: 'The team has written to this address (from their own mailbox).',
    tone: 'info',
    icon: Send,
  },
  invited: {
    label: 'Invited',
    meaning: 'Given access when the apps opened; awaiting whether they take it.',
    tone: 'primary',
    icon: Ticket,
  },
  archived: {
    label: 'Archived',
    meaning: 'Kept for record only (spam, duplicate, or no longer relevant).',
    tone: 'neutral',
    icon: Archive,
  },
};

/**
 * Verification status. The backend models verification as a boolean
 * (`is_verified`) plus the admin verification queue — not a multi-state
 * workflow. These keys are the *complete* backend vocabulary (pending exists
 * only as an absence of a decision; rejected persists for pharmacies).
 * Do not invent states the backend does not have (§6/§11).
 */
export const verificationStatusConfig: Record<string, StatusConfig> = {
  pending: {
    label: 'Pending',
    meaning: 'Submitted and awaiting an administrative decision.',
    tone: 'warning',
    icon: Clock,
  },
  approved: { label: 'Approved', meaning: 'Approved and verified.', tone: 'success', icon: ShieldCheck },
  rejected,
};

// ---------------------------------------------------------------------------
// Lookup + normalization
// ---------------------------------------------------------------------------

/** Normalizes any backend status casing (`PENDING`, `Pending`, `pending`). */
function normalizeKey(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Case-insensitive status lookup with a safe neutral fallback. */
export function getStatusConfig(
  map: Record<string, StatusConfig>,
  status: string | null | undefined
): StatusConfig {
  const key = status ? normalizeKey(status) : '';
  return (
    map[key] ?? {
      label: status ? humanizeStatusKey(status) : 'Unknown',
      meaning: 'Unrecognized status — verify against the source record.',
      tone: 'neutral',
      icon: CircleDashed,
    }
  );
}

export function humanizeStatusKey(status: string): string {
  return normalizeKey(status)
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Tailwind classes per tone — the only place tones map to colors (§15). */
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-neutral-subtle text-foreground-muted ring-border',
  info: 'bg-info-subtle text-info ring-info/20',
  success: 'bg-success-subtle text-success ring-success/20',
  warning: 'bg-warning-subtle text-warning ring-warning/20',
  danger: 'bg-danger-subtle text-danger ring-danger/20',
  primary: 'bg-primary-subtle text-primary ring-primary/20',
};

/** Chart-series tones for semantic status breakdowns (§40). */
export const STATUS_TONE_CHART_COLORS: Record<StatusTone, string> = {
  neutral: 'var(--chart-grid)',
  info: 'var(--chart-3)',
  success: 'var(--chart-1)',
  warning: 'var(--chart-2)',
  danger: 'var(--chart-5)',
  primary: 'var(--chart-1)',
};
