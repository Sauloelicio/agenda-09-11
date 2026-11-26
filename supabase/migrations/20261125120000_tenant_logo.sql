-- ==============================================================================
-- Logo do estabelecimento
--   * bucket público `tenant-logos` (leitura pela página de agendamento)
--   * escrita restrita aos membros do tenant dono da pasta
--   * `get_public_tenant_page` passa a devolver `logo_url`
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública: a URL pública é usada por clientes não autenticados.
DROP POLICY IF EXISTS "tenant logos read" ON storage.objects;
CREATE POLICY "tenant logos read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tenant-logos');

-- Escrita: somente membros do tenant indicado na primeira pasta do caminho.
DROP POLICY IF EXISTS "tenant logos insert" ON storage.objects;
CREATE POLICY "tenant logos insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid)
    AND public.tenant_has_access(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "tenant logos update" ON storage.objects;
CREATE POLICY "tenant logos update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid)
    AND public.tenant_has_access(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid)
    AND public.tenant_has_access(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "tenant logos delete" ON storage.objects;
CREATE POLICY "tenant logos delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid)
    AND public.tenant_has_access(((storage.foldername(name))[1])::uuid)
  );

CREATE OR REPLACE FUNCTION public.get_public_tenant_page(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT jsonb_build_object(
    'tenant', jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'name', t.name, 'segment', t.segment,
    'phone', t.phone, 'logo_url', t.logo_url,
    'primary_color', t.primary_color, 'site_style', t.site_style,
    'bio', t.bio, 'address', t.address,
    'created_at', t.created_at
    ),
    'settings', to_jsonb(s),
    'services', COALESCE((
      SELECT jsonb_agg(to_jsonb(sv) - 'tenant_id' ORDER BY sv.sort_order)
      FROM public.tenant_services sv
      WHERE sv.tenant_id = t.id AND sv.active
    ), '[]'::jsonb),
    'professionals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'tenant_id', p.tenant_id, 'name', p.name,
        'role', p.role, 'avatar_url', p.avatar_url, 'active', p.active
      ) ORDER BY p.name)
      FROM public.tenant_professionals p
      WHERE p.tenant_id = t.id AND p.active
    ), '[]'::jsonb),
    'can_book', public.tenant_public_booking_enabled(t.id)
  )
  FROM public.tenants t
  JOIN public.tenant_settings s ON s.tenant_id = t.id
  WHERE t.slug = lower(trim(_slug))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_tenant_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_page(text) TO anon, authenticated;
