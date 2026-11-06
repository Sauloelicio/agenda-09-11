import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { generateSlots, isPastSlot } from '@/lib/slots';
import { useBusinessSettings } from './use-business-settings';

/** Free time slots for a date: booked ones are hidden entirely. */
export const useAvailableTimes = (date: Date | undefined, keep?: string) => {
  const settings = useBusinessSettings();
  const [occupied, setOccupied] = useState<string[]>([]);
  const key = date ? format(date, 'yyyy-MM-dd') : '';

  const refresh = useCallback(async () => {
    if (!key) return setOccupied([]);
    const { data } = await supabase.rpc('get_occupied_times', { _date: key });
    setOccupied((data as string[]) || []);
  }, [key]);

  useEffect(() => { refresh(); }, [refresh]);

  const times = date
    ? generateSlots(settings, date).filter((t) => t === keep || (!occupied.includes(t) && !isPastSlot(key, t, new Date())))
    : [];
  return { times, refresh, settings };
};
