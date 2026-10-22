import { RosterMember, WowClass } from '../types';

/**
 * Buff and debuff coverage for vanilla-era comps.
 *
 * Data-driven on purpose: add, remove, or re-weight any entry here and both the
 * coverage panel and the auto-fill scoring follow. `preferredSpecs` are hints
 * only — coverage is decided by class, because imported specs are free text
 * ("Druid? (better be resto mf)") and matching on them would produce phantom
 * gaps that don't exist.
 */

export type BuffCategory = 'buff' | 'debuff';

export interface BuffDef {
  id: string;
  name: string;
  category: BuffCategory;
  /** Class that can bring it. */
  className: WowClass;
  /** Specs that bring it best — used to break ties in auto-fill, never to decide coverage. */
  preferredSpecs?: string[];
  /** How much an auto-fill should want this. Raid-wide buffs matter most. */
  weight: number;
}

export const BUFF_DEFS: BuffDef[] = [
  // ── Raid-wide buffs ────────────────────────────────────────────────────────
  { id: 'arcane-intellect', name: 'Arcane Intellect', category: 'buff', className: 'Mage', weight: 3 },
  { id: 'fortitude', name: 'Power Word: Fortitude', category: 'buff', className: 'Priest', weight: 3 },
  { id: 'divine-spirit', name: 'Divine Spirit', category: 'buff', className: 'Priest', weight: 2 },
  { id: 'shadow-protection', name: 'Shadow Protection', category: 'buff', className: 'Priest', weight: 2 },
  { id: 'mark-of-the-wild', name: 'Mark of the Wild', category: 'buff', className: 'Druid', weight: 3 },
  { id: 'blessing-of-kings', name: 'Blessing of Kings', category: 'buff', className: 'Paladin', preferredSpecs: ['protection', 'holy', 'retribution'], weight: 3 },
  { id: 'blessing-of-wisdom', name: 'Blessing of Wisdom', category: 'buff', className: 'Paladin', weight: 2 },
  { id: 'blessing-of-might', name: 'Blessing of Might', category: 'buff', className: 'Paladin', weight: 2 },
  { id: 'blessing-of-salvation', name: 'Blessing of Salvation', category: 'buff', className: 'Paladin', weight: 2 },
  { id: 'trueshot-aura', name: 'Trueshot Aura', category: 'buff', className: 'Hunter', preferredSpecs: ['marksmanship'], weight: 2 },
  { id: 'aspect-of-the-wild', name: 'Aspect of the Wild', category: 'buff', className: 'Hunter', weight: 2 },
  { id: 'battle-shout', name: 'Battle Shout', category: 'buff', className: 'Warrior', weight: 2 },
  { id: 'blood-pact', name: 'Blood Pact', category: 'buff', className: 'Warlock', weight: 2 },
  { id: 'mana-spring', name: 'Mana Spring Totem', category: 'buff', className: 'Shaman', weight: 2 },
  { id: 'strength-of-earth', name: 'Strength of Earth Totem', category: 'buff', className: 'Shaman', weight: 2 },
  { id: 'grace-of-air', name: 'Grace of Air Totem', category: 'buff', className: 'Shaman', weight: 2 },
  { id: 'leader-of-the-pack', name: "Leader of the Pack", category: 'buff', className: 'Druid', preferredSpecs: ['feral'], weight: 2 },
  { id: 'moonkin-aura', name: 'Moonkin Aura', category: 'buff', className: 'Druid', preferredSpecs: ['balance'], weight: 1 },

  // ── Debuffs on the target ──────────────────────────────────────────────────
  { id: 'sunder-armor', name: 'Sunder Armor', category: 'debuff', className: 'Warrior', weight: 2 },
  { id: 'faerie-fire', name: 'Faerie Fire', category: 'debuff', className: 'Druid', weight: 1 },
  { id: 'curse-of-elements', name: 'Curse of the Elements', category: 'debuff', className: 'Warlock', weight: 2 },
  { id: 'curse-of-shadow', name: 'Curse of Shadow', category: 'debuff', className: 'Warlock', weight: 2 },
  { id: 'winters-chill', name: "Winter's Chill", category: 'debuff', className: 'Mage', preferredSpecs: ['frost'], weight: 2 },
  { id: 'judgement-of-wisdom', name: 'Judgement of Wisdom', category: 'debuff', className: 'Paladin', weight: 1 },
  { id: 'thunder-clap', name: 'Thunder Clap', category: 'debuff', className: 'Warrior', weight: 1 },
];

export interface CoverageEntry {
  def: BuffDef;
  /** Members currently in the comp that can bring it. */
  providers: RosterMember[];
  covered: boolean;
}

export interface CoverageSummary {
  entries: CoverageEntry[];
  coveredCount: number;
  totalCount: number;
  /** Buffs only — the ones most worth fixing first. */
  missingBuffs: CoverageEntry[];
  missingDebuffs: CoverageEntry[];
}

/**
 * Which buffs/debuffs a single member brings.
 * Class decides coverage; `preferredSpecs` only affects auto-fill tie-breaks.
 */
export function buffsForMember(member: RosterMember, disabled?: Set<string>): BuffDef[] {
  if (member.parsedClass === 'Unknown') return [];
  return BUFF_DEFS.filter(
    (def) => def.className === member.parsedClass && !disabled?.has(def.id),
  );
}

/** Defs the user has switched on, in definition order. */
export function enabledDefs(disabled: Set<string>): BuffDef[] {
  return BUFF_DEFS.filter((def) => !disabled.has(def.id));
}

export function computeCoverage(
  compMembers: RosterMember[],
  disabled: Set<string> = new Set(),
): CoverageSummary {
  const entries: CoverageEntry[] = enabledDefs(disabled).map((def) => {
    const providers = compMembers.filter((member) => member.parsedClass === def.className);
    return { def, providers, covered: providers.length > 0 };
  });

  return {
    entries,
    coveredCount: entries.filter((entry) => entry.covered).length,
    totalCount: entries.length,
    missingBuffs: entries.filter((entry) => !entry.covered && entry.def.category === 'buff'),
    missingDebuffs: entries.filter((entry) => !entry.covered && entry.def.category === 'debuff'),
  };
}

/** True when the member's spec matches one of the buff's preferred hints. */
export function prefersSpecFor(def: BuffDef, member: RosterMember): boolean {
  if (!def.preferredSpecs || def.preferredSpecs.length === 0) return false;
  const spec = member.parsedSpec.toLowerCase();
  return def.preferredSpecs.some((hint) => spec.includes(hint));
}

/**
 * Weight of the buffs this member would newly cover, given what's already picked.
 * Used by auto-fill so it fills scarce utility before raw headcount.
 */
export function uncoveredValue(
  member: RosterMember,
  alreadyCovered: Set<string>,
  disabled: Set<string> = new Set(),
): number {
  return buffsForMember(member, disabled)
    .filter((def) => !alreadyCovered.has(def.id))
    .reduce((total, def) => {
      const specBonus = prefersSpecFor(def, member) ? 0.5 : 0;
      return total + def.weight + specBonus;
    }, 0);
}
