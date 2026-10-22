import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BuilderState, DEFAULT_BUILDER_STATE, RosterMember, RaidSize, RAID_TIME_OPTIONS } from './types';
import { parseRosterText, DEFAULT_CSV } from './utils/rosterImport';
import {
  downloadBackup,
  formatSavedAt,
  loadSnapshot,
  readBackupFile,
  saveSnapshot,
  type SaveStatus,
} from './utils/storage';
import { CSVImport } from './components/CSVImport';
import { AvailabilityHeatmap } from './components/AvailabilityHeatmap';
import { RaidBuilder } from './components/RaidBuilder';
import { ClassBreakdown } from './components/ClassBreakdown';
import { PlayerAvailability } from './components/PlayerAvailability';
import { countWindowAvailability } from './utils/availability';
import { Users, Calendar, BarChart2, Swords, Shield, Upload, Download, RotateCcw, Check, AlertTriangle } from 'lucide-react';

type Tab = 'roster' | 'availability' | 'heatmap' | 'builder' | 'import';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'import', label: 'Import', icon: <Upload className="w-4 h-4" /> },
  { id: 'roster', label: 'Roster', icon: <Users className="w-4 h-4" /> },
  { id: 'availability', label: 'Availability', icon: <Calendar className="w-4 h-4" /> },
  { id: 'heatmap', label: 'Heatmap', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'builder', label: 'Raid Builder', icon: <Swords className="w-4 h-4" /> },
];

export default function App() {
  // Read saved data once, before any state initialisers run, so the roster shows
  // up immediately on reload instead of flashing the sample data first.
  const [restored] = useState(() => loadSnapshot());

  const [members, setMembers] = useState<RosterMember[]>(
    () => restored?.members ?? parseRosterText(DEFAULT_CSV),
  );
  const [activeTab, setActiveTab] = useState<Tab>('roster');
  const [raidSize, setRaidSize] = useState<RaidSize>(restored?.raidSize ?? 10);
  const [importSource, setImportSource] = useState(
    restored?.importSource ?? 'Built-in sample roster',
  );

  // The raid comp lives here (not inside RaidBuilder) so it gets saved with the
  // roster instead of being lost on refresh.
  const [builder, setBuilder] = useState<BuilderState>(
    () => restored?.builder ?? DEFAULT_BUILDER_STATE,
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [restoreNote, setRestoreNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // ─── Persistence ───────────────────────────────────────────────────────────
  // Everything the user can change lives in these values. They are written to
  // localStorage on a short debounce so typing in a modal doesn't hit storage on
  // every keystroke.
  const latest = useRef({ members, raidSize, importSource, builder });
  latest.current = { members, raidSize, importSource, builder };

  const pendingSave = useRef(false);

  useEffect(() => {
    pendingSave.current = true;

    const timer = window.setTimeout(() => {
      setSaveStatus(saveSnapshot(latest.current));
      pendingSave.current = false;
    }, 400);

    return () => window.clearTimeout(timer);
  }, [members, raidSize, importSource, builder]);

  // A debounce can be interrupted by the tab closing, so flush on the way out.
  useEffect(() => {
    const flush = () => {
      if (!pendingSave.current) return;
      saveSnapshot(latest.current);
      pendingSave.current = false;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, []);

  // Keeps the "saved 2m ago" label from freezing on a long-lived tab.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (saveStatus?.state !== 'saved') return;
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [saveStatus?.state]);

  const handleExportBackup = () => {
    downloadBackup({ members, raidSize, importSource, builder });
    setRestoreNote({ kind: 'ok', text: 'Backup downloaded.' });
  };

  const handleRestoreBackup = async (file: File) => {
    const snapshot = await readBackupFile(file);
    if (!snapshot) {
      setRestoreNote({ kind: 'error', text: 'That file is not a Raid Forge backup.' });
      return;
    }

    setMembers(snapshot.members);
    setRaidSize(snapshot.raidSize);
    setImportSource(snapshot.importSource);
    setBuilder(snapshot.builder);
    setRestoreNote({ kind: 'ok', text: `Restored ${snapshot.members.length} members.` });
  };

  useEffect(() => {
    if (!restoreNote) return;
    const timer = window.setTimeout(() => setRestoreNote(null), 6000);
    return () => window.clearTimeout(timer);
  }, [restoreNote]);

  const handleImport = (nextMembers: RosterMember[], sourceLabel: string) => {
    if (nextMembers.length > 0) {
      setMembers(nextMembers);
      setImportSource(sourceLabel);
      setActiveTab('roster');
    }
  };

  const handleUpdateMember = (updatedMember: RosterMember) => {
    setMembers((prev) => prev.map((member) => (
      member.id === updatedMember.id ? updatedMember : member
    )));
  };

  const stats = useMemo(() => ({
    total: members.length,
    tanks: members.filter(m => m.role === 'Tank').length,
    healers: members.filter(m => m.role === 'Healer').length,
    dps: members.filter(m => m.role === 'DPS').length,
    unknown: members.filter(m => m.role === 'Unknown').length,
    openAvail: members.filter(m => m.openAvailability).length,
  }), [members]);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-yellow-700/30 bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900">
        {/* WoW-style decorative background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-transparent to-transparent pointer-events-none" />
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(212,175,55,0.3) 10px,
              rgba(212,175,55,0.3) 11px
            )`
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Logo + Title */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-700 shadow-lg shadow-yellow-900/50 flex items-center justify-center border-2 border-yellow-500/80">
                  <Shield className="w-8 h-8 text-gray-900" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border border-blue-400 text-xs">
                  ⚔️
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 tracking-tight">
                    WoW Forever
                  </h1>
                  <span className="text-xs bg-blue-700/60 border border-blue-500/50 text-blue-200 px-2 py-0.5 rounded-full font-semibold">
                    ⚔ Alliance
                  </span>
                </div>
                <p className="text-xs text-yellow-700/90 font-semibold tracking-widest uppercase mt-0.5">
                  Raid Composition Builder
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatBadge label="Roster" value={stats.total} color="text-yellow-300" bg="bg-yellow-900/30 border-yellow-700/40" emoji="👥" />
              <StatBadge label="Tanks" value={stats.tanks} color="text-blue-300" bg="bg-blue-900/30 border-blue-700/40" emoji="🛡️" />
              <StatBadge label="Healers" value={stats.healers} color="text-green-300" bg="bg-green-900/30 border-green-700/40" emoji="💚" />
              <StatBadge label="DPS" value={stats.dps} color="text-red-300" bg="bg-red-900/30 border-red-700/40" emoji="⚔️" />
              {stats.unknown > 0 && (
                <StatBadge label="TBD" value={stats.unknown} color="text-gray-400" bg="bg-gray-800/40 border-gray-700/40" emoji="❓" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-yellow-500 text-yellow-400 bg-yellow-900/10'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600 hover:bg-gray-800/30'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'builder' && (
                  <span className="text-xs bg-yellow-700/40 text-yellow-300 px-1.5 py-0.5 rounded-full border border-yellow-600/30">
                    {raidSize}M
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ─── LOCAL PERSISTENCE BAR ─── */}
        <div className="flex items-center justify-end gap-x-3 gap-y-2 flex-wrap mb-4 text-xs min-h-6">
          {saveStatus?.state === 'saved' && saveStatus.savedAt && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Saved in this browser · {formatSavedAt(saveStatus.savedAt)}
            </span>
          )}
          {saveStatus?.state === 'unsaved' && (
            <span className="flex items-center gap-1.5 text-amber-400 max-w-md">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {saveStatus.reason}
            </span>
          )}
          {saveStatus?.state === 'unavailable' && (
            <span className="flex items-center gap-1.5 text-red-400 max-w-md">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {saveStatus.reason}
            </span>
          )}

          {restoreNote && (
            <span className={`flex items-center gap-1.5 ${restoreNote.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {restoreNote.kind === 'ok'
                ? <Check className="w-3.5 h-3.5" />
                : <AlertTriangle className="w-3.5 h-3.5" />}
              {restoreNote.text}
            </span>
          )}

          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 text-gray-500 hover:text-yellow-400 transition-colors"
            title="Download this roster as a JSON file — a safeguard if browser data gets cleared or you switch computers"
          >
            <Download className="w-3.5 h-3.5" />
            Export backup
          </button>
          <button
            onClick={() => backupInputRef.current?.click()}
            className="flex items-center gap-1.5 text-gray-500 hover:text-yellow-400 transition-colors"
            title="Load a roster from a previously exported backup file"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleRestoreBackup(file);
              e.currentTarget.value = '';
            }}
          />
        </div>

        {/* ─── IMPORT TAB ─── */}
        {activeTab === 'import' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="mb-6">
                <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-yellow-400" />
                  Import Roster
                </h2>
                <p className="text-sm text-gray-400">
                  Import your Google Form responses. Best option: download the Google Sheet as <span className="text-yellow-400 font-semibold">Microsoft Excel (.xlsx)</span> so the weekday columns stay perfectly aligned.
                </p>
                <p className="text-xs text-gray-500 mt-2">Current source: {importSource}</p>
              </div>

              <CSVImport onImport={handleImport} memberCount={members.length} />

              <div className="mt-6 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 space-y-3">
                <h3 className="text-sm font-bold text-yellow-400">📋 What works best</h3>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li><span className="text-yellow-400 font-semibold">.xlsx</span> — best choice, keeps Monday through Sunday headers and blank cells lined up</li>
                  <li><span className="text-gray-300">.ods</span> — also supported</li>
                  <li><span className="text-gray-300">.tsv</span> — great if you copy rows directly from Google Sheets</li>
                  <li><span className="text-gray-300">.csv</span> — still supported, but less friendly when reviewing raw text</li>
                  <li><span className="text-gray-300">.html</span> — works for table exports too</li>
                  <li><span className="text-red-300">.pdf</span> — not recommended for data import because table extraction is unreliable</li>
                </ul>
                <div className="pt-2 border-t border-gray-700/50">
                  <p className="text-xs text-gray-500">
                    🔗 Google Form:{' '}
                    <a
                      href="https://docs.google.com/forms/d/1UfDz_UNYbQudWh7fn90OIx1wOz19s0t-JVj63-aL3QY"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      WoW Forever Signup Form
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ROSTER TAB ─── */}
        {activeTab === 'roster' && (
          <div>
            <SectionHeader
              title="Guild Roster"
              subtitle={`${members.length} adventurers signed up · Click any player to edit details, role, or availability`}
            />
            <ClassBreakdown members={members} onUpdateMember={handleUpdateMember} />
          </div>
        )}

        {/* ─── AVAILABILITY TABLE TAB ─── */}
        {activeTab === 'availability' && (
          <div>
            <SectionHeader
              title="Player Availability"
              subtitle="All times listed in EST · Click any row to edit role, name, spec, or weekly availability"
            />
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <PlayerAvailability members={members} onUpdateMember={handleUpdateMember} />
            </div>
          </div>
        )}

        {/* ─── HEATMAP TAB ─── */}
        {activeTab === 'heatmap' && (
          <div className="space-y-6">
            <SectionHeader
              title="Availability Heatmap"
              subtitle="Darker green = more players available at that time · Hover cells to see who's online"
            />

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <AvailabilityHeatmap members={members} />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-yellow-400">🏆</span>
                Best Raid Windows
              </h3>
              <BestTimes members={members} raidSize={raidSize} />
            </div>
          </div>
        )}

        {/* ─── BUILDER TAB ─── */}
        {activeTab === 'builder' && (
          <div>
            <SectionHeader
              title="Raid Comp Builder"
              subtitle="Pick a raid day and time, see who fits that window, then auto-build around actual availability"
            />
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <RaidBuilder
                members={members}
                raidSize={raidSize}
                onRaidSizeChange={setRaidSize}
                builder={builder}
                onBuilderChange={setBuilder}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 mt-16 py-5 text-center">
        <div className="flex items-center justify-center gap-3 text-xs text-gray-700">
          <span>⚔</span>
          <span>WoW Forever – Alliance Guild Raid Tool</span>
          <span>⚔</span>
          <span className="text-blue-800">For the Alliance!</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function StatBadge({
  label, value, color, bg, emoji
}: {
  label: string; value: number; color: string; bg: string; emoji?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${bg}`}>
      {emoji && <span className="text-sm leading-none">{emoji}</span>}
      <span className={`text-lg font-black leading-none ${color}`}>{value}</span>
      <span className="text-xs text-gray-500 leading-none">{label}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-black text-white">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function BestTimes({ members, raidSize }: { members: RosterMember[]; raidSize: RaidSize }) {
  const DAYS_LIST = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const DAY_LABELS: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  };

  const reqs = { 10: { tanks: 2, healers: 2 }, 20: { tanks: 3, healers: 4 }, 40: { tanks: 4, healers: 8 } }[raidSize];

  const windows = DAYS_LIST.flatMap((day) =>
    RAID_TIME_OPTIONS.map((time) => {
      const counts = countWindowAvailability(members, day, time);
      return {
        day,
        time,
        ...counts,
        hasEnoughTanks: counts.tanks >= reqs.tanks,
        hasEnoughHealers: counts.healers >= reqs.healers,
      };
    })
  ).filter((window) => window.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.tanks !== a.tanks) return b.tanks - a.tanks;
      return b.healers - a.healers;
    })
    .slice(0, 10);

  return (
    <div className="space-y-2">
      {windows.map((w, i) => {
        const viable = w.hasEnoughTanks && w.hasEnoughHealers && w.total >= raidSize;
        return (
          <div
            key={`${w.day}-${w.time}`}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
              viable ? 'border-green-700/50 bg-green-900/10' : 'border-gray-700/30 bg-gray-800/20'
            }`}
          >
            <div className={`text-xl font-black w-7 text-center flex-shrink-0 ${
              i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-700'
            }`}>
              {i + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">{DAY_LABELS[w.day]}</span>
                <span className="text-sm text-yellow-400 font-mono font-bold">@ {w.time} EST</span>
                {viable && (
                  <span className="text-xs bg-green-900/50 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">
                    ✓ Raid Ready
                  </span>
                )}
              </div>
              <div className="flex gap-4 mt-1 text-xs">
                <span className={`flex items-center gap-1 ${w.hasEnoughTanks ? 'text-blue-400' : 'text-orange-400'}`}>🛡️ {w.tanks} {!w.hasEnoughTanks && '⚠️'}</span>
                <span className={`flex items-center gap-1 ${w.hasEnoughHealers ? 'text-green-400' : 'text-orange-400'}`}>💚 {w.healers} {!w.hasEnoughHealers && '⚠️'}</span>
                <span className="text-red-400 flex items-center gap-1">⚔️ {w.dps}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="text-2xl font-black text-white leading-none">{w.total}</div>
                <div className="text-xs text-gray-600">/ {members.length}</div>
              </div>
              <div className="w-16 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${viable ? 'bg-green-500' : i < 3 ? 'bg-yellow-500' : 'bg-blue-600'}`}
                  style={{ width: `${(w.total / members.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-xs text-gray-600 pt-2">These windows count players who are open, exact-match, or already available by that time.</p>
    </div>
  );
}
