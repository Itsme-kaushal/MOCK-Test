import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { repository } from '../lib/db/dexieRepository';
import { evaluateAttempt } from '../lib/scoring/engine';
import { Attempt, Question, Section } from '../types/schema';
import { Badge } from '../components/common/Badge';
import { MathMarkdown } from '../components/common/MathMarkdown';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Award,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  Eye,
  PlayCircle,
  BarChart3,
  ShieldAlert,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

export const ResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [allAttempts, setAllAttempts] = useState<Attempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const list = await repository.getAttempts();
      const submittedList = list.filter((a) => a.status === 'submitted');
      setAllAttempts(submittedList);

      let target: Attempt | undefined;
      if (attemptId) {
        target = await repository.getAttemptById(attemptId);
      } else if (submittedList.length > 0) {
        target = submittedList[0];
      }

      if (target) {
        setSelectedAttempt(target);
        const rawQs = await repository.getQuestionsByIds(target.questionIds);
        const qMap = new Map(rawQs.map((q) => [q.id, q]));
        const orderedQs = target.questionIds
          .map((id) => qMap.get(id))
          .filter((q): q is Question => Boolean(q));
        setQuestions(orderedQs);

        const allSecs = await repository.getAllSections();
        setSections(allSecs);
      } else {
        setSelectedAttempt(null);
      }
      setLoading(false);
    };
    loadData();
  }, [attemptId]);

  const evaluation = useMemo(() => {
    if (!selectedAttempt || questions.length === 0) return null;
    return evaluateAttempt({
      questions,
      sections,
      answers: selectedAttempt.answers,
      timePerQ: selectedAttempt.timePerQ,
      config: selectedAttempt.config,
    });
  }, [selectedAttempt, questions, sections]);

  // Strongest & Weakest Sections
  const { strongestSection, weakestSection } = useMemo(() => {
    if (!evaluation || evaluation.sectionStats.length === 0) {
      return { strongestSection: null, weakestSection: null };
    }
    const sorted = [...evaluation.sectionStats].sort((a, b) => {
      const pctA = a.maxScore > 0 ? a.score / a.maxScore : 0;
      const pctB = b.maxScore > 0 ? b.score / b.maxScore : 0;
      return pctB - pctA;
    });
    return {
      strongestSection: sorted[0],
      weakestSection: sorted[sorted.length - 1],
    };
  }, [evaluation]);

  // Top 5 Slowest Questions
  const slowestQuestions = useMemo(() => {
    if (!selectedAttempt || questions.length === 0) return [];
    return [...questions]
      .map((q, idx) => {
        const timeSec = selectedAttempt.timePerQ[q.id] || 0;
        const selected = selectedAttempt.answers[q.id];
        const status =
          q.correctIndex === null
            ? 'Unset'
            : selected === null || selected === undefined
            ? 'Unattempted'
            : selected === q.correctIndex
            ? 'Correct'
            : 'Wrong';
        return {
          q,
          displayNo: idx + 1,
          timeSec,
          status,
        };
      })
      .sort((a, b) => b.timeSec - a.timeSec)
      .slice(0, 5);
  }, [selectedAttempt, questions]);

  // Attempt History Trend for the same targetId (paper or custom test)
  const samePaperHistory = useMemo(() => {
    if (!selectedAttempt) return [];
    return allAttempts
      .filter((a) => a.targetId === selectedAttempt.targetId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((a, idx) => ({
        attemptLabel: `#${idx + 1} (${new Date(a.startedAt).toLocaleDateString()})`,
        score: a.score,
        maxScore: a.totalPossibleMarks,
        accuracy: a.accuracy,
        id: a.id,
      }));
  }, [allAttempts, selectedAttempt]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    if (!selectedAttempt || !evaluation) return;

    const lines: string[] = [];
    lines.push(`"MockTest Studio — Result Summary"`);
    lines.push(`"Test Title","${selectedAttempt.title.replace(/"/g, '""')}"`);
    lines.push(`"Date","${new Date(selectedAttempt.startedAt).toLocaleString()}"`);
    lines.push(`"Final Score","${evaluation.score} / ${evaluation.totalPossibleMarks}"`);
    lines.push(`"Accuracy (%)","${evaluation.accuracy}%"`);
    lines.push(`"Attempted","${evaluation.attempted}"`);
    lines.push(`"Correct","${evaluation.correct}"`);
    lines.push(`"Wrong","${evaluation.wrong}"`);
    lines.push(`"Unattempted","${evaluation.unattempted}"`);
    lines.push(`"Negative Marks Lost","${evaluation.negativeMarksLost}"`);
    lines.push(`"Total Time (sec)","${evaluation.totalTimeSec}"`);
    lines.push('');
    lines.push(
      `"Section","Attempted","Correct","Wrong","Unattempted","Score","Max Score","Accuracy (%)","Time Spent (sec)"`
    );
    evaluation.sectionStats.forEach((sec) => {
      lines.push(
        `"${sec.sectionName.replace(/"/g, '""')}",${sec.attempted},${sec.correct},${sec.wrong},${sec.unattempted},${sec.score},${sec.maxScore},${sec.accuracy},${sec.timeSpentSec}`
      );
    });
    lines.push('');
    lines.push(
      `"Q.No","Topic","Selected Option","Correct Option","Status","Time Spent (sec)"`
    );
    questions.forEach((q, idx) => {
      const sel = selectedAttempt.answers[q.id];
      const selChar =
        sel !== null && sel !== undefined ? String.fromCharCode(65 + sel) : '-';
      const corChar =
        q.correctIndex !== null ? String.fromCharCode(65 + q.correctIndex) : 'NULL';
      const status =
        q.correctIndex === null
          ? 'Excluded (Null Answer)'
          : sel === null || sel === undefined
          ? 'Unattempted'
          : sel === q.correctIndex
          ? 'Correct'
          : 'Wrong';
      lines.push(
        `${idx + 1},"${(q.topic || 'General').replace(/"/g, '""')}","${selChar}","${corChar}","${status}",${
          selectedAttempt.timePerQ[q.id] || 0
        }`
      );
    });

    const csvBlob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mocktest-result-${selectedAttempt.id.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAttempt = async (id: string) => {
    if (!window.confirm('Delete this attempt record permanently?')) return;
    await repository.deleteAttempt(id);
    navigate('/results');
    const updated = (await repository.getAttempts()).filter(
      (a) => a.status === 'submitted'
    );
    setAllAttempts(updated);
    if (updated.length > 0) {
      navigate(`/results/${updated[0].id}`);
    } else {
      setSelectedAttempt(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        Loading analytics and scorecard...
      </div>
    );
  }

  if (!selectedAttempt || !evaluation) {
    return (
      <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 max-w-xl mx-auto my-8">
        <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          No Completed Test Attempts Yet
        </h2>
        <p className="text-xs text-slate-500">
          Take a Full Paper Mock or a Custom Test to generate section-wise tables, Recharts visualizations, topic accuracy, and answer reviews.
        </p>
        <button
          type="button"
          onClick={() => navigate('/create-test')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs"
        >
          <PlayCircle className="w-4 h-4" /> Create & Take a Test
        </button>
      </div>
    );
  }

  const pieData = [
    { name: 'Correct', value: evaluation.correct, color: '#10b981' },
    { name: 'Wrong', value: evaluation.wrong, color: '#f43f5e' },
    { name: 'Unattempted', value: evaluation.unattempted, color: '#94a3b8' },
  ];

  const timeChartData = questions.map((q, idx) => {
    const sel = selectedAttempt.answers[q.id];
    const status =
      q.correctIndex === null
        ? 'Excluded'
        : sel === null || sel === undefined
        ? 'Unattempted'
        : sel === q.correctIndex
        ? 'Correct'
        : 'Wrong';
    return {
      qLabel: `Q${idx + 1}`,
      seconds: selectedAttempt.timePerQ[q.id] || 0,
      status,
    };
  });

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Attempt Switcher & Export Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs print:border-none print:p-0">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="indigo">{selectedAttempt.exam}</Badge>
            <span className="text-xs text-slate-500">
              Submitted {new Date(selectedAttempt.submittedAt || selectedAttempt.startedAt).toLocaleString()}
            </span>
            {selectedAttempt.tabSwitchCount > 0 && (
              <Badge variant="rose">
                <ShieldAlert className="w-3.5 h-3.5" /> {selectedAttempt.tabSwitchCount} Tab Switch(es)
              </Badge>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            {selectedAttempt.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {allAttempts.length > 1 && (
            <select
              value={selectedAttempt.id}
              onChange={(e) => navigate(`/results/${e.target.value}`)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              {allAttempts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} — {a.score}/{a.totalPossibleMarks} (
                  {new Date(a.startedAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => navigate(`/review/${selectedAttempt.id}`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Review Answers</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>

          <button
            type="button"
            onClick={() => handleDeleteAttempt(selectedAttempt.id)}
            title="Delete Attempt"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Excluded Null-Answer Notice */}
      {evaluation.excludedNullAnswerQuestions > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Note:</strong> {evaluation.excludedNullAnswerQuestions} question(s) were withdrawn or had no usable answer key and were excluded from maximum marks and scoring.
          </span>
        </div>
      )}

      {/* Primary Scorecard Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="col-span-2 p-4 rounded-2xl bg-indigo-600 text-white shadow-sm">
          <div className="text-xs font-medium text-indigo-200">Final Score</div>
          <div className="text-2xl sm:text-3xl font-extrabold mt-1">
            {evaluation.score}{' '}
            <span className="text-base font-normal text-indigo-200">
              / {evaluation.totalPossibleMarks}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Accuracy</div>
          <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
            {evaluation.accuracy}%
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Attempted</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {evaluation.attempted} / {evaluation.scorableQuestions}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Correct
          </div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">
            {evaluation.correct}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Wrong
          </div>
          <div className="text-xl font-extrabold text-rose-600 mt-1">
            {evaluation.wrong}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1">
            <MinusCircle className="w-3.5 h-3.5" /> Neg. Lost
          </div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">
            -{evaluation.negativeMarksLost}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Time Taken
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {formatSeconds(evaluation.totalTimeSec)}
          </div>
        </div>
      </div>

      {/* SECTION-WISE PERFORMANCE TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Section-Wise Breakdown
          </h2>
          {strongestSection && weakestSection && evaluation.sectionStats.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="emerald">
                <TrendingUp className="w-3.5 h-3.5" /> Strongest: {strongestSection.sectionName}
              </Badge>
              <Badge variant="rose">
                <TrendingDown className="w-3.5 h-3.5" /> Needs Work: {weakestSection.sectionName}
              </Badge>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Section</th>
                <th className="px-4 py-3 text-center font-bold">Attempted</th>
                <th className="px-4 py-3 text-center font-bold text-emerald-600">Correct</th>
                <th className="px-4 py-3 text-center font-bold text-rose-600">Wrong</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500">Unattempted</th>
                <th className="px-4 py-3 text-center font-bold text-indigo-600">Score</th>
                <th className="px-4 py-3 text-center font-bold">Accuracy</th>
                <th className="px-4 py-3 text-right font-bold">Time Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {evaluation.sectionStats.map((sec) => (
                <tr
                  key={sec.sectionId}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {sec.sectionName}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {sec.attempted} / {sec.scorableQuestions}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600">
                    {sec.correct}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-rose-600">
                    {sec.wrong}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {sec.unattempted}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                    {sec.score} / {sec.maxScore}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={
                        sec.accuracy >= 75
                          ? 'emerald'
                          : sec.accuracy >= 50
                          ? 'amber'
                          : 'rose'
                      }
                    >
                      {sec.accuracy}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatSeconds(sec.timeSpentSec)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECHARTS VISUALIZATIONS: Section Bar Chart & Correct/Wrong/Unattempted Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Section-Wise Score vs Max Score
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evaluation.sectionStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="sectionName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" name="Obtained Score" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="maxScore" name="Max Score" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Response Distribution (Correct / Wrong / Unattempted)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Time-Per-Question Bar Chart & Attempt History Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Time Spent Per Question (Seconds)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="qLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="seconds"
                  name="Time (seconds)"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Attempt Score Trend (This Paper / Test)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={samePaperHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="attemptLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Score"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Accuracy (%)"
                  stroke="#6366f1"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Topic-Wise Accuracy & Slowest Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic-Wise Accuracy Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Topic-Wise Accuracy Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-2 text-left">Topic</th>
                  <th className="py-2 text-center">Attempted</th>
                  <th className="py-2 text-center">Correct</th>
                  <th className="py-2 text-center">Accuracy</th>
                  <th className="py-2 text-right">Avg Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {evaluation.topicStats.map((tp) => (
                  <tr key={tp.topic}>
                    <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                      {tp.topic}
                    </td>
                    <td className="py-2.5 text-center">
                      {tp.attempted} / {tp.total}
                    </td>
                    <td className="py-2.5 text-center text-emerald-600 font-semibold">
                      {tp.correct}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge
                        variant={
                          tp.accuracy >= 75
                            ? 'emerald'
                            : tp.accuracy >= 50
                            ? 'amber'
                            : 'rose'
                        }
                      >
                        {tp.accuracy}%
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-500">
                      {tp.avgTimeSec}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slowest Questions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Slowest Questions (Time Sink Analysis)
          </h3>
          <div className="space-y-2.5">
            {slowestQuestions.map(({ q, displayNo, timeSec, status }) => (
              <div
                key={q.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      Q.{displayNo}
                    </span>
                    <Badge variant="purple">{q.topic}</Badge>
                    <Badge
                      variant={
                        status === 'Correct'
                          ? 'emerald'
                          : status === 'Wrong'
                          ? 'rose'
                          : 'slate'
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 line-clamp-2">
                    <MathMarkdown content={q.text} />
                  </div>
                </div>
                <div className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400 shrink-0">
                  {formatSeconds(timeSec)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
