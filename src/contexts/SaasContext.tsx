import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { 
  Tenant, 
  Service, 
  Professional, 
  Appointment, 
  BusinessSettings, 
  SegmentType,
  SiteStyle
} from '@/types/saas';
import { 
  INITIAL_TENANTS, 
  INITIAL_SERVICES, 
  INITIAL_PROFESSIONALS, 
  INITIAL_APPOINTMENTS 
} from '@/lib/mock-data';
import { generateSlots, isPastSlot } from '@/lib/slots';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PublicBookingWorkspace {
  tenant: Tenant;
  services: Service[];
  professionals: Professional[];
  canBook: boolean;
}

export interface PublicAppointmentLookup {
  id: string;
  client_name: string;
  service_name: string;
  date: string;
  time: string;
}

interface SaasContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  workspaceLoading: boolean;
  workspaceError: string | null;
  setCurrentTenant: (tenant: Tenant) => void;
  getTenantBySlug: (slug: string) => Tenant | undefined;
  loadPublicTenantPage: (slug: string) => Promise<PublicBookingWorkspace | null>;
  findPublicAppointments: (tenantId: string, phone: string) => Promise<PublicAppointmentLookup[]>;
  changePublicAppointment: (params: {
    appointmentId: string;
    phone: string;
    cancel?: boolean;
    date?: string;
    time?: string;
  }) => Promise<void>;
  
  // Resources for current tenant
  services: Service[];
  professionals: Professional[];
  appointments: Appointment[];
  
  // Resource operations
  updateTenantSettings: (tenantId: string, settings: BusinessSettings) => Promise<void>;
  updateTenantInfo: (tenantId: string, info: Partial<Tenant>) => Promise<void>;
  
  addService: (service: Omit<Service, 'id' | 'tenant_id' | 'sort_order'>) => Promise<Service>;
  updateService: (serviceId: string, data: Partial<Service>) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  
  addProfessional: (pro: Omit<Professional, 'id' | 'tenant_id'>) => Promise<Professional>;
  updateProfessional: (proId: string, data: Partial<Professional>) => Promise<void>;
  deleteProfessional: (proId: string) => Promise<void>;
  
  bookAppointment: (params: {
    tenantId: string;
    serviceId: string;
    professionalId?: string;
    professionalName?: string;
    service?: Service;
    clientName: string;
    clientPhone: string;
    date: string;
    time: string;
  }) => Promise<{ success: boolean; error?: string; appointment?: Appointment }>;
  
  cancelAppointment: (appointmentId: string) => Promise<void>;
  rescheduleAppointment: (appointmentId: string, date: string, time: string) => Promise<{ success: boolean; error?: string }>;
  
  getAvailableSlots: (params: {
    tenantId: string;
    date: Date;
    serviceId?: string;
    professionalId?: string;
  }) => { time: string; remainingCapacity: number }[];
  getRemoteAvailableSlots: (params: {
    tenantId: string;
    date: Date;
    serviceId: string;
    maxCapacity: number;
    settings: BusinessSettings;
    professionalId?: string;
  }) => Promise<{ time: string; remainingCapacity: number }[]>;
  
  // Metrics helper for dashboard
  getTenantMetrics: (tenantId: string) => {
    totalRevenue: number;
    activeAppointmentsCount: number;
    todayAppointmentsCount: number;
    completedCount: number;
  };
}

const STORAGE_KEYS = {
  TENANTS: 'saas_tenants_v1',
  SERVICES: 'saas_services_v1',
  PROFESSIONALS: 'saas_professionals_v1',
  APPOINTMENTS: 'saas_appointments_v1',
  CURRENT_TENANT_ID: 'saas_current_tenant_id_v1',
};

const loadDemoData = <T extends { id: string }>(key: string, fixtures: T[]): T[] => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fixtures;

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every((item) => isRecord(item) && typeof item.id === 'string')) {
      throw new Error(`Invalid saved demo data in ${key}`);
    }

    return [...new Map([...fixtures, ...parsed as T[]].map((item) => [item.id, item])).values()];
  } catch (error) {
    console.error(`Unable to restore saved demo data for ${key}; using fixtures instead.`, error);
    return fixtures;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`Missing public booking field: ${key}`);
  return value;
};

const requiredNumber = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`Invalid public booking field: ${key}`);
  return numberValue;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SaasContext = createContext<SaasContextType | undefined>(undefined);

export const SaasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>(() => loadDemoData(STORAGE_KEYS.TENANTS, INITIAL_TENANTS));

  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => {
    const savedId = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    const found = tenants.find((t) => t.id === savedId);
    return found || tenants[0] || null;
  });

  const [allServices, setAllServices] = useState<Service[]>(() => loadDemoData(STORAGE_KEYS.SERVICES, INITIAL_SERVICES));

  const [allProfessionals, setAllProfessionals] = useState<Professional[]>(() => loadDemoData(STORAGE_KEYS.PROFESSIONALS, INITIAL_PROFESSIONALS));

  const [allAppointments, setAllAppointments] = useState<Appointment[]>(() => loadDemoData(STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS));
  const [remoteTenantIds, setRemoteTenantIds] = useState<string[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const ownedTenantKey = user?.ownedTenantIds.join(',') ?? '';

  useEffect(() => {
    let active = true;
    if (!user) {
      const oldRemoteIds = remoteTenantIds;
      setTenants((previous) => previous.filter((tenant) => !oldRemoteIds.includes(tenant.id)));
      setAllServices((previous) => previous.filter((item) => !oldRemoteIds.includes(item.tenant_id)));
      setAllProfessionals((previous) => previous.filter((item) => !oldRemoteIds.includes(item.tenant_id)));
      setAllAppointments((previous) => previous.filter((item) => !oldRemoteIds.includes(item.tenant_id)));
      if (oldRemoteIds.length > 0) setRemoteTenantIds([]);
      setWorkspaceLoading(false);
      setWorkspaceError(null);
      setCurrentTenant((previous) => previous && !oldRemoteIds.includes(previous.id)
        ? previous
        : INITIAL_TENANTS[0] ?? null);
      return () => { active = false; };
    }

    const tenantIds = user.ownedTenantIds;
    if (tenantIds.length === 0) {
      const oldRemoteIds = remoteTenantIds;
      setTenants((previous) => previous.filter((tenant) => !oldRemoteIds.includes(tenant.id)));
      setAllServices((previous) => previous.filter((item) => !oldRemoteIds.includes(item.tenant_id)));
      setAllProfessionals((previous) => previous.filter((item) => !oldRemoteIds.includes(item.tenant_id)));
      setAllAppointments((previous) => previous.filter((item) => !oldRemoteIds.includes(item.tenant_id)));
      setWorkspaceLoading(false);
      setWorkspaceError(null);
      if (oldRemoteIds.length > 0) setRemoteTenantIds([]);
      setCurrentTenant((previous) => previous && !oldRemoteIds.includes(previous.id) ? previous : null);
      return () => { active = false; };
    }

    if (tenantIds.length === remoteTenantIds.length && tenantIds.every((id) => remoteTenantIds.includes(id))) {
      setWorkspaceLoading(false);
      return () => { active = false; };
    }

    setWorkspaceLoading(true);
    setWorkspaceError(null);
    const loadWorkspace = async () => {
      const [tenantResult, settingsResult, servicesResult, professionalsResult, appointmentsResult] = await Promise.all([
        supabase.from('tenants').select('*').in('id', tenantIds),
        supabase.from('tenant_settings').select('*').in('tenant_id', tenantIds),
        supabase.from('tenant_services').select('*').in('tenant_id', tenantIds),
        supabase.from('tenant_professionals').select('*').in('tenant_id', tenantIds),
        supabase.from('tenant_appointments').select('*').in('tenant_id', tenantIds),
      ]);
      const failed = [tenantResult, settingsResult, servicesResult, professionalsResult, appointmentsResult]
        .find((result) => result.error);
      if (failed?.error) throw failed.error;
      if (!active) return;

      const settings = settingsResult.data ?? [];
      const remoteTenants: Tenant[] = (tenantResult.data ?? []).map((tenant) => {
        const row = settings.find((setting) => setting.tenant_id === tenant.id);
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          segment: tenant.segment as SegmentType,
          phone: tenant.phone,
          email: tenant.email ?? '',
          logo_url: tenant.logo_url ?? undefined,
          primary_color: tenant.primary_color ?? undefined,
          site_style: tenant.site_style as SiteStyle,
          bio: tenant.bio ?? undefined,
          address: tenant.address ?? undefined,
          plan: tenant.plan as Tenant['plan'],
          subscription_status: tenant.subscription_status as Tenant['subscription_status'],
          trial_started_at: tenant.trial_started_at,
          trial_ends_at: tenant.trial_ends_at,
          created_at: tenant.created_at,
          settings: row ? {
            open_time: row.open_time,
            close_time: row.close_time,
            lunch_start: row.lunch_start,
            lunch_end: row.lunch_end,
            service_minutes: row.service_minutes,
            slot_interval_minutes: row.slot_interval_minutes,
            open_weekdays: row.open_weekdays,
          } : {
            open_time: '09:00',
            close_time: '18:00',
            lunch_start: null,
            lunch_end: null,
            service_minutes: 60,
            slot_interval_minutes: 30,
            open_weekdays: [1, 2, 3, 4, 5, 6],
          },
        };
      });
      const mapService = (row: NonNullable<typeof servicesResult.data>[number]): Service => ({
        ...row,
        description: row.description ?? undefined,
      });
      const mapProfessional = (row: NonNullable<typeof professionalsResult.data>[number]): Professional => ({
        ...row,
        phone: row.phone ?? undefined,
        avatar_url: row.avatar_url ?? undefined,
      });
      const mapAppointment = (row: NonNullable<typeof appointmentsResult.data>[number]): Appointment => ({
        id: row.id,
        tenant_id: row.tenant_id,
        service_id: row.service_id,
        service_name: row.service_name,
        professional_id: row.professional_id ?? undefined,
        professional_name: row.professional_name ?? undefined,
        client_name: row.client_name,
        client_phone: row.phone,
        date: row.date,
        time: row.time,
        status: row.status as Appointment['status'],
        price: Number(row.price),
        created_at: row.created_at,
      });

      setTenants((previous) => [
        ...previous.filter((tenant) => !remoteTenantIds.includes(tenant.id)),
        ...remoteTenants,
      ]);
      setAllServices((previous) => [
        ...previous.filter((item) => !remoteTenantIds.includes(item.tenant_id)),
        ...(servicesResult.data ?? []).map(mapService),
      ]);
      setAllProfessionals((previous) => [
        ...previous.filter((item) => !remoteTenantIds.includes(item.tenant_id)),
        ...(professionalsResult.data ?? []).map(mapProfessional),
      ]);
      setAllAppointments((previous) => [
        ...previous.filter((item) => !remoteTenantIds.includes(item.tenant_id)),
        ...(appointmentsResult.data ?? []).map(mapAppointment),
      ]);
      setRemoteTenantIds(tenantIds);
      setCurrentTenant((previous) => remoteTenants.find((tenant) => tenant.id === previous?.id)
        ?? remoteTenants[0]
        ?? previous);
      setWorkspaceLoading(false);
    };

    void loadWorkspace().catch((error: unknown) => {
      if (!active) return;
      console.error('Unable to load account workspace:', error);
      setWorkspaceError('Não foi possível carregar os dados da sua agenda. Atualize a página para tentar novamente.');
      setWorkspaceLoading(false);
    });

    return () => { active = false; };
  }, [user, ownedTenantKey, remoteTenantIds]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants.filter((tenant) => !remoteTenantIds.includes(tenant.id))));
  }, [tenants, remoteTenantIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(allServices.filter((item) => !remoteTenantIds.includes(item.tenant_id))));
  }, [allServices, remoteTenantIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFESSIONALS, JSON.stringify(allProfessionals.filter((item) => !remoteTenantIds.includes(item.tenant_id))));
  }, [allProfessionals, remoteTenantIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(allAppointments.filter((item) => !remoteTenantIds.includes(item.tenant_id))));
  }, [allAppointments, remoteTenantIds]);

  useEffect(() => {
    if (currentTenant) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, currentTenant.id);
    }
  }, [currentTenant]);

  const getTenantBySlug = (slug: string) => {
    return tenants.find((tenant) =>
      tenant.slug.toLowerCase() === slug.toLowerCase()
      && (!UUID_PATTERN.test(tenant.id) || user?.ownedTenantIds.includes(tenant.id))
    );
  };

  const loadPublicTenantPage = useCallback(async (slug: string): Promise<PublicBookingWorkspace | null> => {
    const { data, error } = await supabase.rpc('get_public_tenant_page', { _slug: slug });
    if (error) throw new Error(error.message);
    if (data === null) return null;
    if (!isRecord(data) || !isRecord(data.tenant) || !isRecord(data.settings)) {
      throw new Error('Public booking page returned invalid business data.');
    }

    const tenantRecord = data.tenant;
    const settingsRecord = data.settings;
    const tenantId = requiredString(tenantRecord, 'id');
    const segment = requiredString(tenantRecord, 'segment');
    const siteStyle = requiredString(tenantRecord, 'site_style');
    const weekdayValue = settingsRecord.open_weekdays;
    if (!Array.isArray(weekdayValue) || !weekdayValue.every((day) => typeof day === 'number')) {
      throw new Error('Public booking page returned invalid business hours.');
    }
    if (!['salon', 'barbershop', 'gym', 'clinic', 'services'].includes(segment)
      || !['clean', 'warm', 'bold'].includes(siteStyle)) {
      throw new Error('Public booking page returned invalid business settings.');
    }

    const tenant: Tenant = {
      id: tenantId,
      slug: requiredString(tenantRecord, 'slug'),
      name: requiredString(tenantRecord, 'name'),
      segment: segment as SegmentType,
      phone: requiredString(tenantRecord, 'phone'),
      email: '',
      primary_color: typeof tenantRecord.primary_color === 'string' ? tenantRecord.primary_color : undefined,
      site_style: siteStyle as SiteStyle,
      bio: typeof tenantRecord.bio === 'string' ? tenantRecord.bio : undefined,
      address: typeof tenantRecord.address === 'string' ? tenantRecord.address : undefined,
      plan: typeof tenantRecord.plan === 'string' ? tenantRecord.plan as Tenant['plan'] : 'trial',
      trial_started_at: typeof tenantRecord.trial_started_at === 'string' ? tenantRecord.trial_started_at : undefined,
      trial_ends_at: typeof tenantRecord.trial_ends_at === 'string' ? tenantRecord.trial_ends_at : '',
      created_at: typeof tenantRecord.created_at === 'string' ? tenantRecord.created_at : '',
      settings: {
        open_time: requiredString(settingsRecord, 'open_time'),
        close_time: requiredString(settingsRecord, 'close_time'),
        lunch_start: typeof settingsRecord.lunch_start === 'string' ? settingsRecord.lunch_start : null,
        lunch_end: typeof settingsRecord.lunch_end === 'string' ? settingsRecord.lunch_end : null,
        service_minutes: requiredNumber(settingsRecord, 'service_minutes'),
        slot_interval_minutes: requiredNumber(settingsRecord, 'slot_interval_minutes'),
        open_weekdays: weekdayValue,
      },
    };

    if (!Array.isArray(data.services) || !Array.isArray(data.professionals) || typeof data.can_book !== 'boolean') {
      throw new Error('Public booking page returned invalid service data.');
    }
    const services: Service[] = data.services.map((value) => {
      if (!isRecord(value)) throw new Error('Public booking page returned an invalid service.');
      return {
        id: requiredString(value, 'id'),
        tenant_id: tenantId,
        name: requiredString(value, 'name'),
        description: typeof value.description === 'string' ? value.description : undefined,
        duration_minutes: requiredNumber(value, 'duration_minutes'),
        price: requiredNumber(value, 'price'),
        max_capacity: requiredNumber(value, 'max_capacity'),
        active: value.active === true,
        sort_order: requiredNumber(value, 'sort_order'),
      };
    });
    const professionals: Professional[] = data.professionals.map((value) => {
      if (!isRecord(value)) throw new Error('Public booking page returned an invalid professional.');
      return {
        id: requiredString(value, 'id'),
        tenant_id: tenantId,
        name: requiredString(value, 'name'),
        role: typeof value.role === 'string' ? value.role : 'Profissional',
        avatar_url: typeof value.avatar_url === 'string' ? value.avatar_url : undefined,
        active: value.active === true,
      };
    });

    return { tenant, services, professionals, canBook: data.can_book };
  }, []);

  const findPublicAppointments = useCallback(async (tenantId: string, phone: string) => {
    const { data, error } = await supabase.rpc('find_tenant_appointments', {
      _tenant_id: tenantId,
      _phone: phone,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  }, []);

  const changePublicAppointment = useCallback(async ({
    appointmentId,
    phone,
    cancel = false,
    date,
    time,
  }: {
    appointmentId: string;
    phone: string;
    cancel?: boolean;
    date?: string;
    time?: string;
  }) => {
    const { error } = await supabase.rpc('change_tenant_appointment', {
      _appointment_id: appointmentId,
      _phone: phone,
      _cancel: cancel,
      _new_date: date ?? null,
      _new_time: time ?? null,
    });
    if (error) throw new Error(error.message);
  }, []);

  const currentServices = currentTenant 
    ? allServices.filter((s) => s.tenant_id === currentTenant.id && s.active) 
    : [];

  const currentProfessionals = currentTenant
    ? allProfessionals.filter((p) => p.tenant_id === currentTenant.id && p.active)
    : [];

  const currentAppointments = currentTenant
    ? allAppointments.filter((a) => a.tenant_id === currentTenant.id)
    : [];
  const isRemoteTenant = (tenantId: string) => remoteTenantIds.includes(tenantId) || UUID_PATTERN.test(tenantId);

  const updateTenantSettings = async (tenantId: string, settings: BusinessSettings) => {
    if (isRemoteTenant(tenantId)) {
      const { error } = await supabase.from('tenant_settings').upsert({
        tenant_id: tenantId,
        ...settings,
        updated_at: new Date().toISOString(),
      }).select('tenant_id').single();
      if (error) throw new Error(error.message);
    }
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, settings } : t))
    );
    if (currentTenant && currentTenant.id === tenantId) {
      setCurrentTenant((prev) => prev ? { ...prev, settings } : null);
    }
  };

  const updateTenantInfo = async (tenantId: string, info: Partial<Tenant>) => {
    if (isRemoteTenant(tenantId)) {
      const updateData: {
        name?: string;
        phone?: string;
        email?: string | null;
        logo_url?: string | null;
        primary_color?: string | null;
        site_style?: string;
        bio?: string | null;
        address?: string | null;
      } = {};
      if (info.name !== undefined) updateData.name = info.name;
      if (info.phone !== undefined) updateData.phone = info.phone;
      if (info.email !== undefined) updateData.email = info.email;
      if (info.logo_url !== undefined) updateData.logo_url = info.logo_url;
      if (info.primary_color !== undefined) updateData.primary_color = info.primary_color;
      if (info.site_style !== undefined) updateData.site_style = info.site_style;
      if (info.bio !== undefined) updateData.bio = info.bio;
      if (info.address !== undefined) updateData.address = info.address;
      const { error } = await supabase.from('tenants').update(updateData).eq('id', tenantId).select('id').single();
      if (error) throw new Error(error.message);
    }
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, ...info } : t))
    );
    if (currentTenant && currentTenant.id === tenantId) {
      setCurrentTenant((prev) => prev ? { ...prev, ...info } : null);
    }
  };

  const addService = async (service: Omit<Service, 'id' | 'tenant_id' | 'sort_order'>): Promise<Service> => {
    if (!currentTenant) throw new Error('Nenhum estabelecimento selecionado');
    if (isRemoteTenant(currentTenant.id)) {
      const { data, error } = await supabase.from('tenant_services').insert({
        tenant_id: currentTenant.id,
        name: service.name,
        description: service.description,
        duration_minutes: service.duration_minutes,
        price: service.price,
        max_capacity: service.max_capacity,
        active: service.active,
        sort_order: allServices.filter((item) => item.tenant_id === currentTenant.id).length + 1,
      }).select().single();
      if (error) throw new Error(error.message);
      const created: Service = { ...data, description: data.description ?? undefined };
      setAllServices((prev) => [...prev, created]);
      return created;
    }
    const newService: Service = {
      ...service,
      id: `srv-${Date.now()}`,
      tenant_id: currentTenant.id,
      sort_order: allServices.filter((s) => s.tenant_id === currentTenant.id).length + 1,
    };
    setAllServices((prev) => [...prev, newService]);
    return newService;
  };

  const updateService = async (serviceId: string, data: Partial<Service>) => {
    const existing = allServices.find((service) => service.id === serviceId);
    if (existing && isRemoteTenant(existing.tenant_id)) {
      const { error } = await supabase.from('tenant_services').update({
        name: data.name,
        description: data.description,
        duration_minutes: data.duration_minutes,
        price: data.price,
        max_capacity: data.max_capacity,
        active: data.active,
        sort_order: data.sort_order,
      }).eq('id', serviceId).select('id').single();
      if (error) throw new Error(error.message);
    }
    setAllServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, ...data } : s))
    );
  };

  const deleteService = async (serviceId: string) => {
    const existing = allServices.find((service) => service.id === serviceId);
    if (existing && isRemoteTenant(existing.tenant_id)) {
      const { error } = await supabase.from('tenant_services').delete().eq('id', serviceId).select('id').single();
      if (error) throw new Error(error.message);
    }
    setAllServices((prev) => prev.filter((s) => s.id !== serviceId));
  };

  const addProfessional = async (pro: Omit<Professional, 'id' | 'tenant_id'>): Promise<Professional> => {
    if (!currentTenant) throw new Error('Nenhum estabelecimento selecionado');
    if (isRemoteTenant(currentTenant.id)) {
      const { data, error } = await supabase.from('tenant_professionals').insert({
        tenant_id: currentTenant.id,
        name: pro.name,
        role: pro.role,
        phone: pro.phone,
        avatar_url: pro.avatar_url,
        active: pro.active,
      }).select().single();
      if (error) throw new Error(error.message);
      const created: Professional = {
        ...data,
        phone: data.phone ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
      };
      setAllProfessionals((prev) => [...prev, created]);
      return created;
    }
    const newPro: Professional = {
      ...pro,
      id: `pro-${Date.now()}`,
      tenant_id: currentTenant.id,
    };
    setAllProfessionals((prev) => [...prev, newPro]);
    return newPro;
  };

  const updateProfessional = async (proId: string, data: Partial<Professional>) => {
    const existing = allProfessionals.find((pro) => pro.id === proId);
    if (existing && isRemoteTenant(existing.tenant_id)) {
      const { error } = await supabase.from('tenant_professionals').update({
        name: data.name,
        role: data.role,
        phone: data.phone,
        avatar_url: data.avatar_url,
        active: data.active,
      }).eq('id', proId).select('id').single();
      if (error) throw new Error(error.message);
    }
    setAllProfessionals((prev) =>
      prev.map((p) => (p.id === proId ? { ...p, ...data } : p))
    );
  };

  const deleteProfessional = async (proId: string) => {
    const existing = allProfessionals.find((pro) => pro.id === proId);
    if (existing && isRemoteTenant(existing.tenant_id)) {
      const { error } = await supabase.from('tenant_professionals').delete().eq('id', proId).select('id').single();
      if (error) throw new Error(error.message);
    }
    setAllProfessionals((prev) => prev.filter((p) => p.id !== proId));
  };

  const getAvailableSlots = ({
    tenantId,
    date,
    serviceId,
    professionalId,
  }: {
    tenantId: string;
    date: Date;
    serviceId?: string;
    professionalId?: string;
  }) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return [];

    const baseSlots = generateSlots(tenant.settings, date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = new Date();

    const service = serviceId ? allServices.find((s) => s.id === serviceId) : null;
    const maxCap = service?.max_capacity || 1;

    // Filter appointments for this tenant and date
    const dayAppts = allAppointments.filter(
      (a) => a.tenant_id === tenantId && a.date === dateStr && a.status === 'active'
    );

    return baseSlots
      .filter((slot) => !isPastSlot(dateStr, slot, now))
      .map((slot) => {
        // Matching appointments for this slot
        const matchingAppts = dayAppts.filter((a) => {
          if (a.time !== slot) return false;
          // If a specific professional is selected
          if (professionalId && a.professional_id && a.professional_id !== professionalId) {
            return false;
          }
          // If gym class / service specific
          if (serviceId && a.service_id !== serviceId) {
            return false;
          }
          return true;
        });

        const bookedCount = matchingAppts.length;
        const remainingCapacity = Math.max(0, maxCap - bookedCount);

        return {
          time: slot,
          remainingCapacity,
        };
      })
      .filter((slot) => slot.remainingCapacity > 0);
  };

  const getRemoteAvailableSlots = useCallback(async ({
    tenantId,
    date,
    serviceId,
    maxCapacity,
    settings,
    professionalId,
  }: {
    tenantId: string;
    date: Date;
    serviceId: string;
    maxCapacity: number;
    settings: BusinessSettings;
    professionalId?: string;
  }) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data: occupiedTimes, error } = await supabase.rpc('get_tenant_occupied_slots', {
      _tenant_id: tenantId,
      _date: dateStr,
      _service_id: serviceId,
      _professional_id: professionalId ?? null,
    });
    if (error) throw new Error(error.message);

    const occupied = new Set(occupiedTimes ?? []);
    return generateSlots(settings, date)
      .filter((slot) => !isPastSlot(dateStr, slot, new Date()) && !occupied.has(slot))
      .map((time) => ({ time, remainingCapacity: maxCapacity }));
  }, []);

  const bookAppointment = async ({
    tenantId,
    serviceId,
    professionalId,
    professionalName,
    service: suppliedService,
    clientName,
    clientPhone,
    date,
    time,
  }: {
    tenantId: string;
    serviceId: string;
    professionalId?: string;
    professionalName?: string;
    service?: Service;
    clientName: string;
    clientPhone: string;
    date: string;
    time: string;
  }) => {
    const service = allServices.find((s) => s.id === serviceId) ?? suppliedService;
    if (!service) return { success: false, error: 'Serviço não encontrado' };

    if (isRemoteTenant(tenantId)) {
      const { data, error } = await supabase.rpc('book_tenant_appointment', {
        _tenant_id: tenantId,
        _service_id: serviceId,
        _professional_id: professionalId ?? null,
        _name: clientName.trim(),
        _phone: clientPhone,
        _service_name: service.name,
        _date: date,
        _time: time,
        _price: service.price,
      });
      if (error) return { success: false, error: error.message };
      const pro = allProfessionals.find((item) => item.id === professionalId);
      const appointment: Appointment = {
        id: data,
        tenant_id: tenantId,
        service_id: serviceId,
        service_name: service.name,
        professional_id: professionalId,
        professional_name: pro?.name ?? professionalName,
        client_name: clientName.trim(),
        client_phone: clientPhone.replace(/\D/g, ''),
        date,
        time,
        status: 'active',
        price: service.price,
        created_at: new Date().toISOString(),
      };
      return { success: true, appointment };
    }

    const maxCap = service.max_capacity || 1;
    const cleanPhone = clientPhone.replace(/\D/g, '');

    // Check capacity
    const existing = allAppointments.filter(
      (a) =>
        a.tenant_id === tenantId &&
        a.date === date &&
        a.time === time &&
        a.status === 'active' &&
        (maxCap > 1 ? a.service_id === serviceId : professionalId ? a.professional_id === professionalId : true)
    );

    if (existing.length >= maxCap) {
      return { success: false, error: 'Este horário acabou de ser preenchido por outro cliente.' };
    }

    const pro = professionalId ? allProfessionals.find((p) => p.id === professionalId) : undefined;

    const newAppt: Appointment = {
      id: `appt-${Date.now()}`,
      tenant_id: tenantId,
      service_id: serviceId,
      service_name: service.name,
      professional_id: pro?.id,
      professional_name: pro?.name,
      client_name: clientName.trim(),
      client_phone: cleanPhone,
      date,
      time,
      status: 'active',
      price: service.price,
      created_at: new Date().toISOString(),
    };

    setAllAppointments((prev) => [newAppt, ...prev]);
    return { success: true, appointment: newAppt };
  };

  const cancelAppointment = async (appointmentId: string) => {
    const appointment = allAppointments.find((item) => item.id === appointmentId);
    if (appointment && isRemoteTenant(appointment.tenant_id)) {
      const { error } = await supabase.rpc('update_tenant_appointment', {
        _appointment_id: appointmentId,
        _status: 'cancelled',
      });
      if (error) throw new Error(error.message);
    }
    setAllAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: 'cancelled' } : a))
    );
  };

  const rescheduleAppointment = async (appointmentId: string, date: string, time: string) => {
    const appt = allAppointments.find((a) => a.id === appointmentId);
    if (!appt) return { success: false, error: 'Agendamento não encontrado' };

    if (isRemoteTenant(appt.tenant_id)) {
      const { error } = await supabase.rpc('update_tenant_appointment', {
        _appointment_id: appointmentId,
        _date: date,
        _time: time,
      });
      if (error) return { success: false, error: error.message };
      setAllAppointments((prev) =>
        prev.map((item) => (item.id === appointmentId ? { ...item, date, time } : item))
      );
      return { success: true };
    }

    const service = allServices.find((s) => s.id === appt.service_id);
    const maxCap = service?.max_capacity || 1;

    // Check availability at new date/time
    const conflict = allAppointments.filter(
      (a) =>
        a.id !== appointmentId &&
        a.tenant_id === appt.tenant_id &&
        a.date === date &&
        a.time === time &&
        a.status === 'active' &&
        (maxCap > 1 ? a.service_id === appt.service_id : appt.professional_id ? a.professional_id === appt.professional_id : true)
    );

    if (conflict.length >= maxCap) {
      return { success: false, error: 'O novo horário escolhido já está lotado.' };
    }

    setAllAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, date, time } : a))
    );
    return { success: true };
  };

  const getTenantMetrics = (tenantId: string) => {
    const tenantAppts = allAppointments.filter((a) => a.tenant_id === tenantId);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const totalRevenue = tenantAppts
      .filter((a) => a.status !== 'cancelled')
      .reduce((sum, a) => sum + (a.price || 0), 0);

    const activeAppointmentsCount = tenantAppts.filter((a) => a.status === 'active').length;
    const todayAppointmentsCount = tenantAppts.filter((a) => a.date === todayStr && a.status === 'active').length;
    const completedCount = tenantAppts.filter((a) => a.status === 'completed').length;

    return {
      totalRevenue,
      activeAppointmentsCount,
      todayAppointmentsCount,
      completedCount,
    };
  };

  return (
    <SaasContext.Provider
      value={{
        tenants,
        currentTenant,
        workspaceLoading,
        workspaceError,
        setCurrentTenant,
        getTenantBySlug,
        loadPublicTenantPage,
        findPublicAppointments,
        changePublicAppointment,
        services: currentServices,
        professionals: currentProfessionals,
        appointments: currentAppointments,
        updateTenantSettings,
        updateTenantInfo,
        addService,
        updateService,
        deleteService,
        addProfessional,
        updateProfessional,
        deleteProfessional,
        bookAppointment,
        cancelAppointment,
        rescheduleAppointment,
        getAvailableSlots,
        getRemoteAvailableSlots,
        getTenantMetrics,
      }}
    >
      {children}
    </SaasContext.Provider>
  );
};

export const useSaas = () => {
  const context = useContext(SaasContext);
  if (!context) {
    throw new Error('useSaas must be used within a SaasProvider');
  }
  return context;
};
