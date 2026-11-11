-- ==============================================================================
-- SEED LOCAL (apenas `supabase db reset`)
-- Usuário demo: demo@agendou.dev / demo1234
-- Tenant demo:  /agendar/demo-studio  e  /admin
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- Usuário de autenticação
-- ------------------------------------------------------------------------------
-- Atenção: o GoTrue lê confirmation_token/recovery_token/email_change* como
-- string (não aceita NULL). Por isso gravamos '' explicitamente.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'demo@agendou.dev',
  extensions.crypt('demo1234', extensions.gen_salt('bf')),
  now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Laryssa Resende"}'::jsonb,
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@agendou.dev","email_verified":true,"phone_verified":false}'::jsonb,
  'email', now(), now(), now()
)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- Tenant demo
-- ------------------------------------------------------------------------------
INSERT INTO public.tenants (
  id, slug, name, segment, phone, email, primary_color, site_style,
  bio, address, plan, subscription_status, trial_started_at, trial_ends_at
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'demo-studio', 'Studio Demo', 'salon', '11987654321', 'demo@agendou.dev',
  '#D4AF37', 'warm',
  'Estúdio de demonstração para testes locais.',
  'Rua Demo, 100 - Centro', 'pro', 'active', now(), now() + interval '365 days'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tenant_members (tenant_id, user_id, role)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'owner'
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.tenant_settings (
  tenant_id, open_time, close_time, lunch_start, lunch_end,
  service_minutes, slot_interval_minutes, open_weekdays
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '09:00', '19:00', '12:00', '13:30',
  60, 30, ARRAY[1, 2, 3, 4, 5, 6]
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.tenant_services (
  id, tenant_id, name, description, duration_minutes, price, max_capacity, active, sort_order
)
VALUES
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333333',
   'Manicure', 'Cuidado completo das mãos.', 60, 80.00, 1, true, 1),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333333',
   'Pedicure', 'Cuidado completo dos pés.', 60, 70.00, 1, true, 2),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333333',
   'Alongamento em fibra', 'Alongamento com fibra de vidro.', 120, 180.00, 1, true, 3)
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.tenant_professionals (
  id, tenant_id, name, role, phone, active
)
VALUES (
  '55555555-5555-4555-8555-555555555551',
  '33333333-3333-4333-8333-333333333333',
  'Laryssa Resende', 'Especialista', '11987654321', true
)
ON CONFLICT (tenant_id, id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- Agendamentos de exemplo (o trigger popula tenant_clients automaticamente)
-- Usa o fuso de São Paulo, igual às regras de booking.
-- ------------------------------------------------------------------------------
INSERT INTO public.tenant_appointments (
  id, tenant_id, service_id, professional_id, service_name, professional_name,
  client_name, phone, date, time, status, price
)
VALUES
  ('66666666-6666-4666-8666-666666666661', '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444441', '55555555-5555-4555-8555-555555555551',
   'Manicure', 'Laryssa Resende', 'Ana Souza', '11999998888',
   (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1, '10:00', 'active', 80.00),
  ('66666666-6666-4666-8666-666666666662', '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444442', '55555555-5555-4555-8555-555555555551',
   'Pedicure', 'Laryssa Resende', 'Bruna Lima', '11999997777',
   (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1, '14:00', 'active', 70.00)
ON CONFLICT (id) DO NOTHING;
