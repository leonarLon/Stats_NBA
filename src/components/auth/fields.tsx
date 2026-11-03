'use client';

import { useFormStatus } from 'react-dom';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Campo com rótulo, dica e erro ligados ao input (aria-describedby / aria-invalid). */
export function Field({
  label,
  name,
  error,
  hint,
  className,
  ...input
}: ComponentProps<'input'> & { label: string; name: string; error?: string; hint?: ReactNode }) {
  const id = `campo-${name}`;
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'min-h-11 rounded-lg border bg-surface px-3 text-text placeholder:text-muted',
          error ? 'border-negative' : 'border-border',
        )}
        {...input}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText, className }: { children: ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-disabled={pending} className={cn('w-full', className)}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** Mensagem geral do formulário: erro é anunciado na hora; sucesso, de forma educada. */
export function FormMessage({ status, message }: { status: 'idle' | 'error' | 'success'; message?: string }) {
  if (!message || status === 'idle') return null;
  return status === 'error' ? (
    <p role="alert" className="rounded-lg border border-negative/50 bg-negative/10 px-3 py-2 text-sm">
      {message}
    </p>
  ) : (
    <p role="status" className="rounded-lg border border-positive/50 bg-positive/10 px-3 py-2 text-sm">
      {message}
    </p>
  );
}
