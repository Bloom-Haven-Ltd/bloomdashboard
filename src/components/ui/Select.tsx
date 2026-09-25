'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string | null;
  hideLabel?: boolean;
  /** Prompt shown as the disabled first option when no value is selected. */
  placeholder?: string;
}

/**
 * Accessible select with keyboard support and custom chevron.
 * Value must be controlled by the caller.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, hideLabel, placeholder, className, id, required, ...props },
  ref
) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const errorId = `${selectId}-error`;

  return (
    <div className="w-full">
      <label
        htmlFor={selectId}
        className={cn(
          'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500',
          hideLabel && 'sr-only'
        )}
      >
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-11 w-full appearance-none rounded-xl border bg-white px-3.5 pr-10 text-sm text-slate-900 shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
