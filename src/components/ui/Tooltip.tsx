'use client';

import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  /** Tooltip text. Also applied as aria-label when content is icon-only. */
  label: string;
  /** Single trigger element — receives aria-describedby via cloneElement. */
  children: ReactElement;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Accessible CSS-only tooltip (§57): hover + keyboard focus, no portal and no
 * dependency. The trigger element receives `aria-describedby` directly so
 * screen readers announce the tooltip text on focus.
 */
export function Tooltip({ label, children, side = 'bottom', className }: TooltipProps) {
  const id = useId();

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        'aria-describedby': id,
      } as Partial<Record<string, unknown>>)
    : children;

  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {trigger}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute left-1/2 z-(--z-popover) -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-100',
          'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
        )}
      >
        {label}
      </span>
    </span>
  );
}
