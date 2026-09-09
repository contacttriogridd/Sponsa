'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bell, MessageCircle, Phone, CheckCircle2, Gift, Heart, Star } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: 'reminder' | 'whatsapp' | 'call' | 'sponsorship' | 'donation' | 'wish' | 'interaction' | 'other';
  title: string;
  description?: string;
  date: string;
  actor?: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  reminder: { icon: Bell, color: 'text-warning', bg: 'bg-warning/10' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50' },
  call: { icon: Phone, color: 'text-primary', bg: 'bg-primary/10' },
  sponsorship: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
  donation: { icon: Gift, color: 'text-success', bg: 'bg-success/10' },
  wish: { icon: Heart, color: 'text-destructive', bg: 'bg-destructive/10' },
  interaction: { icon: Star, color: 'text-warning', bg: 'bg-warning/10' },
  other: { icon: Star, color: 'text-muted-foreground', bg: 'bg-muted' },
};

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No history yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, i) => {
        const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.other;
        const Icon = config.icon;
        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-8 w-8 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              {i < events.length - 1 && (
                <div className="w-px flex-1 bg-border mt-2" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                  {event.actor && (
                    <p className="text-xs text-muted-foreground mt-0.5">by {event.actor}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
