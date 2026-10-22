import { CLASS_ICONS } from '../utils/wowData';
import { CoverageSummary } from '../utils/buffs';

interface Props {
  coverage: CoverageSummary;
  /** Members currently in the comp, for the provider counts. */
  compSize: number;
}

/**
 * Buff / debuff coverage for the current comp. Missing entries lead, because
 * that's the actionable half — the point is to see what the comp can't bring yet.
 */
export function BuffCoverage({ coverage, compSize }: Props) {
  const { entries, coveredCount, totalCount, missingBuffs, missingDebuffs } = coverage;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Buff Coverage</h3>
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

      {compSize === 0 ? (
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
