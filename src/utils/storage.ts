import { Day, DAYS, RaidSize, Role, RosterMember, WowClass } from '../types';

/**
 * Local persistence for the roster.
 *
 * The app is a single-user tool, so the roster lives in this browser's
 * localStorage rather than a database. Everything here is defensive: storage can
 * be unavailable (Safari private mode, blocked cookies, disabled site data), full
 * (quota exceeded), or hold data written by an older/corrupted version. None of
 * those should leave the user staring at a blank page.
 */

const STORAGE_KEY = 'raid-forge:roster';
const BACKUP_KEY_PREFIX = 'raid-forge:roster:unreadable:';
const SNAPSHOT_VERSION = 1;

export interface RosterSnapshot {
  version: number;
  savedAt: string;
  raidSize: RaidSize;
  importSource: string;
  members: RosterMember[];
}

export type SaveStatus =
  | { state: 'saved'; savedAt: string }
  | { state: 'unsaved'; reason: string }
  | { state: 'unavailable'; reason: string };

const ROLES: Role[] = ['Tank', 'Healer', 'DPS', 'Unknown'];
const CLASSES: WowClass[] = [
  'Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest',
  'Shaman', 'Mage', 'Warlock', 'Druid', 'Unknown',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Coerces one stored member back into a RosterMember. Returns null when the
 * record is too damaged to be useful (no id or no name), so a single bad row
 * can't take the whole roster down.
 */
function reviveMember(raw: unknown): RosterMember | null {
  if (!isRecord(raw)) return null;

  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) return null;

  const rawAvailability = isRecord(raw.availability) ? raw.availability : {};
  const availability = DAYS.reduce((acc, day) => {
    acc[day] = asString(rawAvailability[day]);
    return acc;
  }, {} as Record<Day, string>);

  const rawRole = asString(raw.role, 'Unknown') as Role;
  const rawClass = asString(raw.parsedClass, 'Unknown') as WowClass;

  return {
    id,
    name,
    timestamp: asString(raw.timestamp),
    specClass: asString(raw.specClass, asString(raw.parsedSpec)),
    parsedClass: CLASSES.includes(rawClass) ? rawClass : 'Unknown',
    parsedSpec: asString(raw.parsedSpec),
    role: ROLES.includes(rawRole) ? rawRole : 'Unknown',
    openAvailability: raw.openAvailability === true,
    availability,
    selected: raw.selected === true,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

function reviveRaidSize(value: unknown): RaidSize {
  return value === 10 || value === 20 || value === 40 ? value : 20;
}

/**
 * Reads the saved roster. Returns null when there is nothing usable stored —
 * the caller then falls back to the built-in sample roster.
 */
export function loadSnapshot(): RosterSnapshot | null {
  let text: string | null = null;

  try {
    text = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage access is blocked entirely; treat it as a first visit.
    return null;
  }

  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || !Array.isArray(parsed.members)) return null;

    const members = parsed.members
      .map(reviveMember)
      .filter((member): member is RosterMember => member !== null);

    // Nothing survived: keep the damaged blob aside for debugging instead of
    // silently overwriting it on the next save.
    if (members.length === 0 && parsed.members.length > 0) {
      try {
        window.localStorage.setItem(`${BACKUP_KEY_PREFIX}${Date.now()}`, text);
      } catch {
        /* best effort only */
      }
      return null;
    }

    return {
      version: typeof parsed.version === 'number' ? parsed.version : 0,
      savedAt: asString(parsed.savedAt),
      raidSize: reviveRaidSize(parsed.raidSize),
      importSource: asString(parsed.importSource, 'Saved roster'),
      members,
    };
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: Omit<RosterSnapshot, 'version' | 'savedAt'>): SaveStatus {
  const payload: RosterSnapshot = {
    ...snapshot,
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { state: 'saved', savedAt: payload.savedAt };
  } catch (error) {
    // QuotaExceededError is the common one; private mode throws a SecurityError
    // on some browsers. Check the name rather than the constructor — engines
    // don't all surface the same class for storage failures.
    const name = error instanceof Error ? error.name : '';
    const quotaExceeded =
      name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';

    return {
      state: quotaExceeded ? 'unsaved' : 'unavailable',
      reason: quotaExceeded
        ? 'Browser storage is full — export a backup to avoid losing this roster.'
        : 'This browser is blocking local storage, so changes will not survive a reload.',
    };
  }
}

export function clearSnapshot(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Downloads the current roster as a JSON backup file. */
export function downloadBackup(snapshot: Omit<RosterSnapshot, 'version' | 'savedAt'>): void {
  const payload: RosterSnapshot = {
    ...snapshot,
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
  };

  const stamp = payload.savedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `raid-forge-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Reads a backup produced by downloadBackup. Returns null if it isn't valid. */
export async function readBackupFile(file: File): Promise<RosterSnapshot | null> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isRecord(parsed) || !Array.isArray(parsed.members)) return null;

    const members = parsed.members
      .map(reviveMember)
      .filter((member): member is RosterMember => member !== null);

    if (members.length === 0) return null;

    return {
      version: typeof parsed.version === 'number' ? parsed.version : 0,
      savedAt: asString(parsed.savedAt),
      raidSize: reviveRaidSize(parsed.raidSize),
      importSource: asString(parsed.importSource, `Restored ${file.name}`),
      members,
    };
  } catch {
    return null;
  }
}

export function formatSavedAt(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const secondsAgo = Math.round((Date.now() - date.getTime()) / 1000);
  if (secondsAgo < 10) return 'just now';
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
