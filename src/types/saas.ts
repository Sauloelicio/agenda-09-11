export type SegmentType = 'salon' | 'barbershop' | 'gym' | 'clinic' | 'services';
export type SiteStyle = 'clean' | 'warm' | 'bold';

export interface BusinessSettings {
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  service_minutes: number;
  slot_interval_minutes: number;
  open_weekdays: number[]; // 0=Dom, 1=Seg, ..., 6=Sab
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  max_capacity: number; // 1 para individual, >1 para academias/turmas
  active: boolean;
  sort_order: number;
}

export interface Professional {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  avatar_url?: string;
  active: boolean;
  phone?: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  service_id: string;
  service_name: string;
  professional_id?: string;
  professional_name?: string;
  client_name: string;
  client_phone: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  created_at: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  segment: SegmentType;
  phone: string; // WhatsApp para notificações
  email: string;
  logo_url?: string;
  primary_color?: string;
  site_style?: SiteStyle;
  bio?: string;
  address?: string;
  plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  subscription_status?: 'trial' | 'active' | 'expired' | 'past_due' | 'canceled';
  trial_started_at?: string;
  trial_ends_at: string; // ISO date
  settings: BusinessSettings;
  created_at: string;
}
