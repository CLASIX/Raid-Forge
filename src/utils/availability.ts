import { Day, RosterMember, TIME_SLOTS } from '../types';

/**
 * A player is considered "available" for a time slot if:
 *   - They have full-week open availability, OR
 *   - That specific day is marked "Open", OR
 *   - The slot is their exact preferred time, OR
 *   - The slot is up to 1 hour AFTER their preferred time
 *     (e.g. preferred 8pm → available at 8pm and 9pm, NOT 10pm)
 *
 * They are NOT available if:
 *   - The slot is BEFORE their preferred time (they can't start earlier than they said)
 *   - The slot is more than 1 hour after their preferred time
 *   - They have no listing for that day
 */

export type AvailabilityStatus = 'open' | 'exact' | 'within1hr' | 'tooEarly' | 'tooLate' | 'unavailable';

const NORMALIZED_TIME_MAP = new Map(TIME_SLOTS.map((slot, index) => [slot.toLowerCase(), index]));

export function getTimeIndex(time: string): number {
  if (!time) return -1;
  return NORMALIZED_TIME_MAP.get(time.toLowerCase().trim()) ?? -1;
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
