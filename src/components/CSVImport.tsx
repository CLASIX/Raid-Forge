import { useMemo, useRef, useState } from 'react';
import { FileText, X, Check, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { RosterMember } from '../types';
import { DEFAULT_CSV, parseRosterFile, parseRosterText } from '../utils/rosterImport';

interface Props {
  onImport: (members: RosterMember[], sourceLabel: string) => void;
  memberCount: number;
}

const SUPPORTED_FILES = ['.xlsx', '.ods', '.csv', '.tsv', '.html'];

export function CSVImport({ onImport, memberCount }: Props) {
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSource, setLastSource] = useState('Sample roster');
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = useMemo(() => '.xlsx,.xls,.ods,.csv,.tsv,.txt,.html,.htm', []);

  const completeImport = (members: RosterMember[], sourceLabel: string) => {
    if (members.length === 0) {
      setError('No roster rows were detected. Try exporting the Google Sheet as .xlsx or paste the full sheet with headers.');
      return;
    }

    setError('');
    setLastSource(sourceLabel);
    onImport(members, sourceLabel);
  };

  const handleTextImport = () => {
    const members = parseRosterText(text);
    completeImport(members, 'Pasted sheet data');
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setError('');

    try {
      const result = await parseRosterFile(file);
      completeImport(result.members, result.sourceLabel);
    } catch (err) {
      setError('That file could not be read. Recommended export: Microsoft Excel (.xlsx).');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  const loadSample = () => {
    const members = parseRosterText(DEFAULT_CSV);
    setText(DEFAULT_CSV);
    completeImport(members, 'Built-in sample roster');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: '.xlsx', sub: 'Best choice', active: true },
          { label: '.ods', sub: 'Works too' },
          { label: '.tsv', sub: 'Great for copy/paste' },
          { label: '.csv', sub: 'Still supported' },
          { label: '.html', sub: 'Table export' },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border px-3 py-3 ${
              item.active
                ? 'border-yellow-600/60 bg-yellow-900/15'
                : 'border-gray-700/50 bg-gray-800/30'
            }`}
          >
            <div className="text-sm font-bold text-white">{item.label}</div>
            <div className={`text-xs mt-0.5 ${item.active ? 'text-yellow-400' : 'text-gray-500'}`}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
          dragging
            ? 'border-yellow-400 bg-yellow-400/10'
            : 'border-gray-600 hover:border-gray-400 bg-gray-800/30'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await handleFile(file);
            e.currentTarget.value = '';
          }}
        />
        <FileSpreadsheet className="w-9 h-9 mx-auto mb-3 text-yellow-400" />
        <p className="text-sm text-gray-200 font-semibold">Drop a spreadsheet here or click to upload</p>
        <p className="text-xs text-gray-500 mt-1">Recommended: export from Google Sheets as Microsoft Excel (.xlsx)</p>
        <p className="text-xs text-gray-600 mt-2">Supported: {SUPPORTED_FILES.join(' · ')}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative rounded-2xl border border-gray-700/50 bg-gray-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300 font-medium">Or paste directly from Google Sheets:</span>
          {memberCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-400 bg-green-900/40 px-2 py-0.5 rounded-full border border-green-700/50">
              <Check className="w-3 h-3" />
              {memberCount} members loaded
            </span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste copied rows from Google Sheets here. TSV and CSV both work. Keep the header row if possible."
          className="w-full h-36 bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-yellow-500 placeholder-gray-600"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleTextImport}
            disabled={!text.trim() || loading}
            className="flex-1 min-w-40 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Importing…' : 'Parse Pasted Data'}
          </button>
          <button
            onClick={() => {
              setText('');
              setError('');
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            title="Clear pasted data"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={loadSample}
            className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs transition-colors whitespace-nowrap"
            title="Load sample data"
          >
            Load Sample
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-800/30 bg-blue-950/20 p-4 text-sm">
        <p className="font-semibold text-blue-300">Best recommendation: Microsoft Excel (.xlsx)</p>
        <p className="text-blue-200/80 mt-1 text-xs leading-relaxed">
          .xlsx keeps the real sheet columns intact, including Monday through Sunday headers and blank cells,
          so missing days stay lined up correctly. That makes it much safer than raw CSV when people skip days.
        </p>
        <p className="text-gray-500 mt-3 text-xs">Last source: {lastSource}</p>
      </div>
    </div>
  );
}
