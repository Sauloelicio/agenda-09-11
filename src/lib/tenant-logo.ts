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

export type LogoErrorStage = 'upload' | 'database' | 'cleanup';

interface LogoErrorDetails {
  message?: string;
  status?: number;
  statusCode?: number;
  code?: string;
}

const FRIENDLY_LOGO_ERRORS: Array<[RegExp, string]> = [
  [/bucket not found/i, 'O armazenamento de logos não está configurado. Tente novamente mais tarde.'],
  [/row-level security|rls|permission|not authorized/i, 'Você não tem permissão para enviar a logo deste estabelecimento.'],
  [/exceeded.*size|maximum allowed size|entity too large/i, 'A imagem ultrapassa o limite de 2 MB.'],
  [/mime|unsupported media|invalid format/i, 'Formato inválido. Use PNG, JPG ou WebP.'],
  [/jwt|token|unauthorized|expired/i, 'Sua sessão expirou. Entre novamente e tente outra vez.'],
];

export const getLogoErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  const friendly = FRIENDLY_LOGO_ERRORS.find(([pattern]) => pattern.test(raw));
  return friendly ? friendly[1] : raw || 'Não foi possível concluir a operação. Tente novamente.';
};

export const reportLogoFailure = (
  stage: LogoErrorStage,
  error: unknown,
  context: { tenantId: string; file?: File },
): void => {
  const details = (error ?? {}) as LogoErrorDetails;
  console.error('[tenant-logo] falha', {
    stage,
    tenantId: context.tenantId,
    fileSize: context.file?.size,
    mimeType: context.file?.type,
    message: details.message ?? getLogoErrorMessage(error),
    status: details.status ?? details.statusCode,
    code: details.code,
    at: new Date().toISOString(),
  });
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
