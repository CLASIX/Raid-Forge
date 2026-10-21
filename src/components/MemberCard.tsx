import { RosterMember, DAYS, Day } from '../types';
import { CLASS_COLORS, CLASS_ICONS, ROLE_ICONS, ROLE_BG_COLORS } from '../utils/wowData';
import { Clock, Check } from 'lucide-react';

interface Props {
  member: RosterMember;
  onToggleSelect?: (id: string) => void;
  compact?: boolean;
  selected?: boolean;
  showAvailability?: boolean;
}

const DAY_LABELS: Record<Day, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export function MemberCard({ member, onToggleSelect, compact = false, selected = false, showAvailability = true }: Props) {
  const color = CLASS_COLORS[member.parsedClass];
  const roleStyle = ROLE_BG_COLORS[member.role];

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
          selected
            ? 'bg-yellow-900/40 border-yellow-500/70'
            : 'bg-gray-800/60 border-gray-700/50 hover:border-gray-500'
        }`}
        onClick={() => onToggleSelect?.(member.id)}
        style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
      >
        <span className="text-lg">{CLASS_ICONS[member.parsedClass]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{member.name}</p>
          <p className="text-xs truncate" style={{ color }}>{member.parsedSpec}</p>
        </div>
        <span className="text-xs">{ROLE_ICONS[member.role]}</span>
        {selected && <Check className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        selected
          ? 'border-yellow-500/80 bg-gray-800/80 shadow-lg shadow-yellow-900/20'
          : 'border-gray-700/60 bg-gray-800/50 hover:border-gray-500/60'
      }`}
      style={{ borderTopColor: color, borderTopWidth: '3px' }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{CLASS_ICONS[member.parsedClass]}</span>
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate">{member.name}</p>
              <p className="text-xs truncate font-medium" style={{ color }}>{member.parsedSpec}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleStyle}`}>
              {ROLE_ICONS[member.role]} {member.role}
            </span>
            {onToggleSelect && (
              <button
                onClick={() => onToggleSelect(member.id)}
                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  selected
                    ? 'bg-yellow-600 border-yellow-500 text-black'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {selected ? '✓ Selected' : '+ Select'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Availability */}
      {showAvailability && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1 mb-2">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Availability (EST)</span>
            {member.openAvailability && (
              <span className="ml-1 text-xs bg-green-900/40 text-green-400 border border-green-700/40 px-1.5 rounded-full">Open</span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => {
              const time = member.availability[day];
              const isOpen = time === 'Open' || member.openAvailability;
              const hasTime = time && time !== '';
              return (
                <div key={day} className="text-center">
                  <div className="text-xs text-gray-500 mb-0.5">{DAY_LABELS[day]}</div>
                  <div
                    className={`text-xs px-0.5 py-1 rounded text-center leading-none ${
                      isOpen
                        ? 'bg-green-900/50 text-green-300 border border-green-700/40'
                        : hasTime
                        ? 'bg-blue-900/50 text-blue-200 border border-blue-700/40'
                        : 'bg-gray-900/50 text-gray-600 border border-gray-700/30'
                    }`}
                  >
                    {isOpen ? '✓' : hasTime ? time : '–'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
