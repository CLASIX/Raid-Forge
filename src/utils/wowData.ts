import { WowClass, Role } from '../types';

export const CLASS_COLORS: Record<WowClass, string> = {
  Warrior: '#C79C6E',
  Paladin: '#F58CBA',
  Hunter: '#ABD473',
  Rogue: '#FFF569',
  Priest: '#FFFFFF',
  Shaman: '#0070DE',
  Mage: '#69CCF0',
  Warlock: '#9482C9',
  Druid: '#FF7D0A',
  Unknown: '#888888',
};

export const CLASS_BG_COLORS: Record<WowClass, string> = {
  Warrior: 'bg-[#C79C6E] text-black',
  Paladin: 'bg-[#F58CBA] text-black',
  Hunter: 'bg-[#ABD473] text-black',
  Rogue: 'bg-[#FFF569] text-black',
  Priest: 'bg-white text-black border border-gray-300',
  Shaman: 'bg-[#0070DE] text-white',
  Mage: 'bg-[#69CCF0] text-black',
  Warlock: 'bg-[#9482C9] text-white',
  Druid: 'bg-[#FF7D0A] text-white',
  Unknown: 'bg-gray-500 text-white',
};

export const CLASS_TEXT_COLORS: Record<WowClass, string> = {
  Warrior: 'text-[#C79C6E]',
  Paladin: 'text-[#F58CBA]',
  Hunter: 'text-[#ABD473]',
  Rogue: 'text-[#FFF569]',
  Priest: 'text-white',
  Shaman: 'text-[#0070DE]',
  Mage: 'text-[#69CCF0]',
  Warlock: 'text-[#9482C9]',
  Druid: 'text-[#FF7D0A]',
  Unknown: 'text-gray-400',
};

export const CLASS_ICONS: Record<WowClass, string> = {
  Warrior: '⚔️',
  Paladin: '🛡️',
  Hunter: '🏹',
  Rogue: '🗡️',
  Priest: '✨',
  Shaman: '⚡',
  Mage: '🔮',
  Warlock: '💀',
  Druid: '🌿',
  Unknown: '❓',
};

export const SPEC_TO_CLASS: Record<string, WowClass> = {
  // Warrior
  'arms': 'Warrior',
  'fury': 'Warrior',
  'fury warrior': 'Warrior',
  'arms warrior': 'Warrior',
  'protection warrior': 'Warrior',
  'prot warrior': 'Warrior',
  'warrior': 'Warrior',

  // Paladin
  'holy paladin': 'Paladin',
  'protection paladin': 'Paladin',
  'prot paladin': 'Paladin',
  'retribution paladin': 'Paladin',
  'ret paladin': 'Paladin',
  'paladin': 'Paladin',
  'pally': 'Paladin',

  // Hunter
  'beast mastery': 'Hunter',
  'marksmanship': 'Hunter',
  'survival': 'Hunter',
  'hunter': 'Hunter',

  // Rogue
  'assassination rogue': 'Rogue',
  'assasination rogue': 'Rogue',
  'combat rogue': 'Rogue',
  'subtlety rogue': 'Rogue',
  'rogue': 'Rogue',

  // Priest
  'holy priest': 'Priest',
  'holy preist': 'Priest',
  'discipline priest': 'Priest',
  'disc priest': 'Priest',
  'shadow priest': 'Priest',
  'priest': 'Priest',

  // Shaman
  'elemental shaman': 'Shaman',
  'enhancement shaman': 'Shaman',
  'shaman enhancement': 'Shaman',
  'restoration shaman': 'Shaman',
  'resto shaman': 'Shaman',
  'shaman': 'Shaman',

  // Mage
  'arcane mage': 'Mage',
  'fire mage': 'Mage',
  'frost mage': 'Mage',
  'mage': 'Mage',

  // Warlock
  'affliction warlock': 'Warlock',
  'demonology warlock': 'Warlock',
  'destruction warlock': 'Warlock',
  'warlock': 'Warlock',

  // Druid
  'feral druid': 'Druid',
  'restoration druid': 'Druid',
  'resto druid': 'Druid',
  'balance druid': 'Druid',
  'druid': 'Druid',
};

export const SPEC_TO_ROLE: Record<string, Role> = {
  // Tanks
  'protection warrior': 'Tank',
  'prot warrior': 'Tank',
  'protection paladin': 'Tank',
  'prot paladin': 'Tank',

  // Healers
  'holy priest': 'Healer',
  'holy preist': 'Healer',
  'discipline priest': 'Healer',
  'disc priest': 'Healer',
  'holy paladin': 'Healer',
  'restoration druid': 'Healer',
  'resto druid': 'Healer',
  'restoration shaman': 'Healer',
  'resto shaman': 'Healer',

  // DPS
  'affliction warlock': 'DPS',
  'demonology warlock': 'DPS',
  'destruction warlock': 'DPS',
  'arcane mage': 'DPS',
  'fire mage': 'DPS',
  'frost mage': 'DPS',
  'arms warrior': 'DPS',
  'fury warrior': 'DPS',
  'assassination rogue': 'DPS',
  'assasination rogue': 'DPS',
  'combat rogue': 'DPS',
  'subtlety rogue': 'DPS',
  'beast mastery': 'DPS',
  'marksmanship': 'DPS',
  'survival': 'DPS',
  'hunter': 'DPS',
  'elemental shaman': 'DPS',
  'enhancement shaman': 'DPS',
  'shaman enhancement': 'DPS',
  'retribution paladin': 'DPS',
  'ret paladin': 'DPS',
  'balance druid': 'DPS',
  'feral druid': 'DPS',
  'shadow priest': 'DPS',
};

export function parseClassFromSpec(specClass: string): WowClass {
  const lower = specClass.toLowerCase().trim();

  // Direct lookup
  for (const [key, cls] of Object.entries(SPEC_TO_CLASS)) {
    if (lower.includes(key)) return cls;
  }

  // Check for class names anywhere in string
  const classes: [string, WowClass][] = [
    ['warrior', 'Warrior'],
    ['paladin', 'Paladin'],
    ['pally', 'Paladin'],
    ['hunter', 'Hunter'],
    ['rogue', 'Rogue'],
    ['priest', 'Priest'],
    ['shaman', 'Shaman'],
    ['mage', 'Mage'],
    ['warlock', 'Warlock'],
    ['druid', 'Druid'],
  ];

  for (const [keyword, cls] of classes) {
    if (lower.includes(keyword)) return cls;
  }

  return 'Unknown';
}

export function parseRoleFromSpec(specClass: string): Role {
  const lower = specClass.toLowerCase().trim();

  for (const [key, role] of Object.entries(SPEC_TO_ROLE)) {
    if (lower.includes(key)) return role;
  }

  // Fallback heuristics
  if (lower.includes('prot') || lower.includes('protection') || lower.includes('tank')) return 'Tank';
  if (lower.includes('holy') || lower.includes('resto') || lower.includes('restoration') || lower.includes('disc') || lower.includes('healer')) return 'Healer';
  if (lower.includes('fury') || lower.includes('arms') || lower.includes('shadow') || lower.includes('affliction') ||
    lower.includes('arcane') || lower.includes('frost') || lower.includes('fire') || lower.includes('balance') ||
    lower.includes('feral') || lower.includes('assassination') || lower.includes('assasination') ||
    lower.includes('enhancement') || lower.includes('elemental') || lower.includes('ret') || lower.includes('retribution')) return 'DPS';

  return 'Unknown';
}

export function parseSpec(specClass: string): string {
  // Extract just the spec name cleanly
  const lower = specClass.toLowerCase().trim();
  const classes = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];

  for (const cls of classes) {
    if (lower.includes(cls)) {
      // Try to extract spec
      const parts = specClass.split(/[\s,\/]+/);
      const clsIndex = parts.findIndex(p => p.toLowerCase() === cls);
      if (clsIndex > 0) {
        return parts.slice(0, clsIndex).join(' ');
      }
      if (clsIndex === 0 && parts.length > 1) {
        return parts.slice(1).join(' ');
      }
      return specClass;
    }
  }
  return specClass;
}

export const ROLE_COLORS: Record<Role, string> = {
  Tank: 'text-blue-400',
  Healer: 'text-green-400',
  DPS: 'text-red-400',
  Unknown: 'text-gray-400',
};

export const ROLE_BG_COLORS: Record<Role, string> = {
  Tank: 'bg-blue-900/50 border-blue-500/50 text-blue-200',
  Healer: 'bg-green-900/50 border-green-500/50 text-green-200',
  DPS: 'bg-red-900/50 border-red-500/50 text-red-200',
  Unknown: 'bg-gray-800/50 border-gray-600/50 text-gray-400',
};

export const ROLE_ICONS: Record<Role, string> = {
  Tank: '🛡️',
  Healer: '💚',
  DPS: '⚔️',
  Unknown: '❓',
};

// WoW classic raid comp requirements
export const RAID_COMP_REQUIREMENTS: Record<number, { tanks: number; healers: number; dps: number }> = {
  10: { tanks: 2, healers: 2, dps: 6 },
  20: { tanks: 3, healers: 4, dps: 13 },
  40: { tanks: 4, healers: 8, dps: 28 },
};
