/**
 * Dashboard "Sponsor dates" board: which window (Today / Next 3 days / This
 * week / This month) and which category a date belongs to. Pure, so it can be tested.
 */
import { occasionCategory } from '@/lib/occasion-details';
import type { ReminderItem } from '@/lib/today-reminders';

/** Non-overlapping windows, all in IST calendar days from today. */
export const WINDOWS = [
  { key: 'today', label: 'Today', from: 0, to: 0 },
  { key: 'next3', label: 'Next 3 days', from: 1, to: 3 },
  { key: 'week', label: 'This week', from: 4, to: 7 },
  { key: 'month', label: 'This month', from: 8, to: 30 },
] as const;
export type WindowKey = (typeof WINDOWS)[number]['key'];

export const BOARD_CATEGORIES = [
  { key: 'star', label: 'Star Birthday', icon: '⭐' },
  { key: 'birthday', label: 'Birthday', icon: '🎂' },
  { key: 'anniversary', label: 'Wedding Anniversary', icon: '💍' },
  { key: 'memorial', label: 'Memorial', icon: '🪔' },
  { key: 'monthly', label: 'Monthly sponsor dates', icon: '🗓️' },
] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number]['key'];

/** Which board row a dashboard reminder belongs to (null: not one of the five). */
export function boardCategoryOf(item: Pick<ReminderItem, 'key' | 'kind' | 'calm' | 'occasionRecord'>): BoardCategory | null {
  if (item.key.startsWith('mspay:')) return 'monthly';
  if (item.occasionRecord?.occasion_type_key === 'star_birthday') return 'star';
  if (item.calm) return 'memorial';
  if (item.kind === 'birthday') return 'birthday';
  if (item.occasionRecord && occasionCategory(item.occasionRecord) === 'anniversary') return 'anniversary';
  return null;
}

export function windowOf(days: number): WindowKey | null {
  return WINDOWS.find((w) => days >= w.from && days <= w.to)?.key ?? null;
}

