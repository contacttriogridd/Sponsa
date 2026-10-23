'use client';

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Opens WhatsApp with the rendered Star Day Wish (link built by useStarWish). */
export function SendWishButton({ href, size = 'sm' }: { href: string; size?: 'sm' | 'default' }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Button size={size} variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
        <MessageCircle className="h-4 w-4 mr-1.5" />Send Wish
      </Button>
    </a>
  );
}
