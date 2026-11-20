import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
} from 'react-router-dom';
import {
  LayoutDashboard,
  FileJson,
  Database,
  PlayCircle,
  BarChart3,
  Settings,
  Sun,
  Moon,
  BookOpenCheck,
  HelpCircle,
} from 'lucide-react';
import { useSettingsStore } from './store/useSettingsStore';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';
import { SchemaHelpPage } from './pages/SchemaHelpPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { CreateTestPage } from './pages/CreateTestPage';
import { TestRunnerPage } from './pages/TestRunnerPage';
import { ResultPage } from './pages/ResultPage';
import { PracticePage } from './pages/PracticePage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { initializeExtractedBank } from './lib/db/seed';

const AppShell: React.FC = () => {
  const { darkMode, toggleDarkMode } = useSettingsStore();
  const location = useLocation();

  // Hide top navigation during active strict exam mode (/test/:attemptId)
  const isStrictExamMode = location.pathname.startsWith('/test/');

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/practice', label: 'Practice', icon: BookOpenCheck },
    { to: '/import', label: 'Import JSON', icon: FileJson },
    { to: '/bank', label: 'Question Bank', icon: Database },
    { to: '/create-test', label: 'Create Test', icon: PlayCircle },
    { to: '/results', label: 'Analytics & History', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {!isStrictExamMode && (
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <BookOpenCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  MockTest Studio
                </span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  DSSSB Practice
                </span>
              </div>
            </NavLink>

            <nav className="flex items-center gap-1 overflow-x-auto py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={toggleDarkMode}
              title="Toggle Dark / Light Mode"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/schema-help" element={<SchemaHelpPage />} />
          <Route path="/bank" element={<QuestionBankPage />} />
          <Route path="/create-test" element={<CreateTestPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/test/:attemptId" element={<TestRunnerPage />} />
          <Route path="/results" element={<ResultPage />} />
          <Route path="/results/:attemptId" element={<ResultPage />} />
          <Route
            path="/review/:attemptId"
            element={<ReviewPage />}
          />
          <Route
            path="/settings"
            element={<SettingsPage />}
          />
        </Routes>
      </main>
    </div>
  );
};

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const initialize = () => { setError(''); initializeExtractedBank().then(() => setReady(true)).catch(e => setError(e instanceof Error ? e.message : String(e))); };
  useEffect(initialize, []);
  if (!ready) return <div className="max-w-xl mx-auto p-10"><h1 className="text-2xl font-bold">MockTest Studio</h1><p className="mt-3">{error || 'Preparing your extracted question bank...'}</p>{error && <button onClick={initialize} className="mt-4 rounded-xl bg-indigo-600 text-white px-5 py-2">Retry</button>}</div>;
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
