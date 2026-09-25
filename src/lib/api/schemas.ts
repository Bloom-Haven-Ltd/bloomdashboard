/**
 * Zod schemas validating backend responses at the API boundary.
 *
 * Backend payloads are untrusted regardless of TypeScript types (§64). These
 * schemas validate only what the dashboard's behaviour depends on — parsing
 * failures surface as `ApiError('VALIDATION_ERROR')` rather than runtime
 * crashes deep inside a render.
 */

import { z } from 'zod';
import { ApiError } from './error';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true }).or(z.string().min(1));

export const userRoleSchema = z.enum(['patient', 'doctor', 'pharmacy', 'lab', 'admin']);
export type UserRoleDto = z.infer<typeof userRoleSchema>;

const userBriefSchema = z.object({
  id: uuid,
  email: z.string().email(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  role: userRoleSchema,
  is_verified: z.boolean(),
  profile_complete: z.boolean().default(false),
  phone_number: z.string().nullable(),
});
export type UserBriefDto = z.infer<typeof userBriefSchema>;

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** Standard `{ success, data, total, page, page_size, total_pages }` wrapper. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    success: z.boolean().default(true),
    data: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
  });
}

/** Some legacy endpoints return bare arrays — accepted defensively. */
export function listSchema<T extends z.ZodTypeAny>(item: T) {
  return z.array(item);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const sessionResponseSchema = z.object({
  session_id: uuid,
  user: userBriefSchema,
  status: z.string(),
  expires_at: isoDateTime,
});
export type SessionResponseDto = z.infer<typeof sessionResponseSchema>;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  id: uuid,
  email: z.string(),
  phone_number: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  role: userRoleSchema,
  is_active: z.boolean(),
  is_verified: z.boolean(),
  profile_picture: z.string().nullable().optional(),
  profile_complete: z.boolean().optional(),
  timezone: z.string().optional(),
  last_login: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1).optional(),
  provider_verified: z.boolean().optional(),
});
export type UserDto = z.infer<typeof userSchema>;

export const paginatedUsersSchema = paginatedSchema(userSchema);

// ---------------------------------------------------------------------------
// Admin stats
// ---------------------------------------------------------------------------

export const systemStatsSchema = z.object({
  total_users: z.number().int().nonnegative(),
  users_by_role: z.record(z.string(), z.number().int().nonnegative()),
  total_doctors: z.number().int().nonnegative(),
  total_labs: z.number().int().nonnegative(),
  total_pharmacies: z.number().int().nonnegative(),
  total_patients: z.number().int().nonnegative(),
  pending_verifications: z.number().int().nonnegative(),
  total_revenue: z.number(),
  total_consultations: z.number().int().nonnegative(),
  active_consultations: z.number().int().nonnegative(),
  total_orders: z.number().int().nonnegative(),
  total_disputes: z.number().int().nonnegative(),
});
export type SystemStatsDto = z.infer<typeof systemStatsSchema>;

// ---------------------------------------------------------------------------
// Verifications
// ---------------------------------------------------------------------------

export const pendingVerificationSchema = z
  .object({
    id: uuid,
    user_id: uuid,
    name: z.string(),
    email: z.string(),
    role: z.string(),
    created_at: z.string().min(1),
    documents: z.record(z.string(), z.unknown()).nullable().optional(),
    license_number: z.string().nullable().optional(),
  })
  /**
   * `name` is raw user input (doctors join first/last; labs/pharmacies are
   * self-reported). `display_name` adds a safe fallback for rendering.
   */
  .transform((entry) => ({
    ...entry,
    display_name: entry.name.trim() || entry.email || 'Unnamed applicant',
  }));
export type PendingVerificationDto = z.infer<typeof pendingVerificationSchema>;

// ---------------------------------------------------------------------------
// Partner profiles (Phase 5) — public partner-profile endpoints
// ---------------------------------------------------------------------------

/** GET /doctors/{id} (DoctorResponse — display subset). */
export const doctorProfileSchema = z.object({
  id: uuid,
  user_id: uuid,
  specialty: z.string(),
  experience_years: z.number().int().nonnegative(),
  bio: z.string().nullable().optional(),
  consultation_fee: z.number(),
  currency: z.string().optional(),
  languages: z.array(z.string()).optional(),
  working_hours: z.record(z.string(), z.unknown()).optional(),
  availability: z.record(z.string(), z.unknown()).optional(),
  is_online: z.boolean().optional(),
  is_verified: z.boolean(),
  license_number: z.string().nullable().optional(),
  education: z.array(z.record(z.string(), z.unknown())).optional(),
  certifications: z.array(z.record(z.string(), z.unknown())).optional(),
  rating: z.number().optional(),
  total_reviews: z.number().int().nonnegative().optional(),
  last_active: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1).optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
});
export type DoctorProfileDto = z.infer<typeof doctorProfileSchema>;

/** GET /labs/{id} (LabProfileResponse — display subset). */
export const labProfileSchema = z.object({
  id: uuid,
  user_id: uuid,
  name: z.string(),
  is_verified: z.boolean(),
  rating: z.number().optional(),
  total_reviews: z.number().int().nonnegative().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1).optional(),
});
export type LabProfileDto = z.infer<typeof labProfileSchema>;

/** GET /pharmacies/{id} (PharmacyResponse — display subset). */
export const pharmacyProfileSchema = z.object({
  id: uuid,
  owner_id: uuid,
  name: z.string(),
  license_number: z.string().nullable().optional(),
  pharmacy_type: z.string(),
  status: z.string(),
  contact_phone: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  ghana_post_gps: z.string().nullable().optional(),
  services: z.array(z.string()).optional(),
  business_hours: z.record(z.string(), z.unknown()).optional(),
  delivery_radius_km: z.number().optional(),
  delivery_fee: z.number().optional(),
  minimum_order_amount: z.number().optional(),
  rating: z.number().optional(),
  total_reviews: z.number().int().nonnegative().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1).optional(),
});
export type PharmacyProfileDto = z.infer<typeof pharmacyProfileSchema>;

// ---------------------------------------------------------------------------
// Operations feeds (consultations / pharmacy orders / lab bookings)
// ---------------------------------------------------------------------------

/** Item of GET /admin/consultations (ConsultationResponse — display subset). */
export const consultationFeedSchema = z.object({
  id: uuid,
  patient_id: uuid,
  doctor_id: uuid,
  date_time: z.string().min(1),
  status: z.string(),
  consultation_type: z.string(),
  consultation_mode: z.string(),
  payment_status: z.string(),
  amount: z.number(),
  currency: z.string(),
  urgency_level: z.string(),
  is_consultation_ready: z.boolean().optional(),
  consultation_start_time: z.string().min(1).nullable().optional(),
  consultation_end_time: z.string().min(1).nullable().optional(),
  duration_seconds: z.number().int().nonnegative().nullable().optional(),
  cancellation_reason: z.string().min(1).nullable().optional(),
  reschedule_reason: z.string().min(1).nullable().optional(),
  payment_reference: z.string().min(1).nullable().optional(),
  patient_name: z.string().nullable().optional(),
  provider: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().min(1),
});
export type ConsultationFeedDto = z.infer<typeof consultationFeedSchema>;
export const paginatedConsultationsSchema = paginatedSchema(consultationFeedSchema);

/** Item of GET /admin/pharmacy-orders (OrderResponse — display subset). */
export const orderFeedSchema = z.object({
  id: uuid,
  pharmacy_id: uuid,
  patient_id: uuid,
  prescription_id: uuid.nullable().optional(),
  order_type: z.string(),
  status: z.string(),
  delivery_method: z.string(),
  total_amount: z.number(),
  currency: z.string(),
  payment_status: z.string(),
  payment_reference: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type OrderFeedDto = z.infer<typeof orderFeedSchema>;
export const paginatedOrdersSchema = paginatedSchema(orderFeedSchema);

/**
 * Item of GET /pharmacy-orders/{id} (OrderResponse — admin-blocked in the
 * backend, PL-1; kept for tolerant rendering when that dependency lands).
 * Only operational fields are modeled; `notes` and `delivery_*` PII are
 * deliberately excluded (§38).
 */
export const pharmacyOrderDetailSchema = orderFeedSchema
  .omit({ delivery_method: true })
  .extend({
    delivery_method: z.string(),
    subtotal: z.number(),
    tracking_number: z.string().min(1).nullable().optional(),
    rejection_reason: z.string().min(1).nullable().optional(),
    cancellation_reason: z.string().min(1).nullable().optional(),
  });
export type PharmacyOrderDetailDto = z.infer<typeof pharmacyOrderDetailSchema>;

/** Item of GET /pharmacy-orders/{id}/history (status-change timeline, PL-1). */
export const orderStatusEventSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: z.string(),
  changed_by: z.string().uuid().nullable().optional(),
  notes: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
});
export type OrderStatusEventDto = z.infer<typeof orderStatusEventSchema>;

/**
 * Embedded LabRequest on a lab booking (§30) — operational references and the
 * requested tests only. The backend's `patient` embed (email/phone/gender) is
 * NOT modeled and is stripped at parse (audit PL-3).
 */
export const labBookingRequestSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid().nullable().optional(),
  patient_id: z.string().uuid(),
  lab_id: z.string().uuid(),
  tests: z.array(z.string().min(1)),
  status: z.string(),
  created_at: z.string().min(1),
});
export type LabBookingRequestDto = z.infer<typeof labBookingRequestSchema>;

/** Item of GET /admin/lab-bookings (LabBookingResponse — display subset). */
export const labBookingFeedSchema = z.object({
  id: uuid,
  patient_id: uuid,
  lab_id: uuid,
  booking_date: z.string().min(1),
  booking_type: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
  payment_status: z.string(),
  payment_reference: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
  /** Backend may serialize null/absent under detachment (audit PL-4). */
  request: labBookingRequestSchema.nullable().optional(),
});
export type LabBookingFeedDto = z.infer<typeof labBookingFeedSchema>;
export const paginatedLabBookingsSchema = paginatedSchema(labBookingFeedSchema);

// ---------------------------------------------------------------------------
// Prescriptions (GET /prescriptions — admin-bypassed service, PL-5)
// ---------------------------------------------------------------------------

/**
 * Item of GET /prescriptions (PrescriptionResponse — operational subset).
 * Clinical content (`diagnosis`, medication `instructions`) is modeled ONLY
 * in `prescriptionDetailSchema`, consumed by the permission-gated detail
 * route (§13/§38). The list parse drops them entirely.
 */
export const prescriptionMedicationSchema = z.object({
  medication_name: z.string().min(1),
  dosage: z.string().min(1).nullable().optional(),
  frequency: z.string().min(1).nullable().optional(),
  duration: z.string().min(1).nullable().optional(),
});
export type PrescriptionMedicationDto = z.infer<typeof prescriptionMedicationSchema>;

export const prescriptionFeedSchema = z.object({
  id: uuid,
  consultation_id: z.string().uuid(),
  patient_id: uuid,
  doctor_id: uuid,
  status: z.string(),
  pharmacy_id: uuid.nullable().optional(),
  fulfilled_at: z.string().min(1).nullable().optional(),
  medications: z.array(prescriptionMedicationSchema).default([]),
  created_at: z.string().min(1),
});
export type PrescriptionFeedDto = z.infer<typeof prescriptionFeedSchema>;
export const paginatedPrescriptionsSchema = paginatedSchema(prescriptionFeedSchema);

/**
 * Detail parse — adds the gated clinical fields (prescriber `diagnosis`,
 * per-medication `instructions`); render requires `prescriptions.clinical`.
 */
export const prescriptionDetailSchema = prescriptionFeedSchema.extend({
  diagnosis: z.string().min(1).nullable().optional(),
  medications: z
    .array(
      prescriptionMedicationSchema.extend({
        instructions: z.string().min(1).nullable().optional(),
      })
    )
    .default([]),
});
export type PrescriptionDetailDto = z.infer<typeof prescriptionDetailSchema>;

/** Item of GET /pharmacies/inventory/search (InventoryItemResponse — public). */
export const inventoryItemSchema = z.object({
  id: uuid,
  pharmacy_id: uuid,
  product_name: z.string().min(1),
  generic_name: z.string().min(1).nullable().optional(),
  dosage_form: z.string().min(1).nullable().optional(),
  strength: z.string().min(1).nullable().optional(),
  unit_price: z.number(),
  quantity_in_stock: z.number().int().nonnegative(),
  reserved_quantity: z.number().int().nonnegative().default(0),
  available_quantity: z.number().int().nonnegative().default(0),
  reorder_level: z.number().int().nonnegative(),
  requires_prescription: z.boolean(),
  category: z.string().min(1).nullable().optional(),
  is_active: z.boolean(),
  expiry_date: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
});
export type InventoryItemDto = z.infer<typeof inventoryItemSchema>;
export const paginatedInventorySchema = paginatedSchema(inventoryItemSchema);

/** Item of GET /labs/catalog (LabTestCatalogResponse — public, bare list). */
export const labTestCatalogSchema = z.object({
  id: uuid,
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  sample_type: z.string().min(1),
  turnaround_hours: z.number().int().nonnegative(),
  prep_instructions: z.string().min(1).nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string().min(1),
});
export type LabTestCatalogDto = z.infer<typeof labTestCatalogSchema>;

// ---------------------------------------------------------------------------
// Finance transactions
// ---------------------------------------------------------------------------

/**
 * Item of GET /admin/finance/transactions (WalletTransactionResponse).
 * Wire format is camelCase (Pydantic aliases): walletId, providerId, balanceAfter,
 * referenceId, timestamp. Accepted defensively — snake_case also parsed — and
 * normalized to snake_case DTO fields.
 */
export const financeTransactionSchema = z
  .object({
    id: uuid,
    type: z.string(),
    amount: z.number(),
    currency: z.string().optional(),
    status: z.string().optional(),
    description: z.string().nullable().optional(),
    reference_id: z.string().nullable().optional(),
    created_at: z.string().min(1).optional(),
    wallet_id: uuid.optional(),
    user_id: uuid.optional(),
  })
  .passthrough()
  .transform((tx) => {
    const raw = tx as Record<string, unknown>;
    return {
      ...tx,
      reference_id: tx.reference_id ?? (raw.referenceId as string | undefined) ?? null,
      wallet_id: tx.wallet_id ?? (raw.walletId as string | undefined),
      created_at: tx.created_at ?? (raw.timestamp as string | undefined),
    };
  });
export type FinanceTransactionDto = z.infer<typeof financeTransactionSchema>;

// ---------------------------------------------------------------------------
// Payments (payments module — UPPERCASE statuses, pesewa amounts server-side)
// ---------------------------------------------------------------------------

/** Item of GET /payments (admin sees all rows — payment_service.list_payments). */
export const paymentListItemSchema = z.object({
  id: uuid,
  reference: z.string(),
  amount_ghs: z.number(),
  amount_pesewas: z.number().optional(),
  currency: z.string(),
  status: z.string(),
  channel: z.string().nullable().optional(),
  service_type: z.string(),
  service_id: uuid,
  customer_email: z.string().optional(),
  customer_phone: z.string().nullable().optional(),
  paid_at: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
}).passthrough();
export type PaymentListItemDto = z.infer<typeof paymentListItemSchema>;
export const paginatedPaymentsSchema = paginatedSchema(paymentListItemSchema);

/** Body of GET /payments/{id} (ApiResponse wrapper → data). */
export const paymentDetailSchema = z
  .object({
    id: uuid,
    reference: z.string(),
    amount_ghs: z.number(),
    amount_pesewas: z.number().optional(),
    currency: z.string(),
    status: z.string(),
    channel: z.string().nullable().optional(),
    service_type: z.string(),
    service_id: uuid,
    paid_at: z.string().min(1).nullable().optional(),
    created_at: z.string().min(1),
  })
  .passthrough();
export type PaymentDetailDto = z.infer<typeof paymentDetailSchema>;

/** Body of GET /payments/admin/stats — backend-authoritative totals (no date ranges). */
export const paymentStatsSchema = z.object({
  total_revenue_ghs: z.number(),
  total_refunds_ghs: z.number(),
  net_revenue_ghs: z.number(),
  successful_payments_count: z.number().int().nonnegative(),
  pending_payments_count: z.number().int().nonnegative(),
  failed_payments_count: z.number().int().nonnegative(),
  refunded_payments_count: z.number().int().nonnegative(),
});
export type PaymentStatsDto = z.infer<typeof paymentStatsSchema>;

/** Body of GET /payments/{id}/receipt — server-built receipt (owner or admin). */
export const paymentReceiptSchema = z.object({
  receipt_number: z.string(),
  payment_reference: z.string(),
  organization: z.string().optional(),
  patient_name: z.string(),
  provider_name: z.string(),
  service_type: z.string(),
  service_id: z.string(),
  amount_ghs: z.number(),
  currency: z.string(),
  payment_method: z.string(),
  payment_status: z.string(),
  paid_at: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
}).passthrough();
export type PaymentReceiptDto = z.infer<typeof paymentReceiptSchema>;

/**
 * WithdrawalRequest (GET /withdrawals/pending, bare list).
 * The backend serializes the FULL bank account number (audit FS-10); it is
 * masked here at the parse boundary so the raw value never reaches the cache
 * or components.
 */
export const withdrawalSchema = z
  .object({
    id: uuid,
    amount: z.number(),
    status: z.string(),
  })
  .passthrough()
  .transform((w) => {
    const raw = w as Record<string, unknown>;
    const pick = (...keys: string[]): unknown => {
      for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
      return undefined;
    };
    const accountNumber = String(pick('bankAccountNumber', 'bank_account_number') ?? '');
    const masked =
      accountNumber.length > 4 ? `•••• ${accountNumber.slice(-4)}` : accountNumber ? '••••' : '—';
    return {
      id: w.id,
      amount: w.amount,
      status: w.status,
      wallet_id: String(pick('walletId', 'wallet_id') ?? ''),
      provider_id: String(pick('providerId', 'provider_id') ?? ''),
      bank_account_name: String(pick('bankAccountName', 'bank_account_name') ?? '—'),
      bank_account_masked: masked,
      bank_name: String(pick('bankName', 'bank_name') ?? '—'),
      reason: (pick('reason', 'rejectionReason') as string | undefined) ?? null,
      rejection_reason: (pick('rejectionReason', 'rejection_reason') as string | undefined) ?? null,
      processed_at: (pick('processedAt', 'processed_at') as string | undefined) ?? null,
      created_at: String(pick('requestedAt', 'created_at', 'updatedAt') ?? ''),
    };
  });
export type WithdrawalDto = z.infer<typeof withdrawalSchema>;
export const withdrawalListSchema = listSchema(withdrawalSchema);

/** Result of POST /wallets/reconcile (wallet ↔ ledger run, admin). */
export const walletReconciliationSchema = z.object({
  reconciliation_id: z.string().optional(),
  status: z.string(),
  total_checked: z.number().int().nonnegative(),
  matched_count: z.number().int().nonnegative(),
  mismatched_count: z.number().int().nonnegative(),
  discrepancies: z
    .object({
      provider_id: z.string(),
      wallet_id: z.string().optional(),
      wallet_total_funds: z.number(),
      ledger_balance: z.number(),
      difference: z.number(),
      currency: z.string().optional(),
    })
    .passthrough()
    .array()
    .optional(),
  timestamp: z.string().min(1),
}).passthrough();
export type WalletReconciliationDto = z.infer<typeof walletReconciliationSchema>;

/**
 * Result of POST /payments/admin/reconcile (inline report — not persisted).
 * Bloom amounts are pesewas; gateway amounts may be null when Paystack has
 * no matching transaction (the interesting case).
 */
export const paymentsReconciliationSchema = z.object({
  generated_at: z.string().min(1),
  total_checked: z.number().int().nonnegative(),
  matched_count: z.number().int().nonnegative(),
  mismatch_count: z.number().int().nonnegative(),
  items: z
    .object({
      reference: z.string(),
      bloom_status: z.string().nullable().optional(),
      gateway_status: z.string().nullable().optional(),
      bloom_amount_pesewas: z.number().nullable().optional(),
      gateway_amount_pesewas: z.number().nullable().optional(),
      result: z.string(),
      details: z.string().nullable().optional(),
    })
    .passthrough()
    .array()
    .optional(),
}).passthrough();
export type PaymentsReconciliationDto = z.infer<typeof paymentsReconciliationSchema>;
export const paginatedFinanceTransactionsSchema = paginatedSchema(financeTransactionSchema);

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export const auditLogSchema = z.object({
  id: uuid,
  user_id: uuid.nullable().optional(),
  action: z.string(),
  target_type: z.string().nullable().optional(),
  target_id: z.string().nullable().optional(),
  old_value: z.record(z.string(), z.unknown()).nullable().optional(),
  new_value: z.record(z.string(), z.unknown()).nullable().optional(),
  ip_address: z.string().nullable().optional(),
  created_at: z.string().min(1),
});
export type AuditLogDto = z.infer<typeof auditLogSchema>;

export const paginatedAuditLogsSchema = paginatedSchema(auditLogSchema);

// ---------------------------------------------------------------------------
// Disputes (support)
// ---------------------------------------------------------------------------

export const supportDisputeSchema = z.object({
  id: uuid,
  reporter_id: uuid,
  target_type: z.string(),
  target_id: uuid,
  subject: z.string(),
  description: z.string(),
  status: z.string(),
  resolution: z.string().nullable().optional(),
  resolved_by: uuid.nullable().optional(),
  resolved_at: z.string().min(1).nullable().optional(),
  created_at: z.string().min(1),
});
export type SupportDisputeDto = z.infer<typeof supportDisputeSchema>;

export const paginatedDisputesSchema = paginatedSchema(supportDisputeSchema);

// ---------------------------------------------------------------------------
// Performance analytics
// ---------------------------------------------------------------------------

export const performanceMetricSchema = z.object({
  name: z.string(),
  users: z.number().int().nonnegative(),
  consultations: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
});

export const platformPerformanceSchema = z.object({
  period: z.enum(['24h', '7d', '30d']),
  data: z.array(performanceMetricSchema),
});
export type PlatformPerformanceDto = z.infer<typeof platformPerformanceSchema>;

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

export const systemSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.string(),
  description: z.string().nullable().optional(),
});
export type SystemSettingDto = z.infer<typeof systemSettingSchema>;

// ---------------------------------------------------------------------------
// Platform health (GET /health — public, DB + Redis only, audit PS-1)
// ---------------------------------------------------------------------------

export const platformHealthSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
  database: z.boolean(),
  redis: z.boolean(),
});
export type PlatformHealthDto = z.infer<typeof platformHealthSchema>;

/**
 * App config (GET /app/config) — remote application configuration. Contains
 * only operational values; never secrets (§33).
 */
export const appConfigSchema = z.object({
  minimum_supported_version: z.string().optional(),
  latest_version: z.string().optional(),
  force_update: z.boolean().optional(),
  update_message: z.string().optional(),
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().optional(),
  support_email: z.string().optional(),
  support_phone: z.string().optional(),
}).passthrough();
export type AppConfigDto = z.infer<typeof appConfigSchema>;

/** Feature flags (GET /feature-flags) — backend-owned booleans, read-only here (PS-8). */
export const featureFlagsSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
});
export type FeatureFlagsDto = z.infer<typeof featureFlagsSchema>;

// ---------------------------------------------------------------------------
// Parser helper
// ---------------------------------------------------------------------------

/**
 * Parses an untrusted payload with a schema, raising `ApiError`
 * (`VALIDATION_ERROR`) on failure. Used by every service function.
 * Infers the schema's exact **output** type, so transforms (which differ
 * between input and output) type correctly.
 */
export function parseWith<S extends z.ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', 'The server returned data in an unexpected format.', {
      details: result.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), code: i.code })),
    });
  }
  return result.data;
}
