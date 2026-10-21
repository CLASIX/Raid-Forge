import React from 'react';
import { RosterMember, DAYS, TIME_SLOTS, Day } from '../types';
import { CLASS_COLORS, ROLE_ICONS } from '../utils/wowData';
import { getAvailabilityForSlot } from '../utils/availability';

interface Props {
  members: RosterMember[];
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

interface CellData {
  count: number;
  members: { member: RosterMember; shortLabel: string }[];
}

export function AvailabilityHeatmap({ members }: Props) {
  const heatmapData: Record<string, Record<string, CellData>> = {};

  for (const day of DAYS) {
    heatmapData[day] = {};
    for (const slot of TIME_SLOTS) {
      const cellMembers: CellData['members'] = [];
      for (const member of members) {
        const result = getAvailabilityForSlot(member, day, slot);
        if (result.available) {
          cellMembers.push({ member, shortLabel: result.shortLabel });
        }
      }
      heatmapData[day][slot] = { count: cellMembers.length, members: cellMembers };
    }
  }

  const maxCount = Math.max(
    ...DAYS.flatMap((day) => TIME_SLOTS.map((slot) => heatmapData[day][slot].count)),
    1,
  );

  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-900/60 text-gray-700';
    const ratio = count / maxCount;
    if (ratio > 0.8) return 'bg-green-500/90 text-white font-bold';
    if (ratio > 0.6) return 'bg-green-600/80 text-white';
    if (ratio > 0.4) return 'bg-yellow-600/80 text-white';
    if (ratio > 0.2) return 'bg-orange-700/70 text-gray-100';
    return 'bg-red-900/60 text-gray-300';
  };

  const [tooltip, setTooltip] = React.useState<{ day: string; slot: string; x: number; y: number } | null>(null);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex gap-1 mb-2 text-xs text-gray-400 items-center">
          <div className="w-14 flex-shrink-0" />
          {DAYS.map((day) => (
            <div key={day} className="flex-1 text-center font-semibold text-gray-300 text-xs">
              {DAY_LABELS[day].slice(0, 3)}
            </div>
          ))}
        </div>

        <div className="space-y-0.5">
          {TIME_SLOTS.map((slot) => (
            <div key={slot} className="flex gap-1 items-center">
              <div className="w-14 text-right text-xs text-gray-500 pr-2 flex-shrink-0">{slot}</div>
              {DAYS.map((day) => {
                const cell = heatmapData[day][slot];
                return (
                  <div
                    key={day}
                    className={`flex-1 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-all hover:scale-105 hover:z-10 relative ${getColor(cell.count)}`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ day, slot, x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {cell.count > 0 ? cell.count : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-gray-400">
          <span>Less available</span>
          <div className="flex gap-1">
            <div className="w-6 h-4 rounded bg-gray-900/60" />
            <div className="w-6 h-4 rounded bg-red-900/60" />
            <div className="w-6 h-4 rounded bg-orange-700/70" />
            <div className="w-6 h-4 rounded bg-yellow-600/80" />
            <div className="w-6 h-4 rounded bg-green-600/80" />
            <div className="w-6 h-4 rounded bg-green-500/90" />
          </div>
          <span>More available</span>
          <span className="ml-auto text-gray-600">Shows exact match + up to 1hr window + open</span>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl pointer-events-none text-xs max-w-64"
            style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
          >
            <p className="font-bold text-yellow-400 mb-1.5">{DAY_LABELS[tooltip.day as Day]} @ {tooltip.slot}</p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {heatmapData[tooltip.day][tooltip.slot].members.map(({ member, shortLabel }) => (
                <div key={member.id} className="flex items-center gap-1.5">
                  <span style={{ color: CLASS_COLORS[member.parsedClass] }}>●</span>
                  <span className="text-gray-200">{member.name}</span>
                  <span className="text-[10px]">{ROLE_ICONS[member.role]}</span>
                  <span className="ml-auto text-gray-500 text-[10px]">{shortLabel}</span>
                </div>
              ))}
            </div>
            {heatmapData[tooltip.day][tooltip.slot].members.length === 0 && (
              <p className="text-gray-500">No one available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
