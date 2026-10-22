export type RaidSize = 10 | 20 | 40;

export type WowClass =
  | 'Warrior'
  | 'Paladin'
  | 'Hunter'
  | 'Rogue'
  | 'Priest'
  | 'Shaman'
  | 'Mage'
  | 'Warlock'
  | 'Druid'
  | 'Unknown';

export type Role = 'Tank' | 'Healer' | 'DPS' | 'Unknown';

export interface RosterMember {
  id: string;
  timestamp: string;
  name: string;
  specClass: string;
  parsedClass: WowClass;
  parsedSpec: string;
  role: Role;
  openAvailability: boolean;
  availability: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  selected: boolean;
  note?: string;
}

export interface RaidComp {
  tanks: RosterMember[];
  healers: RosterMember[];
  dps: RosterMember[];
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Day = typeof DAYS[number];

export const TIME_SLOTS = [
  '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm',
  '6pm', '7pm', '8pm', '9pm', '10pm', '11pm', '12am', '1am', '2am'
];

/**
 * Raid windows you can actually pick: 10am through midnight (12am).
 *
 * Sliced out of TIME_SLOTS instead of written out again, so the Raid Builder
 * dropdown and the "Best Raid Windows" ranking always offer the same slots —
 * and every option is guaranteed to be one the availability engine understands.
 * Change the range here and both follow.
 */
export const RAID_TIME_OPTIONS: string[] = TIME_SLOTS.slice(
  TIME_SLOTS.indexOf('10am'),
  TIME_SLOTS.indexOf('12am') + 1,
);

/**
 * Member ids in each raid slot. Ids rather than full members so the comp
 * survives a re-import: members are looked up at render time, and ids that no
 * longer exist are dropped instead of showing stale data.
 */
export interface RaidCompSelection {
  tanks: string[];
  healers: string[];
  dps: string[];
}

/**
 * Everything the Raid Builder tab lets you change. Persisted alongside the
 * roster so a refresh doesn't throw away a comp you just spent ten minutes on.
 */
export interface BuilderState {
  day: Day;
  time: string;
  comp: RaidCompSelection;
  /** Stored as an array, not a Set, so it survives JSON round-tripping. */
  excludedIds: string[];
}

export const DEFAULT_BUILDER_STATE: BuilderState = {
  day: 'tuesday',
  time: '8pm',
  comp: { tanks: [], healers: [], dps: [] },
  excludedIds: [],
};

/**
 * A comp saved under a name, so Tuesday's 20-man and Saturday's side comp can
 * both live in the browser instead of living in your head.
 */
export interface SavedComp {
  id: string;
  name: string;
  raidSize: RaidSize;
  builder: BuilderState;
  savedAt: string;
}

/**
 * User preferences that aren't tied to one comp.
 * `disabledBuffIds` lets you hide buffs Forever doesn't have, without a code change.
 */
export interface Preferences {
  disabledBuffIds: string[];
  /** Whether the buff coverage panel starts collapsed. */
  buffPanelCollapsed: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  disabledBuffIds: [],
  buffPanelCollapsed: false,
};
