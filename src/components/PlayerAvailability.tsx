import { useState } from 'react';
import { RosterMember, DAYS, Day, Role } from '../types';
import { CLASS_COLORS, CLASS_ICONS, ROLE_ICONS } from '../utils/wowData';
import { MemberDetailModal } from './MemberDetailModal';
import { Search } from 'lucide-react';

interface Props {
  members: RosterMember[];
  onUpdateMember: (member: RosterMember) => void;
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

export function PlayerAvailability({ members, onUpdateMember }: Props) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'class' | 'role'>('name');
  const [selectedMember, setSelectedMember] = useState<RosterMember | null>(null);

  const filtered = members
    .filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.parsedSpec.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'All' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'class') return a.parsedClass.localeCompare(b.parsedClass);
      if (sortBy === 'role') return a.role.localeCompare(b.role);
      return 0;
    });

  const getTimeStyle = (time: string, isOpen: boolean) => {
    if (isOpen || time === 'Open') return 'bg-green-700/60 text-green-100 border-green-600/40';
    if (time) return 'bg-blue-800/60 text-blue-100 border-blue-600/40';
    return 'bg-gray-900/40 text-gray-600 border-gray-700/20';
  };

  return (
    <div className="space-y-4">
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={onUpdateMember}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-yellow-500 placeholder-gray-600"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['All', 'Tank', 'Healer', 'DPS', 'Unknown'] as const).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                roleFilter === role
                  ? 'bg-yellow-600 border-yellow-500 text-black'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {role === 'Tank' ? '🛡️' : role === 'Healer' ? '💚' : role === 'DPS' ? '⚔️' : role === 'Unknown' ? '❓' : ''} {role}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-yellow-500"
        >
          <option value="name">Sort: Name</option>
          <option value="class">Sort: Class</option>
          <option value="role">Sort: Role</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-700/50">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-gray-900/80">
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Player</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Spec / Class</th>
              <th className="text-center px-2 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
              {DAYS.map(day => (
                <th key={day} className="text-center px-1 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filtered.map((member, i) => {
              const color = CLASS_COLORS[member.parsedClass];
              return (
                <tr
                  key={member.id}
                  className={`transition-colors hover:bg-gray-800/40 cursor-pointer ${i % 2 === 0 ? 'bg-gray-900/20' : 'bg-gray-900/40'}`}
                  onClick={() => setSelectedMember(member)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CLASS_ICONS[member.parsedClass]}</span>
                      <span className="text-sm font-bold text-white">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium" style={{ color }}>{member.parsedSpec}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="text-sm">{ROLE_ICONS[member.role]}</span>
                  </td>
                  {DAYS.map(day => {
                    const time = member.availability[day];
                    const isOpen = member.openAvailability || time === 'Open';
                    const display = isOpen ? '✓' : time || '–';
                    return (
                      <td key={day} className="px-1 py-2.5">
                        <div className={`text-center text-xs px-1 py-1 rounded border ${getTimeStyle(time, isOpen)}`}>
                          {display}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-500">No players match your filters</div>}
      </div>
      <p className="text-xs text-gray-600">Showing {filtered.length} of {members.length} players · click a row to edit</p>
    </div>
  );
}
