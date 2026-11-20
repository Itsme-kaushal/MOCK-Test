import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBankStore } from '../store/useBankStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { repository } from '../lib/db/dexieRepository';
import { createNewTestAttempt } from '../store/useTestSessionStore';
import {
  Question,
  Section,
  TestLanguage,
  CustomTest,
} from '../types/schema';
import { Badge } from '../components/common/Badge';
import {
  PlayCircle,
  Sliders,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shuffle,
  Languages,
  Lock,
  Sparkles,
  Bookmark,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';

export const CreateTestPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPaperId = searchParams.get('paperId');

  const { papers, sections, facets, refreshAll } = useBankStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const defaultLanguage = useSettingsStore((s) => s.defaultLanguage);

  const [mode, setMode] = useState<'full' | 'custom'>('full');

  // Mode A: Full Paper Selection
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');

  // Mode B: Custom Test Filters
  const [customName, setCustomName] = useState<string>('Custom Practice Set');
  const [customExams, setCustomExams] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [customBookmarkedOnly, setCustomBookmarkedOnly] = useState<boolean>(false);
  const [customRevisionOnly, setCustomRevisionOnly] = useState<boolean>(false);
  const [customPreviouslyWrongOnly, setCustomPreviouslyWrongOnly] =
    useState<boolean>(false);
  const [customQuestionLimit, setCustomQuestionLimit] = useState<number>(20);
  const [savedCustomTests, setSavedCustomTests] = useState<CustomTest[]>([]);
  const [wrongIdsSet, setWrongIdsSet] = useState<Set<string>>(new Set());

  // Shared Test Setup Configuration
  const [durationMin, setDurationMin] = useState<number>(120);
  const [perSectionDuration, setPerSectionDuration] = useState<boolean>(false);
  const [sectionLock, setSectionLock] = useState<boolean>(false);
  const [markingCorrect, setMarkingCorrect] = useState<number>(1);
  const [markingNegative, setMarkingNegative] = useState<number>(0.25);
  const [useSectionMarkingOverride, setUseSectionMarkingOverride] =
    useState<boolean>(true);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(false);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(false);
  const [language, setLanguage] = useState<TestLanguage>('en');

  // Instructions Step Toggle
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [agreedToRules, setAgreedToRules] = useState<boolean>(true);

  useEffect(() => {
    refreshAll();
    repository.getQuestions().then(setQuestions);
    repository.getCustomTests().then(setSavedCustomTests);
    repository.getPreviouslyWrongQuestionIds().then(setWrongIdsSet);
  }, [refreshAll]);

  useEffect(() => {
    if (preselectedPaperId) {
      setMode('full');
      setSelectedPaperId(preselectedPaperId);
    } else if (papers.length > 0 && !selectedPaperId) {
      setSelectedPaperId(papers[0].id);
    }
  }, [preselectedPaperId, papers, selectedPaperId]);

  const filteredPapersForFullMode = useMemo(() => {
    return papers.filter((p) => {
      if (selectedExam && p.exam !== selectedExam) return false;
      if (selectedYear !== '' && p.year !== Number(selectedYear)) return false;
      return true;
    });
  }, [papers, selectedExam, selectedYear]);

  const activeFullPaper = useMemo(
    () => papers.find((p) => p.id === selectedPaperId),
    [papers, selectedPaperId]
  );

  // Sync setup defaults when a Full Paper is selected
  useEffect(() => {
    if (mode === 'full' && activeFullPaper) {
      setDurationMin(120);
      setMarkingCorrect(activeFullPaper.markingCorrect);
      setMarkingNegative(activeFullPaper.markingNegative);
    }
  }, [mode, activeFullPaper]);

  const paperMap = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);
  const sectionMap = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  // Calculate candidate questions for Mode A or Mode B
  const candidateQuestions: Question[] = useMemo(() => {
    if (mode === 'full') {
      if (!selectedPaperId) return [];
      const paperSections = sections
        .filter((s) => s.paperId === selectedPaperId)
        .sort((a, b) => a.order - b.order);
      const secOrderMap = new Map(paperSections.map((s, idx) => [s.id, idx]));

      return questions
        .filter((q) => q.paperId === selectedPaperId)
        .sort((a, b) => {
          const secDiff =
            (secOrderMap.get(a.sectionId) ?? 0) -
            (secOrderMap.get(b.sectionId) ?? 0);
          if (secDiff !== 0) return secDiff;
          return a.qNo - b.qNo;
        });
    }

    // Custom Mode
    const pool = questions.filter((q) => {
      const p = paperMap.get(q.paperId);
      const s = sectionMap.get(q.sectionId);
      if (customExams.length > 0 && (!p || !customExams.includes(p.exam)))
        return false;
      if (customSections.length > 0 && (!s || !customSections.includes(s.name)))
        return false;
      if (customTopics.length > 0 && !customTopics.includes(q.topic))
        return false;
      if (customBookmarkedOnly && !q.bookmarked) return false;
      if (customRevisionOnly && !q.inRevisionList) return false;
      if (customPreviouslyWrongOnly && !wrongIdsSet.has(q.id)) return false;
      return true;
    });

    return pool.slice(0, Math.max(1, customQuestionLimit));
  }, [
    mode,
    selectedPaperId,
    questions,
    sections,
    paperMap,
    sectionMap,
    customExams,
    customSections,
    customTopics,
    customBookmarkedOnly,
    customRevisionOnly,
    customPreviouslyWrongOnly,
    customQuestionLimit,
    wrongIdsSet,
  ]);

  const nullAnswerQuestions = useMemo(
    () => candidateQuestions.filter((q) => q.correctIndex === null || q.answerStatus === 'withdrawn'),
    [candidateQuestions]
  );

  const hasHindiContent = useMemo(
    () => candidateQuestions.some((q) => q.textHi && q.textHi.trim().length > 0),
    [candidateQuestions]
  );

  const toggleArrayFilter = (
    list: string[],
    item: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleSaveCustomTestTemplate = async () => {
    if (candidateQuestions.length === 0) return;
    const newCustom: CustomTest = {
      id: crypto.randomUUID(),
      name: customName.trim() || 'Custom Test',
      questionIds: candidateQuestions.map((q) => q.id),
      durationMin,
      sectionLock,
      markingCorrect,
      markingNegative,
      shuffleQuestions,
      shuffleOptions,
      language,
      createdAt: new Date().toISOString(),
    };
    await repository.saveCustomTest(newCustom);
    const updated = await repository.getCustomTests();
    setSavedCustomTests(updated);
  };

  const handleLaunchSavedCustomTest = async (ct: CustomTest) => {
    const qs = await repository.getQuestionsByIds(ct.questionIds);
    if (qs.length === 0) return;
    const attempt = await createNewTestAttempt({
      targetId: ct.id,
      targetType: 'custom',
      title: ct.name,
      exam: 'Custom Test',
      questions: qs,
      config: {
        durationMin: ct.durationMin,
        sectionLock: ct.sectionLock,
        perSectionDuration: false,
        markingCorrect: ct.markingCorrect,
        markingNegative: ct.markingNegative,
        useSectionMarkingOverride: false,
        shuffleQuestions: ct.shuffleQuestions,
        shuffleOptions: ct.shuffleOptions,
        language: ct.language,
      },
    });
    navigate(`/test/${attempt.id}`);
  };

  const handleStartTest = async () => {
    if (candidateQuestions.length === 0) return;

    const title =
      mode === 'full' && activeFullPaper
        ? `${activeFullPaper.paperName} (${activeFullPaper.shift})`
        : customName.trim() || 'Custom Mock Test';

    const exam =
      mode === 'full' && activeFullPaper ? activeFullPaper.exam : 'Custom Mock';

    const targetId =
      mode === 'full' && activeFullPaper
        ? activeFullPaper.id
        : crypto.randomUUID();

    const attempt = await createNewTestAttempt({
      targetId,
      targetType: mode === 'full' ? 'paper' : 'custom',
      title,
      exam,
      questions: candidateQuestions,
      config: {
        durationMin: mode === 'full' ? 120 : Math.max(1, durationMin),
        sectionLock,
        perSectionDuration,
        markingCorrect,
        markingNegative,
        useSectionMarkingOverride,
        shuffleQuestions,
        shuffleOptions,
        language,
      },
    });

    navigate(`/test/${attempt.id}`);
  };

  if (showInstructions) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <Badge variant="indigo">Mock Test Instructions</Badge>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {mode === 'full' && activeFullPaper
                  ? activeFullPaper.paperName
                  : customName}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200"
            >
              ← Back to Setup
            </button>
          </div>

          {/* Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500">Total Questions</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {candidateQuestions.length} Qs
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500">Duration</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {durationMin} Mins
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500">Marking Scheme</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                +{markingCorrect} / -{markingNegative}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500">Language Mode</div>
              <div className="text-lg font-bold capitalize text-slate-900 dark:text-white">
                {language}
              </div>
            </div>
          </div>

          {/* Null correctIndex Exclusion Banner */}
          {nullAnswerQuestions.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {nullAnswerQuestions.length} question(s) are withdrawn or have no usable key
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Questions{' '}
                <strong>
                  {nullAnswerQuestions.map((q) => `Q.${q.qNo}`).join(', ')}
                </strong>{' '}
                are <strong>excluded from scoring and accuracy calculations</strong>. The source notices remain in the question bank.
              </p>
            </div>
          )}

          {/* Palette Legend & Strict Rules */}
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <h3 className="font-bold text-slate-900 dark:text-white">
              Question Palette Symbols:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span>Grey: You have not visited the question yet.</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <span>Red: You have visited the question but NOT answered it.</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <span>Green: You have answered the question.</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <span>Purple: Marked for review (without an answer).</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 sm:col-span-2">
                <span className="relative w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  5
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">
                    ✓
                  </span>
                </span>
                <span>
                  Purple with Green Tick: Answered & Marked for Review (will be evaluated in final score).
                </span>
              </div>
            </div>

            <h3 className="font-bold text-slate-900 dark:text-white pt-2">
              Exam Rules & Keyboard Shortcuts:
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>No Pause (Strict Mode):</strong> The countdown timer is anchored to a fixed end timestamp and continues running even if you refresh or close the browser. At <code className="font-mono">00:00</code>, the test auto-submits immediately.
              </li>
              <li>
                <strong>Auto-Save:</strong> Every option selection, review mark, and per-question second is saved directly to IndexedDB.
              </li>
              <li>
                <strong>Keyboard Shortcuts:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">1</kbd>–<kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">4</kbd> to select an option, <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">N</kbd> for Next, <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">P</kbd> for Previous, and <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">M</kbd> to toggle Mark for Review.
              </li>
              <li>
                <strong>Tab-Switch Monitoring:</strong> Switching browser tabs or exiting fullscreen triggers a warning and logs the count on your attempt scorecard.
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToRules}
                onChange={(e) => setAgreedToRules(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>I have read and understood the instructions and strict timer rules.</span>
            </label>

            <button
              type="button"
              disabled={!agreedToRules || candidateQuestions.length === 0}
              onClick={handleStartTest}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors disabled:opacity-40"
            >
              <PlayCircle className="w-5 h-5" />
              <span>Start Timed Test Now</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <PlayCircle className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Create Timed Mock Test
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Take an imported exam shift as-is (Mode A) or build a targeted custom test from your Question Bank (Mode B).
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'full'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Mode A: Full Paper Mock
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'custom'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Mode B: Custom Test Builder
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Mode A or Mode B Selection */}
        <div className="lg:col-span-7 space-y-6">
          {mode === 'full' ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Pick an Exam, Year & Shift
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Filter by Exam
                  </label>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  >
                    <option value="">All Exams ({facets.exams.length})</option>
                    {facets.exams.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Filter by Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  >
                    <option value="">All Years</option>
                    {facets.years.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredPapersForFullMode.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">
                    No papers available in the Question Bank yet. Please import JSON questions first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPapersForFullMode.map((paper) => {
                    const isSelected = paper.id === selectedPaperId;
                    const pSecs = sections.filter((s) => s.paperId === paper.id);
                    const pQs = questions.filter((q) => q.paperId === paper.id);
                    const nullCount = pQs.filter((q) => q.correctIndex === null).length;

                    return (
                      <div
                        key={paper.id}
                        onClick={() => setSelectedPaperId(paper.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white">
                              {paper.paperName}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {paper.exam} • {paper.year} • {paper.date} • {paper.shift}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="indigo">{paper.durationMin}m</Badge>
                            <Badge variant="purple">{pQs.length} Qs</Badge>
                            <Badge variant="emerald">
                              +{paper.markingCorrect}/-{paper.markingNegative}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/70">
                          {pSecs.map((s) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300"
                            >
                              {s.name}
                            </span>
                          ))}
                          {nullCount > 0 && (
                            <span className="ml-auto text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              ⚠ {nullCount} Q(s) are excluded from scoring
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Mode B: Custom Test Builder */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Custom Test Builder
                </h2>
                <button
                  type="button"
                  onClick={handleSaveCustomTestTemplate}
                  disabled={candidateQuestions.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" /> Save Custom Test Template
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Custom Test Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., Weak Topics Mixed Drill"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Max Questions
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={customQuestionLimit}
                    onChange={(e) =>
                      setCustomQuestionLimit(parseInt(e.target.value, 10) || 10)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Special Filters: Bookmarked / Revision / Previously Wrong */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCustomBookmarkedOnly(!customBookmarkedOnly)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    customBookmarkedOnly
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" /> Bookmarked Only
                </button>

                <button
                  type="button"
                  onClick={() => setCustomRevisionOnly(!customRevisionOnly)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    customRevisionOnly
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Revision List Only
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCustomPreviouslyWrongOnly(!customPreviouslyWrongOnly)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    customPreviouslyWrongOnly
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Previously Wrong ({wrongIdsSet.size})
                </button>
              </div>

              {/* Section Multi-Select */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Sections (Click to filter, leave unselected for all)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {facets.sections.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() =>
                        toggleArrayFilter(customSections, sec, setCustomSections)
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        customSections.includes(sec)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Multi-Select */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Topics (Click to filter, leave unselected for all)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {facets.topics.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() =>
                        toggleArrayFilter(customTopics, tp, setCustomTopics)
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        customTopics.includes(tp)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved Custom Tests List */}
              {savedCustomTests.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Saved Custom Tests ({savedCustomTests.length})
                  </div>
                  <div className="space-y-2">
                    {savedCustomTests.map((ct) => (
                      <div
                        key={ct.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {ct.name}
                          </div>
                          <div className="text-slate-500">
                            {ct.questionIds.length} Qs • {ct.durationMin}m • +{ct.markingCorrect}/-{ct.markingNegative}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleLaunchSavedCustomTest(ct)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                          >
                            Launch
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await repository.deleteCustomTest(ct.id);
                              setSavedCustomTests(await repository.getCustomTests());
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Setup Options & Launch Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Test Configuration & Rules
            </h2>

            {/* Duration & Section Lock */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Total Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={durationMin}
                  disabled={mode === 'full'}
                  onChange={(e) =>
                    setDurationMin(Math.max(1, parseInt(e.target.value, 10) || 60))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                />
                {mode === 'full' && <p className="mt-2 text-xs text-slate-500">Full-paper practice is fixed at 2 hours. Only English-language sections are included.</p>}
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Lock switching between sections (Strict Section Order)
                </span>
                <input
                  type="checkbox"
                  checked={sectionLock}
                  onChange={(e) => setSectionLock(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
              </label>
            </div>

            {/* Marking Scheme */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Correct Answer (+)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min={0.25}
                  value={markingCorrect}
                  onChange={(e) =>
                    setMarkingCorrect(parseFloat(e.target.value) || 2)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Negative Marking (-)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={markingNegative}
                  onChange={(e) =>
                    setMarkingNegative(parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-rose-600"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer">
              <span>Honor per-section marking override (when defined in JSON)</span>
              <input
                type="checkbox"
                checked={useSectionMarkingOverride}
                onChange={(e) => setUseSectionMarkingOverride(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
            </label>

            {/* Shuffling Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-indigo-500" /> Shuffle Questions
                </span>
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-purple-500" /> Shuffle Options
                </span>
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
              </label>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-indigo-500" /> Exam Language Display
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['en', 'hi', 'bilingual'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                      language === lang
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Bilingual'}
                  </button>
                ))}
              </div>
              {!hasHindiContent && language !== 'en' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Note: Questions without <code className="font-mono">textHi</code> will automatically fall back to English.
                </p>
              )}
            </div>

            {/* Summary & Continue to Instructions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Selected Questions:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {candidateQuestions.length} Total (
                  {candidateQuestions.length - nullAnswerQuestions.length} Scorable)
                </span>
              </div>

              {nullAnswerQuestions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                  ⚠ {nullAnswerQuestions.length} question(s) have <code className="font-mono">correctIndex = null</code> and will be excluded from scoring.
                </div>
              )}

              <button
                type="button"
                disabled={candidateQuestions.length === 0}
                onClick={() => setShowInstructions(true)}
                className="w-full py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Proceed to Instructions ({candidateQuestions.length} Qs)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
