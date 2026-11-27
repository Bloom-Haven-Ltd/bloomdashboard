'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Supporting hint shown under the field. */
  hint?: string;
  error?: string | null;
  /** Renders the label visually hidden while keeping it accessible. */
  hideLabel?: boolean;
  leadingIcon?: ReactNode;
}

/**
 * Accessible labeled input: semantic tokens, programmatic label association,
 * inline error wiring via aria-describedby, and crisp focus rings.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel, leadingIcon, className, id, required, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className={cn(
          'mb-1.5 block text-xs font-semibold tracking-wide text-foreground-muted',
          hideLabel && 'sr-only'
        )}
      >
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'h-10 w-full rounded-lg border bg-surface px-3.5 text-sm text-foreground shadow-sm transition-colors duration-150',
            'placeholder:text-foreground-subtle',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle',
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border hover:border-border-strong',
            leadingIcon && 'pl-9.5',
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-foreground-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
