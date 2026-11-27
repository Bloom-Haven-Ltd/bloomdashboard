'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
  hideLabel?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, hideLabel, className, id, required, ...props },
  ref
) {
  const autoId = useId();
  const textareaId = id ?? `textarea-${autoId}`;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;

  return (
    <div className="w-full">
      <label
        htmlFor={textareaId}
        className={cn(
          'mb-1.5 block text-xs font-semibold tracking-wide text-foreground-muted',
          hideLabel && 'sr-only'
        )}
      >
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors duration-150',
          'placeholder:text-foreground-subtle',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle',
          error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border hover:border-border-strong',
          className
        )}
        {...props}
      />
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
