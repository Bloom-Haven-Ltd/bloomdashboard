'use client';

/**
 * Confirmation dialog for destructive/administrative operations.
 * Pattern: Action -> Reason -> Confirmation -> (backend authorizes -> audit).
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';

export interface ConfirmDialogStrings {
  title: string;
  /** One-sentence consequence statement. */
  consequence: string;
  confirmLabel?: string;
  /** Word the admin must type exactly to enable the confirm button. */
  requirePhrase?: string;
  /** Require a free-text reason (recommended for audited actions). */
  requireReason?: boolean;
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  strings: ConfirmDialogStrings;
  busy?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, strings, busy = false }: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setReason('');
    setPhrase('');
    setError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const phraseValid = !strings.requirePhrase || phrase.trim().toLowerCase() === strings.requirePhrase.toLowerCase();
  const reasonValid = !strings.requireReason || reason.trim().length >= 4;
  const canConfirm = phraseValid && reasonValid && !busy;

  const handleConfirm = async () => {
    if (!reasonValid) {
      setError('A short reason is required — it is recorded in the audit trail.');
      return;
    }
    if (!phraseValid) {
      setError(`Type "${strings.requirePhrase}" to confirm.`);
      return;
    }
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch {
      // Error surface is handled by the caller (toast/error state).
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={strings.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!canConfirm} isLoading={busy}>
            {strings.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground-muted">{strings.consequence}</p>
        {strings.requireReason && (
          <Textarea
            label="Reason (recorded in audit trail)"
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Why is this action being taken?"
            error={error && !reasonValid ? error : null}
            rows={3}
          />
        )}
        {strings.requirePhrase && (
          <Input
            label={`Type "${strings.requirePhrase}" to confirm`}
            required
            value={phrase}
            onChange={(event) => {
              setPhrase(event.target.value);
              setError(null);
            }}
            error={error && reasonValid && !phraseValid ? error : null}
            autoComplete="off"
          />
        )}
      </div>
    </Modal>
  );
}
