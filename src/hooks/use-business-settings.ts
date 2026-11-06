import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BusinessSettings, DEFAULT_SETTINGS } from '@/lib/slots';

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    supabase.from('business_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => data && setSettings(data as BusinessSettings));
  }, []);
  return settings;
};
