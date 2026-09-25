'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { env } from '@/lib/config/env';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page (renders as aria-current, no link). */
  href?: string;
}

export interface PageHeaderProps {
  /** Breadcrumb trail; the last item is the current page. */
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: string;
  /** Primary actions (right-aligned). */
  actions?: React.ReactNode;
  /** Less prominent actions, rendered after primary. */
  secondaryActions?: React.ReactNode;
  className?: string;
}

/** Environment marker (§13) — unmistakable when NOT production. */
function EnvironmentBadge() {
  if (env.isProduction && env.appVersion !== 'dev') return null;
  return (
    <span className="rounded-pill bg-warning-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-warning ring-1 ring-inset ring-warning/20">
      {env.isProduction ? 'Production' : 'Development'}
    </span>
  );
}

/**
 * Consistent page header (§49): breadcrumb trail, title, description, and
 * action slots. Every major module page opens with this component.
 */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  secondaryActions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-foreground-muted">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <ChevronRight className="h-3 w-3 text-border-strong" aria-hidden />}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="rounded-sm transition-colors hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'font-semibold text-foreground' : undefined}>
                  {crumb.label}
                </span>
              )}
            </Fragment>
          );
        })}
        <span className="ml-auto">
          <EnvironmentBadge />
        </span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page-title">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-foreground-muted">{description}</p>}
        </div>
        {(actions || secondaryActions) && (
          <div className="flex flex-wrap items-center gap-2">
            {secondaryActions}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
