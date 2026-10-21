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
