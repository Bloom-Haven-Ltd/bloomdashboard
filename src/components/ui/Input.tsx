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
 * Accessible labeled input: programmatic label association, inline error
 * wiring via aria-describedby, and visible focus states (§45).
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
          'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500',
          hideLabel && 'sr-only'
        )}
      >
        {label}
        {required && <span aria-hidden className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
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
            'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-colors',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200',
            leadingIcon && 'pl-10',
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
