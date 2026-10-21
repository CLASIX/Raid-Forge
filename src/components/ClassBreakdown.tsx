import { useState } from 'react';
import { RosterMember, WowClass } from '../types';
import { CLASS_COLORS, CLASS_ICONS, ROLE_ICONS } from '../utils/wowData';
import { MemberDetailModal } from './MemberDetailModal';

interface Props {
  members: RosterMember[];
  onUpdateMember: (member: RosterMember) => void;
}

export function ClassBreakdown({ members, onUpdateMember }: Props) {
  const [selectedMember, setSelectedMember] = useState<RosterMember | null>(null);

  const byClass: Record<string, RosterMember[]> = {};
  for (const m of members) {
    const cls = m.parsedClass;
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push(m);
  }

  const tanks = members.filter(m => m.role === 'Tank');
  const healers = members.filter(m => m.role === 'Healer');
  const dps = members.filter(m => m.role === 'DPS');
  const unknown = members.filter(m => m.role === 'Unknown');

  const sortedClasses = Object.entries(byClass).sort((a, b) => b[1].length - a[1].length);

  const MemberBadge = ({ m }: { m: RosterMember }) => {
    const color = CLASS_COLORS[m.parsedClass];
    return (
      <button
        onClick={() => setSelectedMember(m)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:border-yellow-500/60 hover:bg-yellow-900/10 transition-all text-left w-full group"
        style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
      >
        <span className="text-base">{CLASS_ICONS[m.parsedClass]}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white truncate">{m.name}</div>
          <div className="text-xs truncate" style={{ color }}>{m.parsedSpec}</div>
        </div>
        <span className="text-xs opacity-0 group-hover:opacity-100 text-yellow-400 transition-opacity">Edit</span>
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={onUpdateMember}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tanks', icon: '🛡️', members: tanks, border: 'border-blue-500/40', bg: 'bg-blue-900/20', textColor: 'text-blue-300', numColor: 'text-blue-200' },
          { label: 'Healers', icon: '💚', members: healers, border: 'border-green-500/40', bg: 'bg-green-900/20', textColor: 'text-green-300', numColor: 'text-green-200' },
          { label: 'DPS', icon: '⚔️', members: dps, border: 'border-red-500/40', bg: 'bg-red-900/20', textColor: 'text-red-300', numColor: 'text-red-200' },
          { label: 'Unknown Role', icon: '❓', members: unknown, border: 'border-gray-600/40', bg: 'bg-gray-800/20', textColor: 'text-gray-400', numColor: 'text-gray-300' },
        ].map(({ label, icon, members: group, border, bg, textColor, numColor }) => (
          <div key={label} className={`rounded-xl border ${border} ${bg} p-4 text-center`}>
            <div className="text-3xl mb-1">{icon}</div>
            <div className={`text-4xl font-black ${numColor}`}>{group.length}</div>
            <div className={`text-xs font-semibold mt-1 ${textColor}`}>{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-4 bg-yellow-500 rounded" />
            Class Distribution
          </h3>
          <div className="space-y-3">
            {sortedClasses.map(([cls, clsMembers]) => {
              const color = CLASS_COLORS[cls as WowClass];
              const icon = CLASS_ICONS[cls as WowClass];
              const pct = Math.round((clsMembers.length / members.length) * 100);
              return (
                <div key={cls} className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl w-8">{icon}</span>
                    <span className="text-sm font-bold" style={{ color }}>{cls}</span>
                    <span className="ml-auto text-xs text-gray-500 bg-gray-900/60 px-2 py-0.5 rounded-full">
                      {clsMembers.length} {clsMembers.length === 1 ? 'player' : 'players'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {clsMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all hover:scale-105"
                        style={{ borderColor: `${color}60`, backgroundColor: `${color}15`, color }}
                        title={m.parsedSpec}
                      >
                        <span>{ROLE_ICONS[m.role]}</span>
                        <span className="font-bold text-white">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-4 bg-yellow-500 rounded" />
            Roster by Role
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Tanks', icon: '🛡️', group: tanks, borderColor: 'border-blue-700/50', titleColor: 'text-blue-300', bg: 'bg-blue-900/10' },
              { label: 'Healers', icon: '💚', group: healers, borderColor: 'border-green-700/50', titleColor: 'text-green-300', bg: 'bg-green-900/10' },
              { label: 'DPS', icon: '⚔️', group: dps, borderColor: 'border-red-700/50', titleColor: 'text-red-300', bg: 'bg-red-900/10' },
              { label: 'Unknown Role', icon: '❓', group: unknown, borderColor: 'border-gray-700/50', titleColor: 'text-gray-400', bg: 'bg-gray-800/10' },
            ].map(({ label, icon, group, borderColor, titleColor, bg }) => group.length > 0 && (
              <div key={label} className={`border ${borderColor} ${bg} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{icon}</span>
                  <span className={`text-sm font-bold ${titleColor}`}>{label}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${titleColor} ${borderColor} bg-black/20`}>
                    {group.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {group.map(m => <MemberBadge key={m.id} m={m} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-700 text-center">💡 Click any player to edit their name, spec, role, and weekly availability</p>
    </div>
  );
}
