'use client';

import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  /** Tooltip text. Also applied as aria-label when content is icon-only. */
  label: string;
  /** Single trigger element — receives aria-describedby via cloneElement. */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'right';
  className?: string;
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'left-1/2 -translate-x-1/2 bottom-full mb-1.5',
  bottom: 'left-1/2 -translate-x-1/2 top-full mt-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2.5',
};

/**
 * Accessible CSS-only tooltip: hover + keyboard focus, no portal and no
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
          'pointer-events-none absolute z-(--z-popover) whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-surface opacity-0 shadow-md transition-opacity duration-150',
          'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          SIDE_CLASSES[side]
        )}
      >
        {label}
      </span>
    </span>
  );
}
