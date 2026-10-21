import { useEffect, useState } from 'react';
import { RosterMember, DAYS, Day, Role, TIME_SLOTS } from '../types';
import { CLASS_COLORS, CLASS_ICONS, ROLE_BG_COLORS, ROLE_ICONS, parseClassFromSpec } from '../utils/wowData';
import { X, Save, RotateCcw } from 'lucide-react';

interface Props {
  member: RosterMember;
  onClose: () => void;
  onSave: (member: RosterMember) => void;
}

const DAY_LABELS: Record<Day, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const ROLE_OPTIONS: Role[] = ['Tank', 'Healer', 'DPS', 'Unknown'];

export function MemberDetailModal({ member, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<RosterMember>(member);

  useEffect(() => {
    setDraft(member);
  }, [member]);

  const color = CLASS_COLORS[draft.parsedClass];

  const updateAvailability = (day: Day, value: string) => {
    setDraft((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: value,
      },
    }));
  };

  const handleSpecChange = (specClass: string) => {
    setDraft((prev) => ({
      ...prev,
      specClass,
      parsedSpec: specClass,
      parsedClass: parseClassFromSpec(specClass),
    }));
  };

  const handleSave = () => {
    onSave({
      ...draft,
      name: draft.name.trim() || 'Unknown',
      specClass: draft.specClass.trim(),
      parsedSpec: draft.specClass.trim(),
      parsedClass: parseClassFromSpec(draft.specClass.trim()),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTopColor: color, borderTopWidth: '4px' }}
      >
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
              style={{ borderColor: color, backgroundColor: `${color}22` }}
            >
              {CLASS_ICONS[draft.parsedClass]}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Edit Roster Entry</h2>
              <p className="text-sm font-medium" style={{ color }}>{draft.parsedSpec || 'No spec set'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Player Name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                placeholder="Discord / player name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Role Classification</label>
              <select
                value={draft.role}
                onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value as Role }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Spec / Class</label>
              <input
                value={draft.specClass}
                onChange={(e) => handleSpecChange(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                placeholder="Example: Holy Priest, Fury Warrior, Enhancement Shaman"
              />
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-300">
              Detected Class: <span className="font-bold" style={{ color }}>{draft.parsedClass}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={draft.openAvailability}
                onChange={(e) => setDraft((prev) => ({ ...prev, openAvailability: e.target.checked }))}
                className="rounded border-gray-600 bg-gray-950 text-yellow-500 focus:ring-yellow-500"
              />
              Completely open availability
            </label>
            <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium ${ROLE_BG_COLORS[draft.role]}`}>
              {ROLE_ICONS[draft.role]} {draft.role}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Weekly Availability (EST)</h3>
              <button
                type="button"
                onClick={() => setDraft(member)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Changes
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DAYS.map((day) => (
                <div key={day} className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{DAY_LABELS[day]}</label>
                  <select
                    value={draft.availability[day] || ''}
                    onChange={(e) => updateAvailability(day, e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                  >
                    <option value="">Not Listed</option>
                    <option value="Open">Open Availability</option>
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-600">Original signup timestamp: {member.timestamp || 'Unknown'}</p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
