/**
 * Monetary formatting for the Bloom Haven Health platform (Ghana — GHS).
 *
 * Backend monetary values are authoritative; this module only formats them
 * for display. Never perform financial arithmetic with floating point
 * JavaScript numbers — all calculations belong in the backend, and untrusted
 * numeric payloads must be validated before they reach this module.
 */

const GHS_FORMATTER = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT_FORMATTER = new Intl.NumberFormat("en-GH");

/**
 * Formats a backend monetary value for display, e.g. `GHS 250.00`.
 * Returns an em dash for missing/invalid input rather than a misleading zero.
 */
export function formatGhs(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return GHS_FORMATTER.format(value);
}

/**
 * Formats a count for display with locale-aware grouping.
 * Returns an em dash for missing/invalid input.
 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return COUNT_FORMATTER.format(value);
}
