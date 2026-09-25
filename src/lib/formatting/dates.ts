/**
 * Timezone-aware date formatting.
 *
 * The platform operates in Ghana (Africa/Accra). Backend timestamps (ISO-8601)
 * remain authoritative; these helpers render them consistently regardless of
 * the administrator's device timezone. Browser-local time is never used as an
 * operational reference.
 */

export const PLATFORM_TIME_ZONE = "Africa/Accra";

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Long operational date for the command header, e.g. "Wednesday, 23 September 2026". */
const OPERATIONAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** e.g. "23 Sep 2026" */
export function formatDate(input: DateInput): string {
  const date = toDate(input);
  return date ? DATE_FORMATTER.format(date) : "—";
}

/** e.g. "14:05" in Africa/Accra */
export function formatTime(input: DateInput): string {
  const date = toDate(input);
  return date ? TIME_FORMATTER.format(date) : "—";
}

/** e.g. "23 Sep 2026, 14:05" in Africa/Accra */
export function formatDateTime(input: DateInput): string {
  const date = toDate(input);
  return date ? DATE_TIME_FORMATTER.format(date) : "—";
}

/** e.g. "Wednesday, 23 September 2026" in Africa/Accra (§8 command header). */
export function formatOperationalDate(input: DateInput = new Date()): string {
  const date = toDate(input);
  return date ? OPERATIONAL_DATE_FORMATTER.format(date) : "—";
}

/**
 * Coarse relative time for activity feeds, e.g. "just now", "12m ago",
 * "3h ago", "2d ago". Falls back to the absolute date beyond 30 days.
 */
export function formatRelativeTime(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return "—";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return formatDate(date);

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}d ago`;

  return formatDate(date);
}
