'use client';

import { toast } from 'sonner';
import { INVALID_PHONE_MESSAGE } from '@/lib/phone';

export interface EditContact {
  /** Page where the contact's number can be fixed. */
  editHref?: string | null;
  /** Or an action that opens the editor (e.g. a drawer). */
  onEdit?: (() => void) | null;
}

/** "This contact's phone number is invalid. Please update it." with an Edit contact button. */
export function warnInvalidPhone({ editHref, onEdit }: EditContact = {}, message = INVALID_PHONE_MESSAGE) {
  const go = onEdit || (editHref ? () => { window.location.href = editHref; } : null);
  toast.error(message, go ? { action: { label: 'Edit contact', onClick: go }, duration: 10000 } : { duration: 8000 });
}

interface PhoneLinkProps extends EditContact {
  /** From buildWhatsAppLink / buildSmsLink / buildCallLink: null when the number is missing or invalid. */
  href: string | null;
  children: React.ReactNode;
  /** Runs when a valid link is followed (e.g. to log the send). */
  onClick?: () => void;
  newTab?: boolean;
  className?: string;
  title?: string;
}

/**
 * A WhatsApp / SMS / call link that never opens with a bad number: without a
 * valid one it shows the invalid-number warning instead, and nothing is logged
 * as sent.
 */
export function PhoneLink({ href, children, onClick, newTab, className, title, editHref, onEdit }: PhoneLinkProps) {
  if (href) {
    return (
      <a href={href} target={newTab ? '_blank' : undefined} rel={newTab ? 'noreferrer' : undefined} onClick={onClick} className={className} title={title}>
        {children}
      </a>
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-disabled="true"
      className={className ? `${className} opacity-60` : 'opacity-60 inline-flex'}
      title={INVALID_PHONE_MESSAGE}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); warnInvalidPhone({ editHref, onEdit }); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); warnInvalidPhone({ editHref, onEdit }); } }}
    >
      {children}
    </span>
  );
}
