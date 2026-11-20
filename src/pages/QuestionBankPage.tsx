import React, { useEffect, useState } from 'react';
import { useBankStore } from '../store/useBankStore';
import { repository } from '../lib/db/dexieRepository';
import { downloadJsonFile } from '../lib/import/exporter';
import { Question, CorrectIndex } from '../types/schema';
import { QuestionCard } from '../components/bank/QuestionCard';
import { QuestionEditorModal } from '../components/bank/QuestionEditorModal';
import { Badge } from '../components/common/Badge';
import {
  Database,
  Search,
  Filter,
  Plus,
  Download,
  AlertTriangle,
  Bookmark,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  ListChecks,
} from 'lucide-react';

export const QuestionBankPage: React.FC = () => {
  const {
    papers,
    sections,
    questions,
    stats,
    facets,
    filter,
    isLoading,
    setFilter,
    resetFilter,
    refreshAll,
  } = useBankStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedPaperForAdd, setSelectedPaperForAdd] = useState<string>('');
  const [page, setPage] = useState(0);
  const [chapters, setChapters] = useState<string[]>([]);
  const pageSize = 25;

  useEffect(() => {
    refreshAll();
    repository.getQuestions().then(qs => setChapters([...new Set(qs.map(q => q.chapter || q.topic))].sort()));
  }, [refreshAll]);
  useEffect(() => setPage(0), [filter]);

  useEffect(() => {
    if (papers.length > 0 && !selectedPaperForAdd) {
      setSelectedPaperForAdd(papers[0].id);
    }
  }, [papers, selectedPaperForAdd]);

  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const handleQuickSetAnswer = async (id: string, idx: CorrectIndex) => {
    await repository.updateQuestion(id, { correctIndex: idx });
    await refreshAll();
  };

  const handleQuickAttachImage = async (id: string, file: File) => {
    await repository.attachQuestionImage(id, file);
    await refreshAll();
  };

  const handleToggleBookmark = async (id: string) => {
    await repository.toggleBookmark(id);
    await refreshAll();
  };

  const handleToggleRevision = async (id: string) => {
    await repository.toggleRevisionList(id);
    await refreshAll();
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Delete this question from the Question Bank?')) return;
    await repository.deleteQuestion(id);
    await refreshAll();
  };

  const handleDeletePaper = async (paperId: string) => {
    const p = paperMap.get(paperId);
    if (
      !window.confirm(
        `Delete paper "${p?.paperName}" and all its questions permanently?`
      )
    )
      return;
    await repository.deletePaper(paperId);
    if (filter.paperId === paperId) {
      await setFilter({ paperId: undefined });
    }
    await refreshAll();
  };

  const handleExportBank = async (paperId?: string) => {
    const payload = await repository.exportToJson(paperId);
    const filename = paperId
      ? `mocktest-paper-${paperId.slice(0, 8)}.json`
      : `mocktest-question-bank-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJsonFile(payload, filename);
  };

  const handleSaveQuestionModal = async (
    data: Omit<Question, 'id' | 'hash'>,
    existingId?: string
  ) => {
    if (existingId) {
      await repository.updateQuestion(existingId, data);
    } else {
      await repository.addQuestion(data);
    }
    await refreshAll();
  };

  const activePaperIdForModal = editingQuestion
    ? editingQuestion.paperId
    : filter.paperId || selectedPaperForAdd || papers[0]?.id || '';

  const modalSections = sections.filter(
    (s) => s.paperId === activePaperIdForModal
  );

  return (
    <div className="space-y-6">
      {/* Top Stats Dashboard Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-medium">Total Questions</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats?.totalQuestions ?? 0}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-medium">Papers / Shifts</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {stats?.totalPapers ?? 0}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFilter({ needsAttention: !filter.needsAttention })}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter.needsAttention
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs Attention
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats?.needsAttentionCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats?.missingAnswerCount ?? 0} withdrawn / keyless • {stats?.missingImageCount ?? 0} missing img
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilter({ bookmarkedOnly: !filter.bookmarkedOnly })}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter.bookmarkedOnly
              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5 text-amber-500" /> Bookmarked
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats?.bookmarkedCount ?? 0}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilter({ revisionOnly: !filter.revisionOnly })}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filter.revisionOnly
              ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5 text-purple-500" /> Revision List
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats?.revisionCount ?? 0}
          </div>
        </button>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-500 font-medium">Backup & Export</div>
          <button
            type="button"
            onClick={() => handleExportBank()}
            disabled={(stats?.totalPapers ?? 0) === 0}
            className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Export Full JSON
          </button>
        </div>
      </div>

      {/* Exam & Section Breakdown Pills */}
      {stats && (stats.questionsByExam.length > 0 || stats.questionsBySection.length > 0) && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              By Exam:
            </span>
            {stats.questionsByExam.map((item) => (
              <button
                key={item.exam}
                type="button"
                onClick={() =>
                  setFilter({
                    exam: filter.exam === item.exam ? undefined : item.exam,
                  })
                }
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter.exam === item.exam
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {item.exam}: <strong>{item.count} Qs</strong> ({item.papers} papers)
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              By Section:
            </span>
            {stats.questionsBySection.map((item) => (
              <button
                key={item.section}
                type="button"
                onClick={() =>
                  setFilter({
                    sectionName:
                      filter.sectionName === item.section ? undefined : item.section,
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  filter.sectionName === item.section
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {item.section} ({item.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Multi-Facet Filter Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filter.keyword || ''}
              onChange={(e) => setFilter({ keyword: e.target.value })}
              placeholder="Search questions, image text, chapters or topics..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Add Question & Reset Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {papers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingQuestion(null);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-2xs"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            )}

            <button
              type="button"
              onClick={resetFilter}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          </div>
        </div>

        {/* Dropdown Facets */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <select
            value={filter.paperId || ''}
            onChange={(e) => setFilter({ paperId: e.target.value || undefined })}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Papers ({papers.length})</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.paperName} ({p.shift})
              </option>
            ))}
          </select>

          <select
            value={filter.exam || ''}
            onChange={(e) => setFilter({ exam: e.target.value || undefined })}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Exams</option>
            {facets.exams.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>

          <select
            value={filter.year || ''}
            onChange={(e) =>
              setFilter({
                year: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Years</option>
            {facets.years.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <select
            value={filter.shift || ''}
            onChange={(e) => setFilter({ shift: e.target.value || undefined })}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Shifts</option>
            {facets.shifts.map((sh) => (
              <option key={sh} value={sh}>
                {sh}
              </option>
            ))}
          </select>

          <select
            value={filter.sectionName || ''}
            onChange={(e) =>
              setFilter({ sectionName: e.target.value || undefined })
            }
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Sections</option>
            {facets.sections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          <select
            aria-label="Chapter filter"
            value={filter.chapter || ''}
            onChange={e => setFilter({ chapter: e.target.value || undefined })}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Chapters</option>
            {chapters.map(chapter => <option key={chapter}>{chapter}</option>)}
          </select>

          <select
            value={filter.topic || ''}
            onChange={(e) => setFilter({ topic: e.target.value || undefined })}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="">All Topics</option>
            {facets.topics.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Paper Action Bar (Export Single Paper / Delete Paper) */}
        {filter.paperId && paperMap.get(filter.paperId) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="indigo">Active Paper Filter</Badge>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {paperMap.get(filter.paperId)?.paperName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportBank(filter.paperId)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-medium"
              >
                <Download className="w-3.5 h-3.5" /> Export This Paper JSON
              </button>
              <button
                type="button"
                onClick={() => handleDeletePaper(filter.paperId!)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Paper
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Count & Quick Filter Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-xs font-medium text-slate-500">
          Showing <strong>{questions.length}</strong> question(s)
          {isLoading ? ' (loading...)' : ''} • Tip: Click any option card to quickly set or change its correct answer.
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter({ hasImageOnly: !filter.hasImageOnly })}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              filter.hasImageOnly
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Has Image Only
          </button>
        </div>
      </div>

      {/* Question Cards List */}
      {questions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Database className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Questions Match Your Current Filter
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {(stats?.totalQuestions ?? 0) === 0
              ? 'Your Question Bank is currently empty. Head over to the Import JSON tab to load the sample dataset or upload your own JSON files.'
              : 'Try clearing some filters or searching for a different keyword.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.slice(page * pageSize, (page + 1) * pageSize).map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              paper={paperMap.get(q.paperId)}
              section={sectionMap.get(q.sectionId)}
              onEdit={(questionToEdit) => {
                setEditingQuestion(questionToEdit);
                setEditorOpen(true);
              }}
              onDelete={handleDeleteQuestion}
              onQuickSetAnswer={handleQuickSetAnswer}
              onQuickAttachImage={handleQuickAttachImage}
              onToggleBookmark={handleToggleBookmark}
              onToggleRevision={handleToggleRevision}
            />
          ))}
        </div>
      )}

      {questions.length > pageSize && <div className="flex justify-between items-center text-sm"><button disabled={page === 0} onClick={() => setPage(page-1)} className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-30">Previous page</button><span>Page {page+1} of {Math.ceil(questions.length/pageSize)}</span><button disabled={(page+1)*pageSize >= questions.length} onClick={() => setPage(page+1)} className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-30">Next page</button></div>}

      {/* Question Editor Modal */}
      <QuestionEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        question={editingQuestion}
        paperId={activePaperIdForModal}
        sections={modalSections}
        onSave={handleSaveQuestionModal}
      />
    </div>
  );
};
