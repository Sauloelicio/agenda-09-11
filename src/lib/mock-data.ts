import { Tenant, Service, Professional, Appointment } from '@/types/saas';

const addDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-nails-1',
    slug: 'laryssa-nails',
    name: 'Laryssa Resende Nails',
    segment: 'salon',
    phone: '7996737776',
    email: 'contato@laryssanails.com',
    primary_color: '#ec4899',
    bio: 'Especialista em unhas postiças realistas, fibra de vidro e design de sobrancelhas.',
    address: 'Av. Principal, 120 - Centro',
    plan: 'trial',
    trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    settings: {
      open_time: '09:00',
      close_time: '18:00',
      lunch_start: '12:00',
      lunch_end: '13:30',
      service_minutes: 60,
      slot_interval_minutes: 60,
      open_weekdays: [1, 2, 3, 4, 5, 6],
    },
  },
  {
    id: 'tenant-barber-2',
    slug: 'barbearia-vintage',
    name: 'Barbearia Vintage Club',
    segment: 'barbershop',
    phone: '11987654321',
    email: 'admin@barbeariavintage.com',
    primary_color: '#f59e0b',
    bio: 'Cortes clássicos, barba na toalha quente e chopp gelado. Seu momento de cuidado.',
    address: 'Rua Augusta, 1420 - Jardins',
    plan: 'trial',
    trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    settings: {
      open_time: '09:00',
      close_time: '20:00',
      lunch_start: '13:00',
      lunch_end: '14:00',
      service_minutes: 40,
      slot_interval_minutes: 40,
      open_weekdays: [1, 2, 3, 4, 5, 6],
    },
  },
  {
    id: 'tenant-gym-3',
    slug: 'iron-gym',
    name: 'Iron Gym & Cross',
    segment: 'gym',
    phone: '21998877665',
    email: 'contato@irongym.com.br',
    primary_color: '#3b82f6',
    bio: 'Treinamento funcional, Spinning e Musculação de alta intensidade com coaches certificados.',
    address: 'Av. das Américas, 5000 - Barra da Tijuca',
    plan: 'pro',
    trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    settings: {
      open_time: '06:00',
      close_time: '22:00',
      lunch_start: null,
      lunch_end: null,
      service_minutes: 60,
      slot_interval_minutes: 60,
      open_weekdays: [1, 2, 3, 4, 5, 6],
    },
  },
];

export const INITIAL_SERVICES: Service[] = [
  // Laryssa Nails
  { id: 'srv-1', tenant_id: 'tenant-nails-1', name: 'Unha Postiça Realista', duration_minutes: 60, price: 90, max_capacity: 1, active: true, sort_order: 1 },
  { id: 'srv-2', tenant_id: 'tenant-nails-1', name: 'Fibra de Vidro (Aplicação)', duration_minutes: 120, price: 150, max_capacity: 1, active: true, sort_order: 2 },
  { id: 'srv-3', tenant_id: 'tenant-nails-1', name: 'Manutenção Gel / Tips', duration_minutes: 60, price: 80, max_capacity: 1, active: true, sort_order: 3 },
  { id: 'srv-4', tenant_id: 'tenant-nails-1', name: 'Design de Sobrancelhas', duration_minutes: 30, price: 45, max_capacity: 1, active: true, sort_order: 4 },

  // Barbearia Vintage
  { id: 'srv-5', tenant_id: 'tenant-barber-2', name: 'Corte Degradê & Tesoura', duration_minutes: 40, price: 55, max_capacity: 1, active: true, sort_order: 1 },
  { id: 'srv-6', tenant_id: 'tenant-barber-2', name: 'Barba Terapia com Toalha Quente', duration_minutes: 30, price: 45, max_capacity: 1, active: true, sort_order: 2 },
  { id: 'srv-7', tenant_id: 'tenant-barber-2', name: 'Combo Corte + Barba + Cerveja', duration_minutes: 60, price: 85, max_capacity: 1, active: true, sort_order: 3 },

  // Iron Gym (Group Classes - Max Capacity > 1)
  { id: 'srv-8', tenant_id: 'tenant-gym-3', name: 'Aula de Spinning Cardio', duration_minutes: 50, price: 35, max_capacity: 15, active: true, sort_order: 1 },
  { id: 'srv-9', tenant_id: 'tenant-gym-3', name: 'Cross Training / WOD', duration_minutes: 60, price: 40, max_capacity: 18, active: true, sort_order: 2 },
  { id: 'srv-10', tenant_id: 'tenant-gym-3', name: 'Pilates Solo & Mobilidade', duration_minutes: 50, price: 45, max_capacity: 10, active: true, sort_order: 3 },
];

export const INITIAL_PROFESSIONALS: Professional[] = [
  // Nails
  { id: 'pro-1', tenant_id: 'tenant-nails-1', name: 'Laryssa Resende', role: 'Nail Designer Master', active: true, phone: '7996737776' },
  // Barber
  { id: 'pro-2', tenant_id: 'tenant-barber-2', name: 'Carlos "Mestre da Navalha"', role: 'Barbeiro Sênior', active: true, phone: '11999990001' },
  { id: 'pro-3', tenant_id: 'tenant-barber-2', name: 'Rodrigo Fade', role: 'Barbeiro & Visagista', active: true, phone: '11999990002' },
  // Gym
  { id: 'pro-4', tenant_id: 'tenant-gym-3', name: 'Coach Ricardo', role: 'Instrutor de Spinning & Funcional', active: true, phone: '21988880001' },
  { id: 'pro-5', tenant_id: 'tenant-gym-3', name: 'Coach Camila', role: 'Treinadora Cross & Pilates', active: true, phone: '21988880002' },
];

const today = addDays(0);
const tomorrow = addDays(1);

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-1',
    tenant_id: 'tenant-nails-1',
    service_id: 'srv-1',
    service_name: 'Unha Postiça Realista',
    professional_id: 'pro-1',
    professional_name: 'Laryssa Resende',
    client_name: 'Mariana Silva',
    client_phone: '7999881122',
    date: today,
    time: '09:00',
    status: 'completed',
    price: 90,
    created_at: new Date().toISOString(),
  },
  {
    id: 'appt-2',
    tenant_id: 'tenant-nails-1',
    service_id: 'srv-2',
    service_name: 'Fibra de Vidro (Aplicação)',
    professional_id: 'pro-1',
    professional_name: 'Laryssa Resende',
    client_name: 'Camila Rocha',
    client_phone: '7998877665',
    date: today,
    time: '14:00',
    status: 'active',
    price: 150,
    created_at: new Date().toISOString(),
  },
  {
    id: 'appt-3',
    tenant_id: 'tenant-barber-2',
    service_id: 'srv-7',
    service_name: 'Combo Corte + Barba + Cerveja',
    professional_id: 'pro-2',
    professional_name: 'Carlos "Mestre da Navalha"',
    client_name: 'Lucas Ferreira',
    client_phone: '11977665544',
    date: today,
    time: '10:00',
    status: 'completed',
    price: 85,
    created_at: new Date().toISOString(),
  },
  {
    id: 'appt-4',
    tenant_id: 'tenant-barber-2',
    service_id: 'srv-5',
    service_name: 'Corte Degradê & Tesoura',
    professional_id: 'pro-3',
    professional_name: 'Rodrigo Fade',
    client_name: 'Gabriel Souza',
    client_phone: '11966554433',
    date: today,
    time: '15:00',
    status: 'active',
    price: 55,
    created_at: new Date().toISOString(),
  },
  // Iron Gym classes with multiple participants
  {
    id: 'appt-5',
    tenant_id: 'tenant-gym-3',
    service_id: 'srv-8',
    service_name: 'Aula de Spinning Cardio',
    professional_id: 'pro-4',
    professional_name: 'Coach Ricardo',
    client_name: 'Ana Beatriz',
    client_phone: '21977778888',
    date: today,
    time: '18:00',
    status: 'active',
    price: 35,
    created_at: new Date().toISOString(),
  },
  {
    id: 'appt-6',
    tenant_id: 'tenant-gym-3',
    service_id: 'srv-8',
    service_name: 'Aula de Spinning Cardio',
    professional_id: 'pro-4',
    professional_name: 'Coach Ricardo',
    client_name: 'Bruno Meireles',
    client_phone: '21966665555',
    date: today,
    time: '18:00',
    status: 'active',
    price: 35,
    created_at: new Date().toISOString(),
  },
];

