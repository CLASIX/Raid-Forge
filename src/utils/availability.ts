import { Day, RosterMember, TIME_SLOTS } from '../types';

/**
 * A player is considered "available" for a time slot if:
 *   - They have full-week open availability, OR
 *   - That specific day is marked "Open", OR
 *   - The slot is within 1 hour of their preferred time for that day
 *     (e.g. preferred 9pm → available at 8pm, 9pm, and 10pm; NOT 7pm or 11pm)
 *
 * They are NOT available if:
 *   - They have no listing for that day
 *   - The slot is more than 1 hour before or after their preferred time
 *   - Their listed time can't be recognised (then only an exact string
 *     match counts as available)
 *
 * Listed times are parsed leniently: "9pm", "9PM", "9 pm", "9:00 PM",
 * "9:00:00 PM" and 24-hour values like "21:00" all resolve to the 9pm slot.
 */

export type AvailabilityStatus = 'open' | 'exact' | 'within1hr' | 'tooEarly' | 'tooLate' | 'unavailable';

const NORMALIZED_TIME_MAP = new Map(TIME_SLOTS.map((slot, index) => [slot.toLowerCase(), index]));

export function getTimeIndex(time: string): number {
  const raw = String(time ?? '').toLowerCase().trim();
  if (!raw) return -1;

  const direct = NORMALIZED_TIME_MAP.get(raw);
  if (direct !== undefined) return direct;

  const compact = raw.replace(/\s+/g, '');

  // "9 pm", "9:00 pm", "9:00:00 pm" (spreadsheets often store form times
  // as real time values instead of the original "9pm" text)
  const meridiem = compact.match(/^(\d{1,2})(?::\d{2}){0,2}(am|pm)$/);
  if (meridiem) {
    const hour = Number(meridiem[1]);
    if (hour >= 1 && hour <= 12) {
      return NORMALIZED_TIME_MAP.get(`${hour}${meridiem[2]}`) ?? -1;
    }
    return -1;
  }

  // 24-hour clock: "21:00", "21:00:00", "0:00"
  const military = compact.match(/^([01]?\d|2[0-3])(?::\d{2}){1,2}$/);
  if (military) {
    const hour = Number(military[1]);
    const label = hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`;
    return NORMALIZED_TIME_MAP.get(label) ?? -1;
  }

  return -1;
}

export function isOpenValue(value: string): boolean {
  return String(value ?? '').toLowerCase().trim() === 'open';
}

export function getDayValue(member: RosterMember, day: Day): string {
  return member.availability[day] ?? '';
}

export function getAvailabilityForSlot(member: RosterMember, day: Day, targetTime: string) {
  const dayValue = getDayValue(member, day);

  // Full-week open or day marked Open
  if (member.openAvailability || isOpenValue(dayValue)) {
    return {
      available: true,
      status: 'open' as AvailabilityStatus,
      score: 92,
      label: 'Open availability',
      shortLabel: 'Open',
      dayValue: dayValue || 'Open',
    };
  }

  // No listing for this day
  if (!dayValue) {
    return {
      available: false,
      status: 'unavailable' as AvailabilityStatus,
      score: -999,
      label: 'Not listed for this day',
      shortLabel: 'Not listed',
      dayValue: '',
    };
  }

  const targetIndex = getTimeIndex(targetTime);
  const playerIndex = getTimeIndex(dayValue);

  // Unrecognised time format — fall back to string comparison
  if (targetIndex === -1 || playerIndex === -1) {
    const exact = dayValue.toLowerCase().trim() === targetTime.toLowerCase().trim();
    return {
      available: exact,
      status: exact ? ('exact' as AvailabilityStatus) : ('unavailable' as AvailabilityStatus),
      score: exact ? 100 : -999,
      label: exact ? `Prefers ${dayValue}` : `Listed ${dayValue}`,
      shortLabel: dayValue,
      dayValue,
    };
  }

  // Exact match
  if (playerIndex === targetIndex) {
    return {
      available: true,
      status: 'exact' as AvailabilityStatus,
      score: 100,
      label: `Prefers ${dayValue} ✓`,
      shortLabel: dayValue,
      dayValue,
    };
  }

  // Target is AFTER player's preferred time
  // e.g. player prefers 7pm, target is 8pm → delta = 1 → within window
  // e.g. player prefers 7pm, target is 9pm → delta = 2 → too late, they'd have been waiting 2hrs
  if (targetIndex > playerIndex) {
    const delta = targetIndex - playerIndex;
    if (delta <= 1) {
      return {
        available: true,
        status: 'within1hr' as AvailabilityStatus,
        score: 90,
        label: `Prefers ${dayValue}, within 1hr of ${targetTime}`,
        shortLabel: `Prefers ${dayValue}`,
        dayValue,
      };
    }
    // More than 1hr after their preference — too late for them
    return {
      available: false,
      status: 'tooLate' as AvailabilityStatus,
      score: -100 - delta,
      label: `Prefers ${dayValue} — ${delta}hrs before ${targetTime}`,
      shortLabel: `Prefers ${dayValue}`,
      dayValue,
    };
  }

  // Target is BEFORE player's preferred time
  // e.g. player prefers 9pm, target is 7pm → they can't start that early
  // BUT if target is only 1hr before (player 9pm, target 8pm → delta=1) they'd arrive 1hr late
  const delta = playerIndex - targetIndex;
  if (delta <= 1) {
    return {
      available: true,
      status: 'within1hr' as AvailabilityStatus,
      score: 85,
      label: `Prefers ${dayValue}, 1hr after ${targetTime}`,
      shortLabel: `Prefers ${dayValue}`,
      dayValue,
    };
  }
  return {
    available: false,
    status: 'tooEarly' as AvailabilityStatus,
    score: -50 - delta,
    label: `Prefers ${dayValue} — ${delta}hrs after ${targetTime}`,
    shortLabel: `Prefers ${dayValue}`,
    dayValue,
  };
}

export function countWindowAvailability(members: RosterMember[], day: Day, time: string) {
  let total = 0;
  let tanks = 0;
  let healers = 0;
  let dps = 0;

  for (const member of members) {
    const availability = getAvailabilityForSlot(member, day, time);
    if (!availability.available) continue;
    total += 1;
    if (member.role === 'Tank') tanks += 1;
    if (member.role === 'Healer') healers += 1;
    if (member.role === 'DPS') dps += 1;
  }

  return { total, tanks, healers, dps };
}

export function sortMembersForWindow(members: RosterMember[], day: Day, time: string) {
  return [...members].sort((a, b) => {
    const aAvailability = getAvailabilityForSlot(a, day, time);
    const bAvailability = getAvailabilityForSlot(b, day, time);

    if (bAvailability.score !== aAvailability.score) {
      return bAvailability.score - aAvailability.score;
    }

    return a.name.localeCompare(b.name);
  });
}
