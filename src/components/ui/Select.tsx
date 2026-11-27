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
 * Accessible select with keyboard support, custom chevron, and design tokens.
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
          'mb-1.5 block text-xs font-semibold tracking-wide text-foreground-muted',
          hideLabel && 'sr-only'
        )}
      >
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border bg-surface px-3.5 pr-9 text-sm text-foreground shadow-sm transition-colors duration-150',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle',
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border hover:border-border-strong',
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
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
          aria-hidden
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
