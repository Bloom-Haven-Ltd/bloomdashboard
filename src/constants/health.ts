/**
 * Platform health status model (§14).
 *
 * Centralized states with labels, semantics and visual treatment. The
 * dashboard renders only what can actually be measured (§13/§15): today the
 * backend `/health` endpoint reports API reachability, database and Redis
 * connectivity. Payments/notifications/telehealth have no health signal and
 * are therefore never displayed as "operational" by assumption.
 */

export type HealthState = 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'OUTAGE' | 'UNKNOWN';

export interface HealthStateConfig {
  label: string;
  meaning: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

export const HEALTH_STATE_CONFIG: Record<HealthState, HealthStateConfig> = {
  OPERATIONAL: {
    label: 'Operational',
    meaning: 'Service is responding normally.',
    tone: 'success',
  },
  DEGRADED: {
    label: 'Degraded',
    meaning: 'Service is responding with reduced capability.',
    tone: 'warning',
  },
  PARTIAL_OUTAGE: {
    label: 'Partial Outage',
    meaning: 'Some capabilities are unavailable.',
    tone: 'danger',
  },
  OUTAGE: {
    label: 'Outage',
    meaning: 'Service is unavailable.',
    tone: 'danger',
  },
  UNKNOWN: {
    label: 'Unknown',
    meaning: 'No health signal available.',
    tone: 'neutral',
  },
};

/** Services the backend can actually measure today (§13). */
export type HealthServiceKey = 'api' | 'database' | 'redis';

export interface HealthServiceMeta {
  key: HealthServiceKey;
  label: string;
  /** Admin-facing description — no infrastructure internals (§15). */
  description: string;
}

export const HEALTH_SERVICES: HealthServiceMeta[] = [
  { key: 'api', label: 'API', description: 'Platform API reachability from the dashboard.' },
  { key: 'database', label: 'Database', description: 'Authoritative data store connectivity.' },
  { key: 'redis', label: 'Cache', description: 'Cache/session backing store connectivity.' },
];
