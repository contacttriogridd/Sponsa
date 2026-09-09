'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: string;
  className?: string;
  iconColor?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className, iconColor }: StatCardProps) {
  return (
    <Card className={cn('p-4 lg:p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-muted">
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
      </div>
    </Card>
  );
}
