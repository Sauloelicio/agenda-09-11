import { supabase } from '@/integrations/supabase/client';

export const TENANT_LOGO_BUCKET = 'tenant-logos';
export const TENANT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const TENANT_LOGO_MAX_LABEL = '2 MB';
export const TENANT_LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const validateTenantLogo = (file: File): string | null => {
  if (!MIME_EXTENSIONS[file.type]) {
    return 'Formato inválido. Envie uma imagem PNG, JPG ou WebP.';
  }
  if (file.size > TENANT_LOGO_MAX_BYTES) {
    return `A imagem deve ter no máximo ${TENANT_LOGO_MAX_LABEL}.`;
  }
  return null;
};

export const tenantLogoPathFromUrl = (logoUrl: string | null | undefined): string | null => {
  if (!logoUrl) return null;
  const marker = `/object/public/${TENANT_LOGO_BUCKET}/`;
  const markerIndex = logoUrl.indexOf(marker);
  if (markerIndex === -1) return null;
  const path = logoUrl.slice(markerIndex + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
};

export const uploadTenantLogo = async (tenantId: string, file: File): Promise<string> => {
  const validationError = validateTenantLogo(file);
  if (validationError) throw new Error(validationError);

  const extension = MIME_EXTENSIONS[file.type];
  const path = `${tenantId}/logo-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(TENANT_LOGO_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(TENANT_LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteTenantLogoByUrl = async (logoUrl: string | null | undefined): Promise<void> => {
  const path = tenantLogoPathFromUrl(logoUrl);
  if (!path) return;

  const { error } = await supabase.storage.from(TENANT_LOGO_BUCKET).remove([path]);
  if (error) {
    // A logo nova já está salva; arquivos órfãos não devem interromper o fluxo.
    console.warn('Unable to remove previous tenant logo:', error.message);
  }
};
