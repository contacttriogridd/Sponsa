'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PHONE_INPUT_ERROR, normalizePhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  id?: string;
  /** Stored value (+91XXXXXXXXXX, or an older format). */
  value: string | null | undefined;
  /** The new value: +91XXXXXXXXXX once valid, otherwise what was typed (so the form can block saving). */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** What goes in the box: the 10-digit number for an Indian mobile, the full number for a foreign one. */
function localPart(value: string | null | undefined): string {
  const n = normalizePhone(value);
  if (n) return n.waDigits.startsWith('91') && n.waDigits.length === 12 ? n.waDigits.slice(2) : n.e164;
  return (value || '').trim();
}

/**
 * Phone number field with a fixed "+91" prefix that takes the 10-digit mobile
 * number. A number typed with "+" (another country) is kept as typed. Shows
 * "Enter a valid 10-digit mobile number" once the field is left invalid.
 */
export function PhoneInput({ id, value, onChange, placeholder = '98765 43210', disabled, className }: PhoneInputProps) {
  const [text, setText] = useState(() => localPart(value));
  const [touched, setTouched] = useState(false);

  // Follow outside changes (e.g. the form loading a record), but not our own edits.
  useEffect(() => {
    if ((normalizePhone(text)?.e164 ?? text) !== (normalizePhone(value)?.e164 ?? (value || ''))) setText(localPart(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const foreign = text.trim().startsWith('+') && !text.trim().startsWith('+91');
  const invalid = text.trim() !== '' && !normalizePhone(text);

  function change(raw: string) {
    // Digits only after the fixed +91; a leading "+" switches to a full international number.
    const next = raw.trim().startsWith('+') ? `+${raw.replace(/\D/g, '')}` : raw.replace(/\D/g, '').slice(0, 12);
    setText(next);
    onChange(next ? normalizePhone(next)?.e164 ?? next : '');
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('flex rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', invalid && touched && 'border-destructive', disabled && 'opacity-50')}>
        {!foreign && <span className="flex items-center pl-3 pr-1 text-sm text-muted-foreground select-none">+91</span>}
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={text}
          onChange={(e) => change(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={foreign ? 16 : 12}
          aria-invalid={invalid}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
        />
      </div>
      {invalid && touched && <p className="text-xs text-destructive">{PHONE_INPUT_ERROR}</p>}
    </div>
  );
}

/** For a form's save: the stored value (+91…, or null when empty), or an error when the number is invalid. */
export function phoneForSave(value: string | null | undefined): { value: string | null; error: string | null } {
  const v = (value || '').trim();
  if (!v) return { value: null, error: null };
  const n = normalizePhone(v);
  return n ? { value: n.e164, error: null } : { value: null, error: PHONE_INPUT_ERROR };
}
