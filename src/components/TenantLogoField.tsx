import React, { useRef } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  TENANT_LOGO_ACCEPT,
  TENANT_LOGO_MAX_LABEL,
  validateTenantLogo,
} from '@/lib/tenant-logo';

interface TenantLogoFieldProps {
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  busy?: boolean;
  description?: string;
}

export const TenantLogoField = ({
  previewUrl,
  onSelect,
  onRemove,
  disabled = false,
  busy = false,
  description,
}: TenantLogoFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateTenantLogo(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    onSelect(file);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">Logo do estabelecimento</Label>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background sm:h-28 sm:w-28">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Prévia da logo"
              className="h-full w-full object-contain p-1 sm:p-1.5"
              decoding="async"
            />
          ) : (
            <ImagePlus className="h-7 w-7 text-muted-foreground sm:h-8 sm:w-8" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {previewUrl ? 'Substituir' : 'Enviar logo'}
            </Button>

            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={disabled || busy}
                onClick={onRemove}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remover
              </Button>
            )}
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            {description ?? `PNG, JPG ou WebP · até ${TENANT_LOGO_MAX_LABEL} · recomendado 512×512 px ou maior, com fundo transparente. Logos horizontais também são aceitas.`}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TENANT_LOGO_ACCEPT}
        className="sr-only"
        disabled={disabled || busy}
        onChange={handleFileChange}
      />
    </div>
  );
};
