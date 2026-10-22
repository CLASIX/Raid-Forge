import React from 'react';
import { CLASS_ICONS } from '../utils/wowData';
import { BUFF_DEFS, BuffDef, CoverageSummary } from '../utils/buffs';

interface Props {
  coverage: CoverageSummary;
  /** Members currently in the comp, for the provider counts. */
  compSize: number;
  /** Buffs the user has switched off (e.g. ones this server doesn't have). */
  disabledIds: Set<string>;
  onToggleBuff: (id: string) => void;
  onEnableAll: () => void;
}

/**
 * Buff / debuff coverage for the current comp. Missing entries lead, because
 * that's the actionable half — the point is to see what the comp can't bring yet.
 */
export function BuffCoverage({ coverage, compSize, disabledIds, onToggleBuff, onEnableAll }: Props) {
  const { entries, coveredCount, totalCount, missingBuffs, missingDebuffs } = coverage;
  const [editing, setEditing] = React.useState(false);

  const groups: { label: string; defs: BuffDef[] }[] = [
    { label: 'Buffs', defs: BUFF_DEFS.filter((def) => def.category === 'buff') },
    { label: 'Debuffs', defs: BUFF_DEFS.filter((def) => def.category === 'debuff') },
  ];

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Buff Coverage</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing((prev) => !prev)}
            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
              editing
                ? 'border-yellow-600/60 bg-yellow-900/30 text-yellow-300'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
            title="Choose which buffs this server actually has"
          >
            {editing ? 'Done' : 'Customize'}
          </button>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              coveredCount === totalCount
                ? 'bg-green-900/40 text-green-300 border-green-700/40'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}
          >
            {coveredCount}/{totalCount}
          </span>
        </div>
      </div>

      {editing && (
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-2.5 space-y-2">
          <p className="text-[11px] text-gray-500">
            Uncheck anything Forever doesn&apos;t have. Saved with your roster, and auto-fill ignores
            switched-off buffs.
          </p>
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {group.defs.map((def) => (
                  <label
                    key={def.id}
                    className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer hover:text-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={!disabledIds.has(def.id)}
                      onChange={() => onToggleBuff(def.id)}
                      className="rounded border-gray-600 bg-gray-950 text-yellow-500 focus:ring-yellow-500"
                    />
                    <span className="truncate">{def.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {disabledIds.size > 0 && (
            <button
              onClick={onEnableAll}
              className="text-[11px] text-yellow-400/90 hover:text-yellow-300 transition-colors"
            >
              Turn all back on ({disabledIds.size} off)
            </button>
          )}
        </div>
      )}

      {totalCount === 0 ? (
        <p className="text-xs text-gray-500">
          Every buff is switched off — use <span className="text-yellow-400/90">Customize</span> to
          turn some back on.
        </p>
      ) : compSize === 0 ? (
        <p className="text-xs text-gray-600">
          Add players to the comp to see which raid buffs and debuffs you're missing.
        </p>
      ) : (
        <>
          {/* Progress bar: coverage at a glance */}
          <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500/80 transition-all"
              style={{ width: `${(coveredCount / totalCount) * 100}%` }}
            />
          </div>

          {missingBuffs.length === 0 && missingDebuffs.length === 0 ? (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              ✓ Full buff and debuff coverage.
            </p>
          ) : (
            <div className="space-y-2">
              {missingBuffs.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-orange-400/80">
                    Missing buffs ({missingBuffs.length})
                  </div>
                  <div className="space-y-1">
                    {missingBuffs.map(({ def }) => (
                      <div
                        key={def.id}
                        className="flex items-center gap-2 rounded-lg border border-orange-800/30 bg-orange-950/20 px-2.5 py-1.5"
                      >
                        <span className="text-xs">{CLASS_ICONS[def.className]}</span>
                        <span className="text-xs text-gray-300 truncate flex-1">{def.name}</span>
                        <span className="text-[11px] text-orange-400/80 whitespace-nowrap">
                          needs {def.className}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {missingDebuffs.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-yellow-500/80">
                    Missing debuffs ({missingDebuffs.length})
                  </div>
                  <div className="space-y-1">
                    {missingDebuffs.map(({ def }) => (
                      <div
                        key={def.id}
                        className="flex items-center gap-2 rounded-lg border border-yellow-800/30 bg-yellow-950/10 px-2.5 py-1.5"
                      >
                        <span className="text-xs">{CLASS_ICONS[def.className]}</span>
                        <span className="text-xs text-gray-300 truncate flex-1">{def.name}</span>
                        <span className="text-[11px] text-yellow-500/80 whitespace-nowrap">
                          needs {def.className}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Covered: compact, so it doesn't crowd out the gaps. */}
          {coveredCount > 0 && (
            <details className="group">
              <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none">
                Covered ({coveredCount}) — click to expand
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {entries
                  .filter((entry) => entry.covered)
                  .map((entry) => (
                    <span
                      key={entry.def.id}
                      title={`${entry.providers.map((p) => p.name).join(', ')}`}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-green-800/40 bg-green-950/30 text-green-300/90"
                    >
                      {entry.def.name}
                    </span>
                  ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/** Small chip for candidate rows: how many of this player's buffs are still missing. */
export function MissingBuffChip({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full border border-green-700/50 bg-green-900/40 text-green-300 whitespace-nowrap"
      title={`Would cover: ${missing.join(', ')}`}
    >
      +{missing.length} buff{missing.length === 1 ? '' : 's'}
    </span>
  );
}
