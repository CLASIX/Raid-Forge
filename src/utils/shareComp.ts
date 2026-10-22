import {
  BuilderState,
  Day,
  RaidCompSelection,
  RaidSize,
  RosterMember,
} from '../types';

/**
 * Formats a raid comp as Discord-ready text.
 *
 * Kept pure (no DOM, no clipboard) so it can be tested directly and reused for
 * any future export format. Discord accepts `**bold**` markdown and renders
 * emoji, so the output is written to paste straight into a channel.
 */

const DAY_LABELS: Record<Day, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const SLOT_META = [
  { key: 'tanks', label: 'Tanks', singular: 'Tank', emoji: '🛡️', requiredKey: 'tanks' },
  { key: 'healers', label: 'Healers', singular: 'Healer', emoji: '💚', requiredKey: 'healers' },
  { key: 'dps', label: 'DPS', singular: 'DPS', emoji: '⚔️', requiredKey: 'dps' },
] as const;

export interface ShareCompInput {
  members: RosterMember[];
  comp: RaidCompSelection;
  excludedIds: string[];
  day: Day;
  time: string;
  raidSize: RaidSize;
  requirements: { tanks: number; healers: number; dps: number };
}

/**
 * "Ghroga — Protection" — spec only when we know it.
 *
 * A dash rather than parentheses because imported specs are free text and often
 * contain their own parentheses (e.g. "Druid? (better be resto)"), which would
 * nest badly.
 */
function label(member: RosterMember): string {
  const spec = member.parsedSpec?.trim();
  return spec && spec !== 'Unknown' ? `${member.name} — ${spec}` : member.name;
}

export function buildDiscordText({
  members,
  comp,
  excludedIds,
  day,
  time,
  raidSize,
  requirements,
}: ShareCompInput): string {
  const byId = new Map(members.map((member) => [member.id, member]));
  const resolve = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((member): member is RosterMember => Boolean(member));

  const filled = SLOT_META.reduce((total, slot) => total + resolve(comp[slot.key]).length, 0);
  const lines: string[] = [
    `**${DAY_LABELS[day]} @ ${time} EST — ${raidSize} Man** (${filled}/${raidSize})`,
  ];

  const shortages: string[] = [];

  for (const slot of SLOT_META) {
    const picked = resolve(comp[slot.key]);
    const required = requirements[slot.requiredKey];
    lines.push('', `${slot.emoji} **${slot.label} (${picked.length}/${required})**`);
    lines.push(picked.length === 0 ? '_none yet_' : picked.map((m) => `• ${label(m)}`).join('\n'));

    const missing = required - picked.length;
    if (missing > 0) shortages.push(`${missing} ${missing === 1 ? slot.singular : slot.label}`);
  }

  if (shortages.length > 0) {
    lines.push('', `**Still needed:** ${shortages.join(', ')}`);
  }

  const benched = resolve(excludedIds);
  if (benched.length > 0) {
    lines.push('', `**Sitting out (${benched.length}):** ${benched.map((m) => m.name).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Copies text to the clipboard.
 *
 * Tries the async Clipboard API first and falls back to a hidden textarea +
 * `execCommand`. The fallback matters in practice: the Clipboard API is blocked
 * in cross-origin iframes and in some non-HTTPS contexts, where it rejects
 * rather than being unavailable — exactly the situations a preview embed hits.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

/** Convenience wrapper so components don't need to rebuild the input shape. */
export function discordTextFrom(
  members: RosterMember[],
  raidSize: RaidSize,
  builder: BuilderState,
  requirements: { tanks: number; healers: number; dps: number },
): string {
  return buildDiscordText({
    members,
    comp: builder.comp,
    excludedIds: builder.excludedIds,
    day: builder.day,
    time: builder.time,
    raidSize,
    requirements,
  });
}
