import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RosterMember,
  RaidSize,
  Day,
  RAID_TIME_OPTIONS,
  BuilderState,
  RaidCompSelection,
  Preferences,
  SavedComp,
} from '../types';
import { copyToClipboard, discordTextFrom } from '../utils/shareComp';
import { autoBuildComp } from '../utils/autofill';
import { buffsForMember, computeCoverage } from '../utils/buffs';
import { BuffCoverage, MissingBuffChip } from './BuffCoverage';
import { CLASS_COLORS, CLASS_ICONS, RAID_COMP_REQUIREMENTS } from '../utils/wowData';
import { countWindowAvailability, getAvailabilityForSlot, sortMembersForWindow } from '../utils/availability';
import { CalendarDays, Clock3, Users, X, Wand2, AlertTriangle, UserMinus, UserPlus, Copy, Check } from 'lucide-react';

interface Props {
  members: RosterMember[];
  raidSize: RaidSize;
  onRaidSizeChange: (size: RaidSize) => void;
  /** Lifted to App so the comp is saved with the roster instead of dying on refresh. */
  builder: BuilderState;
  onBuilderChange: (next: BuilderState) => void;
  preferences: Preferences;
  onPreferencesChange: (next: Preferences) => void;
  savedComps: SavedComp[];
  onSavedCompsChange: (next: SavedComp[]) => void;
}

type GroupedRaidIds = RaidCompSelection;

const DAY_OPTIONS: { value: Day; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export function RaidBuilder({
  members,
  raidSize,
  onRaidSizeChange,
  builder,
  onBuilderChange,
  preferences,
  onPreferencesChange,
  savedComps,
  onSavedCompsChange,
}: Props) {
  const disabledBuffs = useMemo(() => new Set(preferences.disabledBuffIds), [preferences.disabledBuffIds]);
  const { day: targetDay, time: targetTime, comp: raidComp } = builder;

  // Exposed as a Set to keep the existing call sites readable; serialized back
  // to an array whenever it changes so it survives JSON.
  const excludedIds = useMemo(() => new Set(builder.excludedIds), [builder.excludedIds]);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const setTargetDay = (day: Day) => onBuilderChange({ ...builder, day });
  const setTargetTime = (time: string) => onBuilderChange({ ...builder, time });
  const setRaidComp = (next: GroupedRaidIds | ((prev: GroupedRaidIds) => GroupedRaidIds)) => {
    const comp = typeof next === 'function' ? next(builder.comp) : next;
    onBuilderChange({ ...builder, comp });
  };
  const setExcludedIds = (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const resolved = typeof next === 'function' ? next(excludedIds) : next;
    onBuilderChange({ ...builder, excludedIds: [...resolved] });
  };

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const requirements = RAID_COMP_REQUIREMENTS[raidSize];

  // Drop ids that are no longer in the roster (e.g. after re-importing). Guarded
  // so an unchanged comp doesn't rewrite state on every pass.
  useEffect(() => {
    const keep = (ids: string[]) => ids.filter((id) => memberMap.has(id));
    const tanks = keep(builder.comp.tanks);
    const healers = keep(builder.comp.healers);
    const dps = keep(builder.comp.dps);

    const unchanged =
      tanks.length === builder.comp.tanks.length &&
      healers.length === builder.comp.healers.length &&
      dps.length === builder.comp.dps.length;
    if (unchanged) return;

    onBuilderChange({ ...builder, comp: { tanks, healers, dps } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberMap]);

  const selectedIds = new Set([...raidComp.tanks, ...raidComp.healers, ...raidComp.dps]);
  const activeMembersPool = members.filter((m) => !excludedIds.has(m.id));
  const windowCounts = countWindowAvailability(activeMembersPool, targetDay, targetTime);

  // Candidates must actually be available for the selected day/time window —
  // players with no listing that day (or listed too far off) are not shown.
  const windowAvailablePool = activeMembersPool.filter(
    (m) => getAvailabilityForSlot(m, targetDay, targetTime).available,
  );
  const unavailableHiddenCount = activeMembersPool.filter(
    (m) => !selectedIds.has(m.id) && !getAvailabilityForSlot(m, targetDay, targetTime).available,
  ).length;

  const availableTanks = sortMembersForWindow(windowAvailablePool.filter((m) => m.role === 'Tank' && !selectedIds.has(m.id)), targetDay, targetTime);
  const availableHealers = sortMembersForWindow(windowAvailablePool.filter((m) => m.role === 'Healer' && !selectedIds.has(m.id)), targetDay, targetTime);
  const availableDPS = sortMembersForWindow(windowAvailablePool.filter((m) => m.role === 'DPS' && !selectedIds.has(m.id)), targetDay, targetTime);
  const availableUnknown = sortMembersForWindow(windowAvailablePool.filter((m) => m.role === 'Unknown' && !selectedIds.has(m.id)), targetDay, targetTime);

  const selectedTanks = raidComp.tanks.map((id) => memberMap.get(id)).filter((m): m is RosterMember => Boolean(m));
  const selectedHealers = raidComp.healers.map((id) => memberMap.get(id)).filter((m): m is RosterMember => Boolean(m));
  const selectedDPS = raidComp.dps.map((id) => memberMap.get(id)).filter((m): m is RosterMember => Boolean(m));

  const totalInRaid = selectedTanks.length + selectedHealers.length + selectedDPS.length;

  const coverage = useMemo(
    () => computeCoverage([...selectedTanks, ...selectedHealers, ...selectedDPS], disabledBuffs),
    [selectedTanks, selectedHealers, selectedDPS, disabledBuffs],
  );
  const selectedAvailableCount = [...selectedTanks, ...selectedHealers, ...selectedDPS]
    .filter((m) => getAvailabilityForSlot(m, targetDay, targetTime).available).length;

  const addToComp = (member: RosterMember, slot: keyof GroupedRaidIds) => {
    setRaidComp((prev) => ({ ...prev, [slot]: [...prev[slot], member.id] }));
  };
  const removeFromComp = (id: string, slot: keyof GroupedRaidIds) => {
    setRaidComp((prev) => ({ ...prev, [slot]: prev[slot].filter((x) => x !== id) }));
  };
  const clearComp = () => setRaidComp({ tanks: [], healers: [], dps: [] });

  const excludePlayer = (id: string) => {
    removeFromComp(id, 'tanks');
    removeFromComp(id, 'healers');
    removeFromComp(id, 'dps');
    setExcludedIds((prev) => new Set([...prev, id]));
  };
  const unexcludePlayer = (id: string) => {
    setExcludedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };
  const clearExcluded = () => setExcludedIds(new Set());

  const autoFill = () => {
    setRaidComp(
      autoBuildComp({
        members,
        requirements,
        day: targetDay,
        time: targetTime,
        excludedIds: builder.excludedIds,
        disabledBuffIds: preferences.disabledBuffIds,
      }),
    );
  };

  // ─── Named comps ───────────────────────────────────────────────────────────
  const [compName, setCompName] = useState('');
  const [saveNote, setSaveNote] = useState('');

  const handleSaveComp = () => {
    const name = compName.trim();
    if (!name) {
      setSaveNote('Give the comp a name first.');
      return;
    }

    const existing = savedComps.find((comp) => comp.name.toLowerCase() === name.toLowerCase());
    const entry = {
      id: existing?.id ?? `comp-${Date.now().toString(36)}`,
      name: name.slice(0, 60),
      raidSize,
      builder,
      savedAt: new Date().toISOString(),
    };

    onSavedCompsChange(
      existing
        ? savedComps.map((comp) => (comp.id === existing.id ? entry : comp))
        : [...savedComps, entry],
    );
    setCompName('');
    setSaveNote(existing ? `Updated "${entry.name}".` : `Saved "${entry.name}".`);
  };

  const handleLoadComp = (comp: SavedComp) => {
    onRaidSizeChange(comp.raidSize);
    onBuilderChange(comp.builder);
    setSaveNote(`Loaded "${comp.name}".`);
  };

  const handleDeleteComp = (id: string) => {
    onSavedCompsChange(savedComps.filter((comp) => comp.id !== id));
  };

  const copyTimer = useRef<number | undefined>(undefined);
  const handleCopy = async () => {
    const text = discordTextFrom(members, raidSize, builder, requirements);
    const ok = await copyToClipboard(text);
    setCopyState(ok ? 'copied' : 'failed');
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 2500);
  };

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const getStatusClasses = (status: string) => {
    if (status === 'exact') return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40';
    if (status === 'open') return 'bg-green-900/40 text-green-300 border-green-700/40';
    if (status === 'within1hr') return 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40';
    if (status === 'tooEarly') return 'bg-orange-900/40 text-orange-300 border-orange-700/40';
    if (status === 'tooLate') return 'bg-orange-900/40 text-orange-300 border-orange-700/40';
    return 'bg-gray-900/40 text-gray-500 border-gray-700/40';
  };

  const SlotRow = ({ member, slot }: { member: RosterMember; slot: keyof GroupedRaidIds }) => {
    const color = CLASS_COLORS[member.parsedClass];
    const avail = getAvailabilityForSlot(member, targetDay, targetTime);
    return (
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/60 p-2.5" style={{ borderLeftColor: color, borderLeftWidth: '3px' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">{CLASS_ICONS[member.parsedClass]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-white truncate">{member.name}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${getStatusClasses(avail.status)}`}>{avail.shortLabel}</span>
            </div>
            <div className="text-xs" style={{ color }}>{member.parsedSpec}</div>
          </div>
          <button onClick={() => excludePlayer(member.id)} className="text-yellow-600 hover:text-yellow-400 transition-colors" title="Sit / exclude from this builder">
            <UserMinus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => removeFromComp(member.id, slot)} className="text-red-400 hover:text-red-300 transition-colors" title="Remove from slot">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const CandidateRow = ({ member, slot }: { member: RosterMember; slot: keyof GroupedRaidIds }) => {
    const color = CLASS_COLORS[member.parsedClass];
    const avail = getAvailabilityForSlot(member, targetDay, targetTime);
    const missingNames = buffsForMember(member, disabledBuffs)
      .filter((def) => coverage.entries.some((entry) => entry.def.id === def.id && !entry.covered))
      .map((def) => def.name);
    return (
      <div className="flex items-center gap-2 w-full rounded-xl border border-gray-700/30 bg-gray-800/40 p-2.5 hover:border-yellow-500/60 hover:bg-yellow-900/10 transition-all" style={{ borderLeftColor: color, borderLeftWidth: '3px' }}>
        <span className="text-base">{CLASS_ICONS[member.parsedClass]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{member.name}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${getStatusClasses(avail.status)}`}>{avail.shortLabel}</span>
            <MissingBuffChip missing={missingNames} />
          </div>
          <div className="text-xs" style={{ color }}>{member.parsedSpec}</div>
        </div>
        <button onClick={() => excludePlayer(member.id)} className="text-gray-600 hover:text-yellow-400 transition-colors" title="Sit / exclude">
          <UserMinus className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => addToComp(member, slot)} className="text-xs text-yellow-400 font-bold hover:text-yellow-300 px-1">+</button>
      </div>
    );
  };

  const excludedMembers = members.filter((m) => excludedIds.has(m.id));

  const roleSummaries = [
    { label: 'Tanks', icon: '🛡️', current: selectedTanks.length, required: requirements.tanks, color: 'text-blue-300', pool: windowCounts.tanks },
    { label: 'Healers', icon: '💚', current: selectedHealers.length, required: requirements.healers, color: 'text-green-300', pool: windowCounts.healers },
    { label: 'DPS', icon: '⚔️', current: selectedDPS.length, required: requirements.dps, color: 'text-red-300', pool: windowCounts.dps },
  ];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-2 flex-wrap">
              {([10, 20, 40] as RaidSize[]).map((size) => (
                <button key={size} onClick={() => onRaidSizeChange(size)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${raidSize === size ? 'bg-yellow-600 border-yellow-500 text-black' : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'}`}>
                  {size} Man
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2 flex-wrap">
              <button onClick={autoFill} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
                <Wand2 className="w-4 h-4" />
                Auto Fill
              </button>
              <button
                onClick={handleCopy}
                disabled={totalInRaid === 0}
                title={totalInRaid === 0 ? 'Add players to the comp first' : 'Copy the comp as Discord-formatted text'}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  copyState === 'copied'
                    ? 'bg-emerald-700 text-white'
                    : copyState === 'failed'
                      ? 'bg-red-800 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                {copyState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy blocked' : 'Copy for Discord'}
              </button>
              <button onClick={clearComp} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">Clear</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Raid Day</label>
              <div className="relative">
                <CalendarDays className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select value={targetDay} onChange={(e) => setTargetDay(e.target.value as Day)} className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500">
                  {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Raid Start Time (EST)</label>
              <div className="relative">
                <Clock3 className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select value={targetTime} onChange={(e) => setTargetTime(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500">
                  {RAID_TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-yellow-400" /> Window Summary</span>
              <span className="text-sm font-bold text-yellow-300">{selectedAvailableCount} / {totalInRaid} selected fit this time</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                <div className="text-xs text-gray-500">Available Pool</div>
                <div className="text-2xl font-black text-white">{windowCounts.total}</div>
                {excludedIds.size > 0 && <div className="text-[11px] text-yellow-600">{excludedIds.size} sitting out</div>}
              </div>
              {roleSummaries.map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-900/50 p-3 border border-gray-800">
                  <div className="text-xs text-gray-500">{item.icon} {item.label}</div>
                  <div className={`text-xl font-black ${item.color}`}>{item.pool}</div>
                  <div className="text-[11px] text-gray-600">selected {item.current}/{item.required}</div>
                </div>
              ))}
            </div>
            {windowCounts.total < raidSize && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-700/40 bg-orange-900/20 px-3 py-2 text-xs text-orange-300">
                <AlertTriangle className="w-4 h-4" />
                Not enough players available for a full {raidSize}-man.
              </div>
            )}
          </div>
        </div>

        {/* Coverage + Legend + Bench */}
        <div className="space-y-4">
          {/* Saved comps */}
          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Saved Comps</h3>

            <div className="flex gap-2">
              <input
                value={compName}
                onChange={(e) => {
                  setCompName(e.target.value);
                  setSaveNote('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveComp();
                }}
                placeholder="e.g. Tuesday 20-man"
                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={handleSaveComp}
                disabled={totalInRaid === 0}
                title={totalInRaid === 0 ? 'Build a comp first' : 'Save this comp under a name'}
                className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg text-sm transition-colors"
              >
                Save
              </button>
            </div>

            {saveNote && <p className="text-[11px] text-green-400">{saveNote}</p>}

            {savedComps.length === 0 ? (
              <p className="text-xs text-gray-600">
                No saved comps yet. Saving keeps Tuesday&apos;s and Saturday&apos;s separate.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {savedComps.map((comp) => {
                  const size =
                    comp.builder.comp.tanks.length +
                    comp.builder.comp.healers.length +
                    comp.builder.comp.dps.length;
                  return (
                    <div
                      key={comp.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-700/40 bg-gray-900/50 px-2.5 py-1.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{comp.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {comp.raidSize}M · {size} picked · {comp.builder.day.slice(0, 3)} {comp.builder.time}
                        </div>
                      </div>
                      <button
                        onClick={() => handleLoadComp(comp)}
                        className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteComp(comp.id)}
                        className="text-red-400/80 hover:text-red-300 transition-colors"
                        title="Delete saved comp"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <BuffCoverage
            coverage={coverage}
            compSize={totalInRaid}
            disabledIds={disabledBuffs}
            onToggleBuff={(id) => {
              const next = new Set(preferences.disabledBuffIds);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              onPreferencesChange({ ...preferences, disabledBuffIds: [...next] });
            }}
            onEnableAll={() => onPreferencesChange({ ...preferences, disabledBuffIds: [] })}
            collapsed={preferences.buffPanelCollapsed}
            onToggleCollapsed={() =>
              onPreferencesChange({
                ...preferences,
                buffPanelCollapsed: !preferences.buffPanelCollapsed,
              })
            }
          />

          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Availability Window</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-2 text-emerald-300">Exact time match</div>
              <div className="rounded-lg border border-green-700/40 bg-green-900/20 px-3 py-2 text-green-300">Open / flexible</div>
              <div className="rounded-lg border border-cyan-700/40 bg-cyan-900/20 px-3 py-2 text-cyan-300">Within 1hr of preferred</div>
              <div className="rounded-lg border border-orange-700/40 bg-orange-900/20 px-3 py-2 text-orange-300">Outside 1hr window</div>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed">
              Players are only counted as available if their preferred start time is within ±1 hour of the raid time.
            </div>
          </div>

          {/* Excluded / Bench */}
          <div className="rounded-2xl border border-yellow-800/30 bg-yellow-950/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-2">
                <UserMinus className="w-4 h-4" />
                Bench / Sitting Out ({excludedMembers.length})
              </h3>
              {excludedMembers.length > 0 && (
                <button onClick={clearExcluded} className="text-xs text-gray-400 hover:text-white transition-colors">
                  Clear all
                </button>
              )}
            </div>
            {excludedMembers.length === 0 ? (
              <p className="text-xs text-gray-600">Click the <UserMinus className="w-3 h-3 inline" /> icon on any player to sit them out when they're in enough raid groups.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {excludedMembers.map((m) => {
                  const color = CLASS_COLORS[m.parsedClass];
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border border-gray-700/30 bg-gray-900/40 px-3 py-2" style={{ borderLeftColor: color, borderLeftWidth: '3px' }}>
                      <span className="text-sm">{CLASS_ICONS[m.parsedClass]}</span>
                      <span className="text-sm font-bold text-gray-400 truncate flex-1">{m.name}</span>
                      <span className="text-xs" style={{ color }}>{m.parsedSpec}</span>
                      <button onClick={() => unexcludePlayer(m.id)} className="text-green-400 hover:text-green-300 transition-colors" title="Put back in pool">
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Roster + Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Raid Roster</h3>

          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3"><span>🛡️</span><span className="text-sm font-bold text-blue-300">Tanks</span><span className="ml-auto text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-full">{selectedTanks.length}/{requirements.tanks}</span></div>
            <div className="space-y-2">
              {selectedTanks.map((m) => <SlotRow key={m.id} member={m} slot="tanks" />)}
              {selectedTanks.length < requirements.tanks && <div className="text-xs text-blue-200/70 border border-dashed border-blue-800/40 rounded-lg p-2 text-center">{requirements.tanks - selectedTanks.length} more needed</div>}
            </div>
          </div>

          <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3"><span>💚</span><span className="text-sm font-bold text-green-300">Healers</span><span className="ml-auto text-xs text-green-400 bg-green-900/40 px-2 py-0.5 rounded-full">{selectedHealers.length}/{requirements.healers}</span></div>
            <div className="space-y-2">
              {selectedHealers.map((m) => <SlotRow key={m.id} member={m} slot="healers" />)}
              {selectedHealers.length < requirements.healers && <div className="text-xs text-green-200/70 border border-dashed border-green-800/40 rounded-lg p-2 text-center">{requirements.healers - selectedHealers.length} more needed</div>}
            </div>
          </div>

          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3"><span>⚔️</span><span className="text-sm font-bold text-red-300">DPS</span><span className="ml-auto text-xs text-red-400 bg-red-900/40 px-2 py-0.5 rounded-full">{selectedDPS.length}/{requirements.dps}</span></div>
            <div className="space-y-2">
              {selectedDPS.map((m) => <SlotRow key={m.id} member={m} slot="dps" />)}
              {selectedDPS.length < requirements.dps && <div className="text-xs text-red-200/70 border border-dashed border-red-800/40 rounded-lg p-2 text-center">{requirements.dps - selectedDPS.length} more needed</div>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Candidates for {DAY_OPTIONS.find((d) => d.value === targetDay)?.label} @ {targetTime}</h3>
            {unavailableHiddenCount > 0 && (
              <span className="text-xs text-gray-600 italic">
                {unavailableHiddenCount} player{unavailableHiddenCount === 1 ? '' : 's'} not available at this time hidden
              </span>
            )}
          </div>

          <div className="bg-blue-900/10 border border-blue-700/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2"><span>🛡️</span><span className="text-sm font-bold text-blue-300">Tanks ({availableTanks.length})</span></div>
            <div className="space-y-2">{availableTanks.length === 0 ? <p className="text-xs text-gray-600 italic px-2">None in this role</p> : availableTanks.map((m) => <CandidateRow key={m.id} member={m} slot="tanks" />)}</div>
          </div>

          <div className="bg-green-900/10 border border-green-700/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2"><span>💚</span><span className="text-sm font-bold text-green-300">Healers ({availableHealers.length})</span></div>
            <div className="space-y-2">{availableHealers.length === 0 ? <p className="text-xs text-gray-600 italic px-2">None in this role</p> : availableHealers.map((m) => <CandidateRow key={m.id} member={m} slot="healers" />)}</div>
          </div>

          <div className="bg-red-900/10 border border-red-700/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2"><span>⚔️</span><span className="text-sm font-bold text-red-300">DPS ({availableDPS.length})</span></div>
            <div className="space-y-2">{availableDPS.length === 0 ? <p className="text-xs text-gray-600 italic px-2">None in this role</p> : availableDPS.map((m) => <CandidateRow key={m.id} member={m} slot="dps" />)}</div>
          </div>

          {availableUnknown.length > 0 && (
            <div className="bg-gray-800/30 border border-gray-700/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><span>❓</span><span className="text-sm font-bold text-gray-400">Unknown Role ({availableUnknown.length})</span></div>
              <div className="space-y-2">
                {availableUnknown.map((m) => {
                  const color = CLASS_COLORS[m.parsedClass];
                  const avail = getAvailabilityForSlot(m, targetDay, targetTime);
                  return (
                    <div key={m.id} className="rounded-xl border border-gray-700/30 bg-gray-800/40 p-2.5" style={{ borderLeftColor: color, borderLeftWidth: '3px' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{CLASS_ICONS[m.parsedClass]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-white truncate">{m.name}</span>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${getStatusClasses(avail.status)}`}>{avail.shortLabel}</span>
                          </div>
                          <div className="text-xs" style={{ color }}>{m.parsedSpec}</div>
                        </div>
                        <button onClick={() => excludePlayer(m.id)} className="text-gray-600 hover:text-yellow-400 transition-colors" title="Sit"><UserMinus className="w-3.5 h-3.5" /></button>
                        <div className="flex gap-1">
                          {(['tanks', 'healers', 'dps'] as const).map((slot) => (
                            <button key={slot} onClick={() => addToComp(m, slot)} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                              {slot === 'tanks' ? '🛡️' : slot === 'healers' ? '💚' : '⚔️'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
