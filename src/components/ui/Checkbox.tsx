'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string | null;
}

/**
 * Accessible checkbox (§26): native input for reliable semantics and keyboard
 * behavior, styled indicator, programmatic label association.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, error, className, id, disabled, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? `checkbox-${autoId}`;
  const describedBy = error ? `${inputId}-error` : description ? `${inputId}-desc` : undefined;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="peer h-4 w-4 appearance-none rounded-sm border border-border-strong bg-surface transition-colors checked:border-primary checked:bg-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:checked:bg-border-strong"
          {...props}
        />
        <Check
          className="pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
          aria-hidden
        />
      </span>
      <div className="min-w-0">
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {description && (
          <p id={`${inputId}-desc`} className="mt-0.5 text-xs text-foreground-muted">
            {description}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-0.5 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});
