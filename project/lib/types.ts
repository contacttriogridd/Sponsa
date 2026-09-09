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
  id: string;
  sponsor_id: string;
  family_member_id: string | null;
  person_name: string;
  relationship: string | null;
  occasion_type: string;
  occasion_date: string;
  recurring_yearly: boolean;
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
