import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Day, DAYS, RosterMember } from '../types';
import { parseClassFromSpec, parseRoleFromSpec } from './wowData';

export interface ImportResult {
  members: RosterMember[];
  sourceLabel: string;
}

type RowObject = Record<string, unknown>;

type ColumnMap = {
  timestamp?: string;
  name?: string;
  spec?: string;
  openAvailability?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
};

const DAY_HEADER_MAP: Record<Day, string[]> = {
  monday: ['monday', 'mon'],
  tuesday: ['tuesday', 'tue'],
  wednesday: ['wednesday', 'wed'],
  thursday: ['thursday', 'thu', 'thur', 'thurs'],
  friday: ['friday', 'fri'],
  saturday: ['saturday', 'sat'],
  sunday: ['sunday', 'sun'],
};

export async function parseRosterFile(file: File): Promise<ImportResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.ods')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const candidates = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
      }) as string[][];

      const cleanedRows = rows
        .map((row) => row.map((cell) => String(cell ?? '').trim()))
        .filter((row) => row.some((cell) => cell !== ''));

      const headerIndex = findBestHeaderRowIndex(cleanedRows);
      const headerScore = headerIndex >= 0 ? getHeaderScore(cleanedRows[headerIndex]) : 0;
      const members = parseRowsWithOptionalHeader(cleanedRows, headerIndex);
      const normalizedSheet = normalizeSheetName(sheetName);

      return {
        sheetName,
        normalizedSheet,
        headerScore,
        members,
      };
    });

    const exactFormResponses = candidates.find((candidate) =>
      candidate.normalizedSheet === 'form responses 1' && candidate.members.length > 0
    );

    const chosen = exactFormResponses
      ?? [...candidates].sort((a, b) => {
        if (b.headerScore !== a.headerScore) return b.headerScore - a.headerScore;
        if (b.members.length !== a.members.length) return b.members.length - a.members.length;
        const aResponseLike = Number(a.normalizedSheet.includes('form responses') || a.normalizedSheet.includes('responses'));
        const bResponseLike = Number(b.normalizedSheet.includes('form responses') || b.normalizedSheet.includes('responses'));
        return bResponseLike - aResponseLike;
      })[0];

    return {
      members: chosen?.members ?? [],
      sourceLabel: `${file.name} [${chosen?.sheetName ?? workbook.SheetNames[0] ?? 'Unknown Sheet'}]`,
    };
  }

  const text = await file.text();

  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return {
      members: parseHTMLRoster(text),
      sourceLabel: file.name,
    };
  }

  if (lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
    return {
      members: parseDelimitedText(text, '\t'),
      sourceLabel: file.name,
    };
  }

  return {
    members: parseRosterText(text),
    sourceLabel: file.name,
  };
}

export function parseRosterText(raw: string): RosterMember[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('<') && trimmed.toLowerCase().includes('<table')) {
    return parseHTMLRoster(trimmed);
  }

  const delimiter = detectDelimiter(trimmed);
  return parseDelimitedText(trimmed, delimiter);
}

function parseDelimitedText(raw: string, delimiter: string): RosterMember[] {
  const parsed = Papa.parse<string[]>(raw, {
    delimiter,
    skipEmptyLines: 'greedy',
  });

  const rows = parsed.data
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell !== ''));

  return parseRowsWithOptionalHeader(rows, findBestHeaderRowIndex(rows));
}

function parseHTMLRoster(html: string): RosterMember[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll('tr'))
    .map((tr) => Array.from(tr.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').trim()))
    .filter((row) => row.some((cell) => cell !== ''));

  return parseRowsWithOptionalHeader(rows, findBestHeaderRowIndex(rows));
}

function parseRowsWithOptionalHeader(rows: string[][], headerIndex: number): RosterMember[] {
  if (rows.length === 0) return [];

  if (headerIndex >= 0) {
    const headerRow = rows[headerIndex].map((cell) => String(cell ?? '').trim());
    const objects = rows.slice(headerIndex + 1).map((row) => rowToObject(headerRow, row));
    const members = rowsToMembers(objects);
    if (members.length > 0) return members;

    // A header row was detected but its columns weren't recognised. Fall back to
    // positional parsing using ONLY the data rows — never the header row itself,
    // otherwise the header turns into a phantom roster member (e.g. a "member"
    // named "Name" with availability "Monday"/"Tuesday").
    return positionalRowsToMembers(rows.slice(headerIndex + 1));
  }

  return positionalRowsToMembers(rows);
}

function findBestHeaderRowIndex(rows: string[][]): number {
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = getHeaderScore(rows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 3 ? bestIndex : -1;
}

function getHeaderScore(row: string[]): number {
  const normalized = row.map(normalizeHeader);
  let score = 0;

  if (normalized.some((cell) => cell.includes('timestamp'))) score += 2;
  if (normalized.some((cell) => cell.includes('discord') || cell.includes('character name') || cell.includes('player name') || cell === 'name')) score += 2;
  if (normalized.some((cell) => (cell.includes('spec') && cell.includes('class')) || cell === 'spec' || cell === 'class')) score += 3;
  if (normalized.some((cell) => cell.includes('open availability'))) score += 1;
  for (const day of DAYS) {
    // Exact keyword matches only ("monday", "mon", …) so data cells like
    // "SunnyLifton" (contains "sun") can't inflate a data row's score.
    if (normalized.some((cell) => DAY_HEADER_MAP[day].includes(cell))) {
      score += day === 'monday' ? 2 : 1;
    }
  }

  return score;
}

function rowsToMembers(rows: RowObject[]): RosterMember[] {
  if (rows.length === 0) return [];

  const columnMap = detectColumns(rows[0]);
  if (!columnMap.spec || !columnMap.name) return [];

  return rows
    .map((row) => objectRowToMember(row, columnMap))
    .filter((member): member is RosterMember => member !== null);
}

function positionalRowsToMembers(rows: string[][]): RosterMember[] {
  return rows
    .map((fields) => positionalRowToMember(fields))
    .filter((member): member is RosterMember => member !== null);
}

function detectColumns(row: RowObject): ColumnMap {
  const headers = Object.keys(row);
  const map: ColumnMap = {};

  for (const header of headers) {
    const normalized = normalizeHeader(header);

    if (!map.timestamp && normalized.includes('timestamp')) map.timestamp = header;
    if (
      !map.name &&
      (normalized.includes('discord') ||
        normalized.includes('character name') ||
        normalized.includes('player name') ||
        normalized === 'character' ||
        normalized.includes('name'))
    ) {
      map.name = header;
    }
    // Accept "Class / Spec", "Spec", "Class", "Main Spec", … — anything that
    // looks like the class/spec column. Previously BOTH words were required,
    // so common headers like "Class" or "Spec" silently disabled header-based
    // parsing and fell back to positional columns, which misassigns the
    // Monday–Sunday values when the sheet's column order differs.
    if (!map.spec && (normalized.includes('spec') || normalized.includes('class'))) map.spec = header;
    if (!map.openAvailability && normalized.includes('open availability')) map.openAvailability = header;

    for (const day of DAYS) {
      if (!map[day] && DAY_HEADER_MAP[day].some((keyword) => normalized === keyword || normalized.includes(keyword))) {
        map[day] = header;
      }
    }
  }

  return map;
}

function objectRowToMember(row: RowObject, columnMap: ColumnMap): RosterMember | null {
  const timestamp = getString(row, columnMap.timestamp);
  const name = getString(row, columnMap.name);
  const specClass = getString(row, columnMap.spec);
  const openAvailText = getString(row, columnMap.openAvailability);

  if (!timestamp && !name && !specClass) return null;

  const rawDayValues = {
    monday: getString(row, columnMap.monday),
    tuesday: getString(row, columnMap.tuesday),
    wednesday: getString(row, columnMap.wednesday),
    thursday: getString(row, columnMap.thursday),
    friday: getString(row, columnMap.friday),
    saturday: getString(row, columnMap.saturday),
    sunday: getString(row, columnMap.sunday),
  };

  return buildMember({
    timestamp,
    name,
    specClass,
    openAvailText,
    rawDayValues,
  });
}

function positionalRowToMember(fields: string[]): RosterMember | null {
  if (fields.length < 3) return null;

  const timestamp = String(fields[0] ?? '').trim();
  const name = String(fields[1] ?? '').trim();
  const specClass = String(fields[2] ?? '').trim();
  const openAvailText = String(fields[4] ?? '').trim();

  if (!timestamp && !name && !specClass) return null;

  return buildMember({
    timestamp,
    name,
    specClass,
    openAvailText,
    rawDayValues: {
      monday: String(fields[5] ?? '').trim(),
      tuesday: String(fields[6] ?? '').trim(),
      wednesday: String(fields[7] ?? '').trim(),
      thursday: String(fields[8] ?? '').trim(),
      friday: String(fields[9] ?? '').trim(),
      saturday: String(fields[10] ?? '').trim(),
      sunday: String(fields[11] ?? '').trim(),
    },
  });
}

function buildMember({
  timestamp,
  name,
  specClass,
  openAvailText,
  rawDayValues,
}: {
  timestamp: string;
  name: string;
  specClass: string;
  openAvailText: string;
  rawDayValues: Record<Day, string>;
}): RosterMember | null {
  if (!name && !specClass) return null;

  const hasOpenAvail = isOpenAvailability(openAvailText);

  const availability = {
    monday: normalizeTime(rawDayValues.monday, hasOpenAvail),
    tuesday: normalizeTime(rawDayValues.tuesday, hasOpenAvail),
    wednesday: normalizeTime(rawDayValues.wednesday, hasOpenAvail),
    thursday: normalizeTime(rawDayValues.thursday, hasOpenAvail),
    friday: normalizeTime(rawDayValues.friday, hasOpenAvail),
    saturday: normalizeTime(rawDayValues.saturday, hasOpenAvail),
    sunday: normalizeTime(rawDayValues.sunday, hasOpenAvail),
  };

  return {
    id: `${name || 'Unknown'}-${timestamp || Math.random().toString(36).slice(2)}`,
    timestamp,
    name: name || 'Unknown',
    specClass,
    parsedClass: parseClassFromSpec(specClass),
    parsedSpec: specClass,
    role: parseRoleFromSpec(specClass),
    openAvailability: hasOpenAvail,
    availability,
    selected: false,
  };
}

function normalizeTime(val: string, globalOpen: boolean): string {
  if (!val && globalOpen) return 'Open';
  if (!val) return '';

  const clean = String(val).replace(/\s+/g, ' ').trim();
  if (!clean) return globalOpen ? 'Open' : '';
  if (isOpenAvailability(clean)) return 'Open';

  return clean;
}

function isOpenAvailability(value: string): boolean {
  const lower = String(value ?? '').toLowerCase().trim();
  if (!lower) return false;

  // Negative answers are NOT open availability. Without this guard, free-text
  // answers like "No, I don't have open availability" matched the positive
  // check and made the player show as available on every day of the week.
  if (/^(no\b|n\/a\b|none\b|not\b)/.test(lower)) return false;
  if (/\b(don't|do not|doesn't|does not|not really)\b/.test(lower)) return false;

  return lower.includes('open availability') || lower.includes('completely open') || lower === 'open';
}

function normalizeHeader(header: string): string {
  return String(header ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?*]/g, '')
    .trim();
}

function normalizeSheetName(sheetName: string): string {
  return String(sheetName ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getString(row: RowObject, key?: string): string {
  if (!key) return '';
  return String(row[key] ?? '').trim();
}

function rowToObject(headers: string[], row: string[]): RowObject {
  const obj: RowObject = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? '';
  });
  return obj;
}

function detectDelimiter(raw: string): string {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  return tabCount > commaCount ? '\t' : ',';
}

export const DEFAULT_CSV = `10/15/2026 14:11:35,Clasix,Affliction Warlock,I understand that the following raid times are in EST,,9pm,9pm,9pm,9pm,9pm,9pm,9pm
10/16/2026 22:47:23,evinge,Affliction warlock,I understand that the following raid times are in EST,,6pm,6pm,6pm,6pm,6pm,6pm,6pm
10/15/2026 14:35:42,witchcraf77,Arcane Mage,I understand that the following raid times are in EST,,7pm,7pm,,,4pm,1pm,1pm
10/19/2026 12:43:08,MajorDickWinters,Assasination Rogue,I understand that the following raid times are in EST,,,,,,,Open Availability,Open Availability
10/16/2026 21:53:46,ImJunior,Discipline Priest,I understand that the following raid times are in EST,,,,,,9pm,Open Availability,Open Availability
10/20/2026 15:22:00,brkdwn,Discipline Priest,I understand that the following raid times are in EST,I have completely open availability.,,,,,,,
10/20/2026 23:51:42,captonize,Druid? (better be resto mf - Clasix),I understand that the following raid times are in EST,,,,,,8pm,6pm,8pm
10/15/2026 14:10:45,Shredarator,Feral Druid,I understand that the following raid times are in EST,,,,,,,,
10/15/2026 21:56:10,Mufazl,Frost Mage,I understand that the following raid times are in EST,,12am,12am,12am,12am,12am,Open Availability,Open Availability
10/20/2026 14:07:52,Derek,Frost Mage/Fire for ice dungeon,I understand that the following raid times are in EST,I have completely open availability.,,,,,,,
10/15/2026 14:39:05,Aries,Fury Warrior,I understand that the following raid times are in EST,,9pm,9pm,9pm,9pm,9pm,9pm,
10/17/2026 23:01:02,wraith1867,Fury Warrior,I understand that the following raid times are in EST,,9pm,Open Availability,Open Availability,9pm,9pm,9pm,9pm
10/16/2026 22:49:08,peeweelea69,Fury Warrior - (Fury added by Clasix as a guess),I understand that the following raid times are in EST,,10pm,10pm,10pm,5pm,5pm,,
10/20/2026 23:22:19,rodolfoki,Holy Paladin,I understand that the following raid times are in EST,,,2pm,2pm,9pm,9pm,7pm,7pm
10/21/2026 11:39:15,paps1023,Holy Paladin,I understand that the following raid times are in EST,,,,,,,Open Availability,Open Availability
10/15/2026 21:56:36,Carott,Holy Priest,I understand that the following raid times are in EST,,7pm,7pm,7pm,7pm,7pm,Open Availability,Open Availability
10/19/2026 16:27:28,Nearly,Holy Priest,I understand that the following raid times are in EST,,6pm,6pm,6pm,6pm,6pm,10am,10am
10/21/2026 11:56:44,SullaFelix42,Holy Priest,I understand that the following raid times are in EST,I have completely open availability.,,,,,,,
10/16/2026 15:10:22,Aeldron,Holy Priest / Discipline,I understand that the following raid times are in EST,,6pm,6pm,6pm,6pm,6pm,6pm,6pm
10/17/2026 11:55:33,megarises,Hunter - whichever spec does the most damage,I understand that the following raid times are in EST,,9pm,9pm,9pm,9pm,8pm,Open Availability,Open Availability
10/20/2026 23:33:44,Ruba,Not Sure,I understand that the following raid times are in EST,,7pm,7pm,7pm,7pm,7pm,2pm,2pm
10/15/2026 15:18:42,Reck,"Pally, Rogue or Hunter",I understand that the following raid times are in EST,,Open Availability,Open Availability,Open Availability,,,,
10/15/2026 14:20:07,rogerdodger,Protection Paladin,I understand that the following raid times are in EST,,7pm,7pm,7pm,7pm,7pm,2pm,3pm
10/16/2026 19:08:43,JustJorden ,Protection Paladin,I understand that the following raid times are in EST,,11am,,,,11am,12pm,
10/16/2026 19:18:23,wyldbob,Protection Paladin,I understand that the following raid times are in EST,,,,,,7pm,Open Availability,Open Availability
10/15/2026 14:43:33,OnlyHalfSavage,Protection Warrior,I understand that the following raid times are in EST,,6pm,6pm,,6pm,6pm,5pm,5pm
10/15/2026 18:12:28,C,Protection Warrior,I understand that the following raid times are in EST,,8pm,8pm,8pm,8pm,,,8pm
10/15/2026 22:05:37,Davinlevey,Protection Warrior,I understand that the following raid times are in EST,I have completely open availability.,Open Availability,Open Availability,Open Availability,Open Availability,Open Availability,Open Availability,Open Availability
10/19/2026 18:42:32,Medici,Restoration Druid,I understand that the following raid times are in EST,I have completely open availability.,7pm,7pm,7pm,7pm,7pm,7pm,7pm
10/19/2026 19:28:59,SunnyLifton,Restoration Druid,I understand that the following raid times are in EST,I have completely open availability.,,,,,,,
10/19/2026 0:38:34,Roofio,Restoration Shaman,I understand that the following raid times are in EST,,7pm,7pm,7pm,7pm,7pm,7pm,7pm
10/19/2026 19:18:33,Ghroga,Retribution Paladin,I understand that the following raid times are in EST,,5pm,5pm,5pm,5pm,5pm,12pm,12pm
10/19/2026 11:09:57,Tinker,Enhancement Shaman,I understand that the following raid times are in EST,,9pm,9pm,9pm,9pm,9pm,9pm,9pm`;
