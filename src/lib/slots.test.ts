// @ts-expect-error bun test runner types
import { describe, expect, it } from 'bun:test';
import { generateSlots, DEFAULT_SETTINGS } from './slots';

const monday = new Date(2026, 10, 9);
const sunday = new Date(2026, 10, 8);

describe('generateSlots', () => {
  it('default: 60 min every 60 min, skipping lunch 12:00-13:30', () => {
    expect(generateSlots(DEFAULT_SETTINGS, monday)).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
  });
  it('closed weekday returns no slots', () => {
    expect(generateSlots(DEFAULT_SETTINGS, sunday)).toEqual([]);
  });
  it('appointment must end by closing time', () => {
    const s = { ...DEFAULT_SETTINGS, open_time: '16:00', close_time: '18:00', lunch_start: null, lunch_end: null, service_minutes: 40, slot_interval_minutes: 40 };
    expect(generateSlots(s, monday)).toEqual(['16:00', '16:40', '17:20']);
  });
});

import { canClientChange } from './slots';
describe('canClientChange (2-hour rule)', () => {
  const now = new Date(2026, 10, 9, 10, 0);
  it('allows exactly 2 hours before', () => expect(canClientChange('2026-11-09', '12:00', now)).toBe(true));
  it('blocks 1h59 before', () => expect(canClientChange('2026-11-09', '11:59', now)).toBe(false));
});
