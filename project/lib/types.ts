import type { Recurrence } from './recurrence';

export type UserRole = 'admin' | 'collector' | 'staff' | 'viewer';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  /** Added by migration 00009; absent on older databases. */
  org_name_en?: string | null;
  org_name_ta?: string | null;
  /** Added by migration 00011: days before a star day / payment day to remind. */
  star_reminder_days?: number | null;
  /** Donation thank-you template; added by migration 00014 (null = built-in text). */
  thank_you_template?: string | null;
  /** Admin and messaging settings; added by migration 00016. */
  admin_whatsapp_number?: string | null;
  admin_name?: string | null;
  notify_admin_default?: boolean | null;
  daily_summary_enabled?: boolean | null;
  daily_summary_time?: string | null;
  whatsapp_send_mode?: 'manual' | 'automatic' | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  currency: string;
  reminder_intervals: number[];
  whatsapp_enabled: boolean;
  whatsapp_access_token: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_verify_token: string | null;
}

export interface Sponsor {
  id: string;
  sponsor_id: string | null;
  /** Mr / Mrs / Ms / Dr; added by migration 00017. */
  title?: 'Mr' | 'Mrs' | 'Ms' | 'Dr' | null;
  full_name: string;
  preferred_name: string | null;
  dob: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  occupation: string | null;
  company: string | null;
  communication_preference: string | null;
  whatsapp_consent: boolean;
  notes: string | null;
  status: 'active' | 'archived';
  last_contact_date: string | null;
  total_donations: number;
  people_helped: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  sponsor_id: string;
  full_name: string;
  relationship: string;
  dob: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialOccasion {
  /** Added by migration 00017. Empty contact means the sponsor. */
  occasion_type_key?: string | null;
  occasion_name_en?: string | null;
  occasion_name_ta?: string | null;
  remind_days_before?: number[] | null;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_phone?: string | null;
  contact_relation?: string | null;
  linked_donation_type?: string | null;
  linked_donation_details?: string | null;
  thithi_note?: string | null;
  id: string;
  sponsor_id: string;
  family_member_id: string | null;
  person_name: string;
  relationship: string | null;
  occasion_type: string;
  occasion_date: string;
  recurring_yearly: boolean;
  /** Repeat settings; added by migration 00015. */
  recurrence?: Recurrence | null;
  weekdays?: number[] | null;
  day_of_month?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_auto_generated: boolean;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  occasion_id: string;
  sponsor_id: string;
  reminder_date: string;
  occurrence_year: number;
  days_before: number;
  status: 'pending' | 'sent' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string | null;
  sponsor_id: string | null;
  occasion_id: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface SponsorshipRequest {
  id: string;
  sponsor_id: string;
  occasion_id: string | null;
  occasion_name: string | null;
  special_date: string | null;
  /** Repeat settings; added by migration 00015. */
  recurrence?: Recurrence | null;
  weekdays?: number[] | null;
  day_of_month?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean | null;
  /** Missing until migration 00006 is applied; null means an older food request. */
  type?: string | null;
  requested_amount: number | null;
  food_type: string | null;
  people_count: number | null;
  status: string;
  collector_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  donation_id: string | null;
  sponsor_id: string;
  sponsorship_request_id: string | null;
  occasion_id: string | null;
  occasion_name: string | null;
  donation_date: string;
  type: string | null;
  amount: number;
  food_quantity: string | null;
  people_helped: number;
  location: string | null;
  food_type: string | null;
  food_description: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  receipt_number: string | null;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Thank-you tracking; added by migration 00013. */
  thank_you_sent?: boolean | null;
  thank_you_sent_at?: string | null;
  thank_you_channel?: 'whatsapp' | 'sms' | 'email' | 'copy' | null;
}

export interface Interaction {
  id: string;
  sponsor_id: string;
  type: string;
  summary: string | null;
  details: string | null;
  interaction_date: string;
  conducted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  sponsor_id: string;
  template_id: string | null;
  phone: string | null;
  message_body: string;
  direction: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  variables: string[];
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  sponsor_id: string;
  sponsorship_request_id: string | null;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SponsorWithDetails extends Sponsor {
  family_members?: FamilyMember[];
  occasions?: SpecialOccasion[];
  donations?: Donation[];
  interactions?: Interaction[];
  sponsorship_requests?: SponsorshipRequest[];
}

export interface UpcomingOccasion {
  occasion: SpecialOccasion;
  sponsor: Sponsor;
  nextDate: Date;
  daysUntil: number;
  occurrenceYear: number;
}

export type MonthlySponsorStatus = 'active' | 'paused' | 'stopped';

export interface MonthlySponsor {
  id: string;
  name: string;
  phone: string | null;
  dob: string | null;
  /** Index into RAASIS (lib/natchathiram.ts). */
  raasi: number | null;
  /** Index into STARS (lib/natchathiram.ts). */
  star: number | null;
  monthly_amount: number | null;
  payment_day: number | null;
  start_date: string | null;
  status: MonthlySponsorStatus;
  notes: string | null;
  sponsor_id: string | null;
  relationship: string | null;
  /** Added by migration 00012. */
  address?: string | null;
  /** Preferred payment mode; added by migration 00012. */
  payment_mode?: PaymentMode | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank';

export interface MonthlyPayment {
  id: string;
  monthly_sponsor_id: string;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  amount: number | null;
  status: 'paid' | 'pending';
  paid_on: string | null;
  mode: PaymentMode | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyWishLog {
  id: string;
  monthly_sponsor_id: string;
  star_date: string | null;
  template_type: string | null;
  channel: 'whatsapp' | 'copy';
  message: string;
  sent_by: string | null;
  sent_at: string;
}

export type MessageType = 'birthday_wish' | 'anniversary_wish' | 'event_wish' | 'donation_thanks' | 'admin_notification' | 'admin_daily_summary';

export interface MessageLog {
  id: string;
  sponsor_id: string | null;
  sponsor_name: string | null;
  sponsor_phone: string | null;
  message_type: MessageType;
  type_label: string | null;
  related_event_id: string | null;
  related_donation_id: string | null;
  occasion_id?: string | null;
  occasion_type?: string | null;
  occurrence_date: string;
  message_text: string;
  recipient: 'sponsor' | 'admin';
  recipient_phone: string | null;
  channel: 'whatsapp_link' | 'whatsapp_api' | 'sms' | 'email' | 'copy';
  status: 'opened' | 'sent' | 'delivered' | 'failed';
  error_message: string | null;
  provider_message_id: string | null;
  admin_notified: boolean;
  sent_by: string | null;
  sent_by_name: string | null;
  sent_at: string;
}
