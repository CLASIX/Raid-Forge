import { Day, RaidCompSelection, RosterMember } from '../types';
import { getAvailabilityForSlot } from './availability';
import { buffsForMember, prefersSpecFor } from './buffs';

/**
 * Buff-aware auto-fill.
 *
 * The old fill was `pool.slice(0, count)`: it took the first N in sort order, so
 * it would hand you five warriors and no shaman. This fills each role by a score
 * that rewards bringing *uncovered* buffs first, then class diversity, then
 * availability quality, and prefers the spec that actually brings the buff.
 *
 * Pure and deterministic (ties broken by id) so it can be tested directly.
 */

export interface AutoFillInput {
  members: RosterMember[];
  requirements: { tanks: number; healers: number; dps: number };
  day: Day;
  time: string;
  excludedIds: string[];
  /** Buffs the user switched off; ignored when scoring so they can't skew picks. */
  disabledBuffIds?: string[];
}

/** Higher is better: exact match > open availability > within an hour. */
function availabilityScore(member: RosterMember, day: Day, time: string): number {
  const result = getAvailabilityForSlot(member, day, time);
  switch (result.status) {
    case 'exact':
      return 3;
    case 'open':
      return 2.5;
    case 'within1hr':
      return 1.5;
    default:
      return 0;
  }
}

export function autoBuildComp({
  members,
  requirements,
  day,
  time,
  excludedIds,
  disabledBuffIds = [],
}: AutoFillInput): RaidCompSelection {
  const excluded = new Set(excludedIds);
  const disabledBuffs = new Set(disabledBuffIds);

  // Only players who are actually available for this window are eligible — same
  // rule the candidate lists use.
  const pool = members.filter(
    (member) => !excluded.has(member.id) && getAvailabilityForSlot(member, day, time).available,
  );

  const covered = new Set<string>();
  const taken = new Set<string>();
  const classCounts = new Map<string, number>();
  const comp: RaidCompSelection = { tanks: [], healers: [], dps: [] };

  const scoreOf = (member: RosterMember): number => {
    const newBuffs = buffsForMember(member, disabledBuffs).filter((def) => !covered.has(def.id));
    const buffValue = newBuffs.reduce(
      (total, def) => total + def.weight + (prefersSpecFor(def, member) ? 0.5 : 0),
      0,
    );

    // Coverage saturates: once every buff a class brings is covered, a pure buff
    // score leaves candidates tied and the tie-break would stack one class (six
    // druids, no shaman). Reward classes not yet in the comp, penalise repeats.
    const alreadyOfClass = classCounts.get(member.parsedClass) ?? 0;
    const diversity = alreadyOfClass === 0 ? 3 : -0.75 * alreadyOfClass;

    // Buffs dominate headcount: 10x weight, so covering a missing shaman totem
    // beats a marginally better availability match.
    return buffValue * 10 + diversity + availabilityScore(member, day, time);
  };

  const fillRole = (role: RosterMember['role'], slot: keyof RaidCompSelection, needed: number) => {
    for (let slotIndex = 0; slotIndex < needed; slotIndex++) {
      const candidates = pool.filter((member) => member.role === role && !taken.has(member.id));
      if (candidates.length === 0) break;

      // Re-scored every iteration: `covered` and `classCounts` change with each
      // pick, and scoring once up front would let six paladins each claim to
      // bring all four blessings.
      const best = candidates
        .map((member) => ({ member, score: scoreOf(member) }))
        .sort((a, b) => b.score - a.score || a.member.id.localeCompare(b.member.id))[0];

      comp[slot].push(best.member.id);
      taken.add(best.member.id);
      buffsForMember(best.member, disabledBuffs).forEach((def) => covered.add(def.id));
      classCounts.set(best.member.parsedClass, (classCounts.get(best.member.parsedClass) ?? 0) + 1);
    }
  };

  fillRole('Tank', 'tanks', requirements.tanks);
  fillRole('Healer', 'healers', requirements.healers);
  fillRole('DPS', 'dps', requirements.dps);

  return comp;
}
