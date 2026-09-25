'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible switch (§26): `role="switch"` with `aria-checked`, real button
 * semantics, Space/Enter toggling via the button element itself.
 */
export function Switch({ label, description, checked, onCheckedChange, disabled, className }: SwitchProps) {
  const autoId = useId();
  const [announce, setAnnounce] = useState<string | null>(null);
  const hintId = `${autoId}-hint`;

  const toggle = () => {
    if (disabled) return;
    const next = !checked;
    onCheckedChange(next);
    setAnnounce(next ? 'On' : 'Off');
  };

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <span id={`${autoId}-label`} className="block text-sm font-medium text-foreground">
          {label}
        </span>
        {description && (
          <p id={hintId} className="mt-0.5 text-xs text-foreground-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${autoId}-label`}
        aria-describedby={description ? hintId : undefined}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            toggle();
          }
        }}
        className={cn(
          'relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-pill border transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface-muted'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
        <span className="sr-only" role="status">
          {announce}
        </span>
      </button>
    </div>
  );
}
