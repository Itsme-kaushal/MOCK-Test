import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useTestSessionStore,
  getQuestionPaletteStatus,
  PaletteStatus,
} from '../store/useTestSessionStore';
import { MathMarkdown } from '../components/common/MathMarkdown';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import {
  Clock,
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Flag,
  Eraser,
  Send,
  Languages,
  Maximize2,
  ShieldAlert,
} from 'lucide-react';
import { repository } from '../lib/db/dexieRepository';
import { TestLanguage } from '../types/schema';
import { remainingSeconds as calculateRemainingSeconds } from '../lib/timer';

export const TestRunnerPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const {
    attempt,
    questions,
    sections,
    currentIndex,
    isSubmitting,
    loadAttemptSession,
    selectOption,
    clearResponse,
    toggleMarkForReview,
    goToQuestionIndex,
    saveAndNext,
    markAndNext,
    previousQuestion,
    tickSecondOnCurrentQuestion,
    incrementTabSwitch,
    submitTest,
  } = useTestSessionStore();

  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [languageOverride, setLanguageOverride] = useState<TestLanguage | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [tabWarningBanner, setTabWarningBanner] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [bookmarkedLocal, setBookmarkedLocal] = useState<boolean>(false);

  // Load attempt on mount
  useEffect(() => {
    if (!attemptId) return;
    loadAttemptSession(attemptId).then((found) => {
      if (!found) {
        navigate('/create-test');
      }
    });
  }, [attemptId, loadAttemptSession, navigate]);

  // Redirect if already submitted
  useEffect(() => {
    if (attempt?.status === 'submitted') {
      navigate(`/results/${attempt.id}`, { replace: true });
    }
  }, [attempt?.status, attempt?.id, navigate]);

  const currentQuestion = questions[currentIndex];
  const activeLanguage = languageOverride ?? attempt?.config.language ?? 'bilingual';

  // Manage question image blob URL
  useEffect(() => {
    if (!currentQuestion) return;
    setBookmarkedLocal(Boolean(currentQuestion.bookmarked));
    if (currentQuestion.imageBlob) {
      const url = URL.createObjectURL(currentQuestion.imageBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (currentQuestion.imageUrl) {
      setImageUrl(currentQuestion.imageUrl);
    } else {
      setImageUrl(null);
    }
  }, [currentQuestion]);

  // Strict 1-second countdown timer anchored to attempt.endTime
  useEffect(() => {
    if (!attempt || attempt.status === 'submitted') return;

    const updateTimer = () => {
      const diffSec = calculateRemainingSeconds(attempt.endTime);
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        // Auto-submit at 00:00
        submitTest().then((id) => {
          if (id) navigate(`/results/${id}`, { replace: true });
        });
      } else {
        tickSecondOnCurrentQuestion();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [attempt?.id, attempt?.endTime, attempt?.status]);

  // Tab switch & fullscreen exit detection
  useEffect(() => {
    if (!attempt || attempt.status === 'submitted') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        incrementTabSwitch();
        setTabWarningBanner(
          'Strict Exam Mode Warning: Tab switch detected and logged on your attempt scorecard!'
        );
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        incrementTabSwitch();
        setTabWarningBanner(
          'Strict Exam Mode Warning: Exited fullscreen mode. This event has been logged.'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [attempt?.id, attempt?.status, incrementTabSwitch]);

  // Keyboard shortcuts: 1-4 choose option, N next, P previous, M mark for review
  useEffect(() => {
    if (!attempt || !currentQuestion || showSubmitModal) return;

    const perm =
      attempt.optionPermutations[currentQuestion.id] || ([0, 1, 2, 3] as const);

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const displayIdx = parseInt(e.key, 10) - 1;
        const originalOptionIdx = perm[displayIdx];
        selectOption(currentQuestion.id, originalOptionIdx);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        saveAndNext();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        previousQuestion();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMarkForReview(currentQuestion.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    attempt,
    currentQuestion,
    showSubmitModal,
    selectOption,
    saveAndNext,
    previousQuestion,
    toggleMarkForReview,
  ]);

  // Compute section tabs & counts
  const sectionGroups = useMemo(() => {
    if (!attempt) return [];
    const groups = new Map<
      string,
      {
        sectionId: string;
        sectionName: string;
        questionIndices: number[];
        answered: number;
        notAnswered: number;
        marked: number;
      }
    >();

    const secNameMap = new Map(sections.map((s) => [s.id, s.name]));

    questions.forEach((q, idx) => {
      const secId = q.sectionId || 'default';
      if (!groups.has(secId)) {
        groups.set(secId, {
          sectionId: secId,
          sectionName: secNameMap.get(secId) || `Section ${groups.size + 1}`,
          questionIndices: [],
          answered: 0,
          notAnswered: 0,
          marked: 0,
        });
      }
      const g = groups.get(secId)!;
      g.questionIndices.push(idx);

      const st = getQuestionPaletteStatus(attempt, q.id);
      if (st === 'answered' || st === 'answered_marked') g.answered++;
      else if (st === 'not_answered') g.notAnswered++;
      if (st === 'marked' || st === 'answered_marked') g.marked++;
    });

    return Array.from(groups.values());
  }, [attempt, questions, sections]);

  // Overall palette summary counts
  const paletteCounts = useMemo(() => {
    const counts = {
      not_visited: 0,
      not_answered: 0,
      answered: 0,
      marked: 0,
      answered_marked: 0,
    };
    if (!attempt) return counts;
    questions.forEach((q) => {
      const st = getQuestionPaletteStatus(attempt, q.id);
      counts[st]++;
    });
    return counts;
  }, [attempt, questions]);

  if (!attempt || !currentQuestion) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        Loading exam session...
      </div>
    );
  }

  const formatClock = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
        2,
        '0'
      )}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isLastFiveMinutes = remainingSeconds <= 300;
  const optionPerm =
    attempt.optionPermutations[currentQuestion.id] || ([0, 1, 2, 3] as const);
  const selectedOriginalIdx = attempt.answers[currentQuestion.id];
  const isCurrentMarked = attempt.markedForReview.includes(currentQuestion.id);
  const currentQuestionTimeSec = attempt.timePerQ[currentQuestion.id] || 0;

  const paletteButtonColor = (status: PaletteStatus, isCurrent: boolean) => {
    const ring = isCurrent
      ? 'ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-slate-900'
      : '';
    switch (status) {
      case 'not_visited':
        return `bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ${ring}`;
      case 'not_answered':
        return `bg-rose-600 text-white ${ring}`;
      case 'answered':
        return `bg-emerald-600 text-white ${ring}`;
      case 'marked':
        return `bg-purple-600 text-white ${ring}`;
      case 'answered_marked':
        return `bg-purple-600 text-white ${ring}`;
    }
  };

  const handleConfirmSubmit = async () => {
    const id = await submitTest();
    if (id) {
      navigate(`/results/${id}`, { replace: true });
    }
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] flex flex-col gap-4">
      {/* Top Exam Bar (Always-Visible Timer & Controls) */}
      <div className="sticky top-2 z-30 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="truncate">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {attempt.title}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Strict Mode (No Pause)</span>
              {attempt.tabSwitchCount > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  • Tab Switches: {attempt.tabSwitchCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Countdown Timer + Language + Submit */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Language Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <Languages className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            {(['en', 'hi', 'bilingual'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguageOverride(lang)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                  activeLanguage === lang
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
              } else {
                document.exitFullscreen?.().catch(() => {});
              }
            }}
            title="Toggle Fullscreen"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Countdown Timer Pill */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-extrabold text-sm sm:text-base border transition-all ${
              isLastFiveMinutes
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-md'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{formatClock(remainingSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Submit Test</span>
          </button>
        </div>
      </div>

      {/* Tab Switch Warning Banner */}
      {tabWarningBanner && (
        <div className="p-3 rounded-xl bg-rose-600 text-white text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{tabWarningBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setTabWarningBanner(null)}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section Tabs Bar */}
      {sectionGroups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sectionGroups.map((sec) => {
            const isActiveSec = currentQuestion.sectionId === sec.sectionId;
            const isLocked =
              attempt.config.sectionLock && !isActiveSec;

            return (
              <button
                key={sec.sectionId}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (sec.questionIndices.length > 0) {
                    goToQuestionIndex(sec.questionIndices[0]);
                  }
                }}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-all ${
                  isActiveSec
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : isLocked
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                }`}
              >
                <span>{sec.sectionName}</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {sec.answered}A
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                    {sec.notAnswered}U
                  </span>
                  {sec.marked > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                      {sec.marked}M
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Split Interface: Question Area (Left 8 cols) + Palette Sidebar (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Left: Question Viewer & Option Selection */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xs">
          <div className="space-y-5">
            {/* Question Metadata Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm font-extrabold">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <Badge variant="purple">{currentQuestion.topic || 'General'}</Badge>
                {currentQuestion.correctIndex === null && (
                  <Badge variant="amber">
                    <AlertTriangle className="w-3.5 h-3.5" /> Unset Answer (Excluded from Score)
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  +{currentQuestion.marks}
                </span>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  -{currentQuestion.negativeMarks}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ⏱ {currentQuestionTimeSec}s
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const next = await repository.toggleBookmark(currentQuestion.id);
                    setBookmarkedLocal(next);
                  }}
                  title="Bookmark this question"
                  className={`p-1.5 rounded-lg border transition-colors ${
                    bookmarkedLocal
                      ? 'text-amber-500 border-amber-300 bg-amber-50 dark:bg-amber-950/50'
                      : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-600'
                  }`}
                >
                  <Bookmark className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Question Stem (English / Hindi / Bilingual) */}
            <div className="space-y-3 py-1">
              {(activeLanguage === 'en' ||
                activeLanguage === 'bilingual' ||
                !currentQuestion.textHi) && (
                <MathMarkdown
                  content={currentQuestion.text}
                  className="text-base sm:text-lg text-slate-900 dark:text-slate-100 font-medium leading-relaxed"
                />
              )}

              {(activeLanguage === 'hi' || activeLanguage === 'bilingual') &&
                currentQuestion.textHi && (
                  <MathMarkdown
                    content={currentQuestion.textHi}
                    className={`text-base text-slate-700 dark:text-slate-300 leading-relaxed ${
                      activeLanguage === 'bilingual'
                        ? 'pl-3.5 border-l-2 border-indigo-300 dark:border-indigo-700'
                        : ''
                    }`}
                  />
                )}
            </div>

            {/* Attached Image if present */}
            {imageUrl && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white inline-block">
                <img
                  src={imageUrl}
                  alt={currentQuestion.imageDescription || 'Question figure'}
                  className="max-h-72 object-contain rounded-lg"
                />
                {currentQuestion.imageDescription && (
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    {currentQuestion.imageDescription}
                  </p>
                )}
              </div>
            )}

            {/* 4 Options List */}
            <div className="space-y-3 pt-2">
              {optionPerm.map((originalOptionIdx, displayIdx) => {
                const isSelected = selectedOriginalIdx === originalOptionIdx;
                const optEn = currentQuestion.options[originalOptionIdx];
                const optHi = currentQuestion.optionsHi?.[originalOptionIdx];

                return (
                  <button
                    key={originalOptionIdx}
                    type="button"
                    onClick={() =>
                      selectOption(currentQuestion.id, originalOptionIdx)
                    }
                    className={`w-full text-left flex items-start gap-3.5 p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {String.fromCharCode(65 + displayIdx)}
                    </span>

                    <div className="flex-1 min-w-0 space-y-1">
                      {(activeLanguage === 'en' ||
                        activeLanguage === 'bilingual' ||
                        !optHi) && (
                        <MathMarkdown
                          content={optEn}
                          className="text-sm sm:text-base text-slate-900 dark:text-slate-100"
                        />
                      )}
                      {(activeLanguage === 'hi' ||
                        activeLanguage === 'bilingual') &&
                        optHi && (
                          <MathMarkdown
                            content={optHi}
                            className="text-xs sm:text-sm text-slate-600 dark:text-slate-400"
                          />
                        )}
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 shrink-0 self-center">
                      [{displayIdx + 1}]
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Exam Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-6 mt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={previousQuestion}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Previous (P)
              </button>

              <button
                type="button"
                onClick={markAndNext}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  isCurrentMarked
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Mark for Review & Next (M)</span>
              </button>

              <button
                type="button"
                onClick={() => clearResponse(currentQuestion.id)}
                disabled={
                  selectedOriginalIdx === undefined ||
                  selectedOriginalIdx === null
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                <Eraser className="w-3.5 h-3.5" /> Clear Response
              </button>
            </div>

            <button
              type="button"
              onClick={saveAndNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs"
            >
              <span>Save & Next (N)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Question Palette & Status Legend (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Question Palette
            </h2>

            {/* Legend Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {paletteCounts.answered}
                </span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-rose-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {paletteCounts.not_answered}
                </span>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-[10px]">
                  {paletteCounts.not_visited}
                </span>
                <span>Not Visited</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {paletteCounts.marked}
                </span>
                <span>Marked Review</span>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <span className="relative w-5 h-5 rounded bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {paletteCounts.answered_marked}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]">
                    ✓
                  </span>
                </span>
                <span>Answered & Marked for Review (Evaluated)</span>
              </div>
            </div>

            {/* Question Number Buttons Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2.5 max-h-96 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const status = getQuestionPaletteStatus(attempt, q.id);
                const isCurrent = idx === currentIndex;
                const lockedBySection =
                  attempt.config.sectionLock &&
                  q.sectionId !== currentQuestion.sectionId;

                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={lockedBySection}
                    onClick={() => goToQuestionIndex(idx)}
                    className={`relative h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${paletteButtonColor(
                      status,
                      isCurrent
                    )} ${lockedBySection ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-90'}`}
                  >
                    {idx + 1}
                    {status === 'answered_marked' && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shadow-2xs">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keyboard Shortcut Helper + Submit Button */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">1-4</kbd> Option
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">N</kbd> Next
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">P</kbd> Prev
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">M</kbd> Mark
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-colors"
            >
              Submit Mock Test
            </button>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Confirm Test Submission"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to submit your test? Here is a summary of your responses:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <div className="text-xl font-extrabold text-emerald-600">
                {paletteCounts.answered + paletteCounts.answered_marked}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Answered
              </div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
              <div className="text-xl font-extrabold text-rose-600">
                {paletteCounts.not_answered + paletteCounts.not_visited}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Unanswered
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 col-span-2 sm:col-span-1">
              <div className="text-xl font-extrabold text-purple-600">
                {paletteCounts.marked + paletteCounts.answered_marked}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Marked for Review
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Return to Test
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmSubmit}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Yes, Final Submit'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
