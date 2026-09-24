export const RELATIONSHIPS = [
  'Wife',
  'Husband',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Other',
] as const;

export const OCCASION_TYPES = [
  'Birthday',
  'Wedding Anniversary',
  'Business Anniversary',
  'Achievement',
  'Celebration',
  'Other',
] as const;

export const OCCASION_ICONS: Record<string, string> = {
  Birthday: '🎂',
  'Wedding Anniversary': '💍',
  'Business Anniversary': '🏢',
  Achievement: '🏆',
  Celebration: '🎉',
  Other: '⭐',
};

export const SPONSORSHIP_STATUSES = [
  'draft',
  'contacted',
  'interested',
  'confirmed',
  'pending',
  'declined',
  'completed',
  'cancelled',
] as const;

export const SPONSORSHIP_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  contacted: 'Contacted',
  interested: 'Interested',
  confirmed: 'Confirmed',
  pending: 'Pending',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TASK_STATUSES = [
  'Pending',
  'Contacted',
  'Interested',
  'Not Interested',
  'Call Later',
  'Completed',
] as const;

export const DONATION_TYPES = [
  'Food',
  'Money',
  'Clothes',
  'Education',
  'Medical',
  'Groceries',
  'Books & Stationery',
  'Other',
] as const;

/** Older records were saved with this type before donations covered more than food. */
export function normalizeDonationType(type?: string | null): string {
  if (!type || type === 'Food Sponsorship') return 'Food';
  return type;
}

export const FOOD_TYPES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Groceries',
  'Fruits',
  'Other',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Cheque',
  'Online',
  'Other',
] as const;

export const COMMUNICATION_PREFERENCES = [
  'whatsapp',
  'call',
  'email',
  'sms',
] as const;

export const REMINDER_INTERVAL_OPTIONS = [
  { label: '30 days before', value: 30 },
  { label: '15 days before', value: 15 },
  { label: '7 days before', value: 7 },
  { label: '3 days before', value: 3 },
  { label: '2 days before', value: 2 },
  { label: '1 day before', value: 1 },
  { label: 'Same day', value: 0 },
];

export const TEMPLATE_TYPES = [
  'Birthday Wish',
  'Anniversary Wish',
  'Child Birthday',
  'Sponsorship Request',
  'Thank You',
  'Follow-up',
] as const;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Sponsors', href: '/sponsors', icon: 'Users' },
  { label: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { label: 'Reminders', href: '/reminders', icon: 'Bell' },
  { label: 'Sponsorships', href: '/sponsorships', icon: 'HandHeart' },
  { label: 'Donations', href: '/donations', icon: 'Gift' },
  { label: 'Reports', href: '/reports', icon: 'BarChart3' },
  { label: 'Notifications', href: '/notifications', icon: 'Bell' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
];

export const MOBILE_NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: 'Home' },
  { label: 'Sponsors', href: '/sponsors', icon: 'Users' },
  { label: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { label: 'Reminders', href: '/reminders', icon: 'Bell' },
  { label: 'More', href: '/settings', icon: 'Menu' },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
