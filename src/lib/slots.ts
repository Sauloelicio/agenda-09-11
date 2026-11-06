export type BusinessSettings = {
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  service_minutes: number;
  slot_interval_minutes: number;
  open_weekdays: number[];
};

export const DEFAULT_SETTINGS: BusinessSettings = {
  open_time: '09:00',
  close_time: '18:00',
  lunch_start: '12:00',
  lunch_end: '13:30',
  service_minutes: 60,
  slot_interval_minutes: 60,
  open_weekdays: [1, 2, 3, 4, 5, 6],
};

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toTime = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export const generateSlots = (s: BusinessSettings, date: Date): string[] => {
  if (!s.open_weekdays.includes(date.getDay())) return [];
  const open = toMin(s.open_time);
  const close = toMin(s.close_time);
  const step = Math.max(5, s.slot_interval_minutes);
  const dur = Math.max(5, s.service_minutes);
  const ls = s.lunch_start ? toMin(s.lunch_start) : null;
  const le = s.lunch_end ? toMin(s.lunch_end) : null;
  const out: string[] = [];
  for (let t = open; t + dur <= close; t += step) {
    if (ls !== null && le !== null && t < le && t + dur > ls) continue;
    out.push(toTime(t));
  }
  return out;
};

const slotDate = (date: string, time: string) => new Date(`${date}T${time}:00`);

/** True when the slot already started. */
export const isPastSlot = (date: string, time: string, now: Date) => slotDate(date, time) <= now;

/** Clients may reschedule/cancel only up to 2 hours before the appointment. */
export const canClientChange = (date: string, time: string, now: Date) =>
  slotDate(date, time).getTime() - now.getTime() >= 2 * 60 * 60 * 1000;
