import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { repository } from '../lib/db/dexieRepository';
import { downloadJsonFile } from '../lib/import/exporter';

export function SettingsPage() {
  const { darkMode, setDarkMode } = useSettingsStore();
  const [error, setError] = useState('');
  return <div className="max-w-2xl space-y-6"><h1 className="text-2xl font-bold">Settings & backup</h1>
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"><label className="flex justify-between text-sm font-semibold">Dark appearance<input type="checkbox" checked={darkMode} onChange={e => setDarkMode(e.target.checked)} /></label><p className="text-sm text-slate-500">Your answers, bookmarks and test history are saved in this browser. Keep using the same browser and website address to retain them.</p><button onClick={async () => { try { downloadJsonFile(await repository.exportToJson(), 'mocktest-question-bank-backup.json'); } catch(e) { setError(String(e)); } }} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Export question bank</button><p className="text-xs text-slate-500">The JSON export includes questions, answer keys and source references. Keep the project’s question-assets folder with it to preserve embedded images. Attempt history and bookmarks stay in this browser.</p>{error && <p role="alert">{error}</p>}</div>
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"><h2 className="font-bold">Source & extraction details</h2><p className="text-sm text-slate-500">English-language content is included across all sections. Hindi subject sections are omitted. Chapter and topic labels use keyword-assisted classification and can be edited in the question bank.</p><a href="/extraction-report.json" target="_blank" rel="noreferrer" className="block text-sm text-indigo-600">Open extraction report</a><Link to="/schema-help" className="block text-sm text-indigo-600">Import format reference</Link></div>
  </div>;
}
