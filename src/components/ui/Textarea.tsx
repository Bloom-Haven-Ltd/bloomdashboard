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

  return (
    <div className="w-full">
      <label
        htmlFor={textareaId}
        className={cn(
          'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500',
          hideLabel && 'sr-only'
        )}
      >
        {label}
        {required && <span aria-hidden className="ml-0.5 text-red-500">*</span>}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? `${textareaId}-hint` : undefined}
        className={cn(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200',
          className
        )}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
