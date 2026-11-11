create table public.business_settings (
  id int primary key default 1 check (id = 1),
  open_time text not null default '09:00',
  close_time text not null default '18:00',
  lunch_start text default '12:00',
  lunch_end text default '13:30',
  service_minutes int not null default 60,
  slot_interval_minutes int not null default 60,
  open_weekdays int[] not null default '{1,2,3,4,5,6}',
  updated_at timestamptz not null default now()
);
grant select on public.business_settings to anon, authenticated;
grant update on public.business_settings to authenticated;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
create policy "public read settings" on public.business_settings for select using (true);
create policy "admin update settings" on public.business_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.business_settings (id) values (1);