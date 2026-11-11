CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  phone text NOT NULL,
  service text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX appointments_unique_active_slot ON public.appointments(date, time) WHERE status = 'active';
CREATE INDEX appointments_phone_idx ON public.appointments(phone);

CREATE OR REPLACE FUNCTION public.get_occupied_times(_date date)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select coalesce(array_agg(time), '{}') from public.appointments where date=_date and status='active'
$$;

CREATE OR REPLACE FUNCTION public.book_appointment(_name text, _phone text, _service text, _date date, _time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare _id uuid; _p text := regexp_replace(_phone,'\D','','g');
begin
  if length(trim(_name)) < 2 or length(_p) < 10 or _date < (now() at time zone 'America/Maceio')::date then
    raise exception 'invalid';
  end if;
  insert into public.appointments(client_name, phone, service, date, time)
  values (left(trim(_name),100), _p, left(_service,100), _date, _time) returning id into _id;
  return _id;
exception when unique_violation then raise exception 'slot_taken';
end $$;

CREATE OR REPLACE FUNCTION public.find_my_appointment(_phone text)
RETURNS TABLE(id uuid, client_name text, service text, date date, "time" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select a.id, a.client_name, a.service, a.date, a.time from public.appointments a
  where a.phone = regexp_replace(_phone,'\D','','g') and a.status='active'
    and (a.date + a.time::time) > (now() at time zone 'America/Maceio')
  order by a.date, a.time limit 1
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(_id uuid, _phone text, _date date, _time text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=_id and phone=regexp_replace(_phone,'\D','','g') and status='active';
  if not found then raise exception 'not_found'; end if;
  if (a.date + a.time::time) - (now() at time zone 'America/Maceio') < interval '2 hours' then raise exception 'too_late'; end if;
  if _date < (now() at time zone 'America/Maceio')::date then raise exception 'invalid'; end if;
  update public.appointments set date=_date, time=_time where id=_id;
exception when unique_violation then raise exception 'slot_taken';
end $$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(_id uuid, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=_id and phone=regexp_replace(_phone,'\D','','g') and status='active';
  if not found then raise exception 'not_found'; end if;
  if (a.date + a.time::time) - (now() at time zone 'America/Maceio') < interval '2 hours' then raise exception 'too_late'; end if;
  update public.appointments set status='cancelled' where id=_id;
end $$;

GRANT EXECUTE ON FUNCTION public.get_occupied_times(date), public.book_appointment(text,text,text,date,text),
  public.find_my_appointment(text), public.reschedule_appointment(uuid,text,date,text), public.cancel_appointment(uuid,text) TO anon, authenticated;