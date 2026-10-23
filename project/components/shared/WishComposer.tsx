'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { whatsappNumber } from '@/lib/star-wish';

interface WishComposerProps {
  /** Rendered message to start from; the user can edit it. */
  initialText: string;
  phone: string | null | undefined;
  /** Called when the message is sent to WhatsApp or copied (for logging). */
  onSend: (channel: 'whatsapp' | 'copy', text: string) => void;
}

/**
 * Editable message preview with "Open WhatsApp" (wa.me link, UTF-8
 * percent-encoded so Tamil and line breaks survive) and "Copy message".
 */
export function WishComposer({ initialText, phone, onSend }: WishComposerProps) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setText(initialText); }, [initialText]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: fall back to a temporary textarea.
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onSend('copy', text);
  }

  const number = whatsappNumber(phone);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="wish-text">Message</Label>
        <Textarea id="wish-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="text-sm leading-relaxed" />
      </div>
      {!number && (
        <p className="text-xs text-muted-foreground">No phone number saved — WhatsApp will ask you to choose the chat.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <a href={buildWhatsAppUrl(number, text)} target="_blank" rel="noreferrer" onClick={() => onSend('whatsapp', text)}>
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            <MessageCircle className="h-4 w-4 mr-2" />Open WhatsApp
          </Button>
        </a>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied' : 'Copy message'}
        </Button>
      </div>
    </div>
  );
}
