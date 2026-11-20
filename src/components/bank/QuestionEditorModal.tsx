import React, { useState, useEffect } from 'react';
import {
  Question,
  Section,
  CorrectIndex,
} from '../../types/schema';
import { Modal } from '../common/Modal';
import { MathMarkdown } from '../common/MathMarkdown';
import { Upload, Trash2, Image as ImageIcon, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

interface QuestionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null; // null if creating a new question
  paperId: string;
  sections: Section[];
  onSave: (
    data: Omit<Question, 'id' | 'hash'>,
    existingId?: string
  ) => Promise<void>;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  isOpen,
  onClose,
  question,
  paperId,
  sections,
  onSave,
}) => {
  const [qNo, setQNo] = useState<number>(1);
  const [sectionId, setSectionId] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [textHi, setTextHi] = useState<string>('');
  const [options, setOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [optionsHi, setOptionsHi] = useState<[string, string, string, string]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<CorrectIndex>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [marks, setMarks] = useState<number>(2);
  const [negativeMarks, setNegativeMarks] = useState<number>(0.5);
  const [topic, setTopic] = useState<string>('General');
  const [chapter, setChapter] = useState('General');
  const [hasImage, setHasImage] = useState<boolean>(false);
  const [imageDescription, setImageDescription] = useState<string>('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (question) {
      setQNo(question.qNo);
      setSectionId(question.sectionId);
      setText(question.text);
      setTextHi(question.textHi || '');
      setOptions([...question.options] as [string, string, string, string]);
      setOptionsHi(
        question.optionsHi && question.optionsHi.length === 4
          ? ([...question.optionsHi] as [string, string, string, string])
          : ['', '', '', '']
      );
      setCorrectIndex(question.correctIndex);
      setExplanation(question.explanation || '');
      setMarks(question.marks);
      setNegativeMarks(question.negativeMarks);
      setTopic(question.topic || 'General');
      setChapter(question.chapter || question.topic || 'General');
      setHasImage(Boolean(question.hasImage));
      setImageDescription(question.imageDescription || '');
      setImageBlob(question.imageBlob ?? null);
    } else {
      setQNo(1);
      setSectionId(sections[0]?.id || '');
      setText('');
      setTextHi('');
      setOptions(['', '', '', '']);
      setOptionsHi(['', '', '', '']);
      setCorrectIndex(0);
      setExplanation('');
      setMarks(2);
      setNegativeMarks(0.5);
      setTopic('General');
      setChapter('General');
      setHasImage(false);
      setImageDescription('');
      setImageBlob(null);
    }
    setErrorMsg(null);
  }, [question, sections, isOpen]);

  useEffect(() => {
    if (imageBlob) {
      const url = URL.createObjectURL(imageBlob);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [imageBlob]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageBlob(file);
    setHasImage(true);
  };

  const handleOptionChange = (idx: number, val: string, isHindi = false) => {
    if (isHindi) {
      const next = [...optionsHi] as [string, string, string, string];
      next[idx] = val;
      setOptionsHi(next);
    } else {
      const next = [...options] as [string, string, string, string];
      next[idx] = val;
      setOptions(next);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setErrorMsg('Question text cannot be empty.');
      return;
    }
    if (!sectionId) {
      setErrorMsg('Please select a section.');
      return;
    }
    if (options.some((o) => !o.trim())) {
      setErrorMsg('All 4 English options must be filled.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave(
        {
          paperId: question ? question.paperId : paperId,
          sectionId,
          qNo: Number(qNo) || 1,
          text: text.trim(),
          textHi: textHi.trim(),
          options: options.map((o) => o.trim()) as [string, string, string, string],
          optionsHi: optionsHi.map((o) => o.trim()) as [string, string, string, string],
          correctIndex,
          explanation: explanation.trim(),
          marks: Number(marks) || 2,
          negativeMarks: Number(negativeMarks) || 0,
          topic: topic.trim() || 'General',
          chapter: chapter.trim() || 'General',
          hasImage,
          imageBlob,
          imageUrl: question?.imageUrl ?? null,
          imageDescription: imageDescription.trim(),
          bookmarked: question?.bookmarked ?? false,
          inRevisionList: question?.inRevisionList ?? false,
          tags: question?.tags ?? [],
        },
        question?.id
      );
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={question ? `Edit Question #${question.qNo}` : 'Add New Question'}
      maxWidthClass="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Top metadata row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Q. No
            </label>
            <input
              type="number"
              min={1}
              value={qNo}
              onChange={(e) => setQNo( parseInt(e.target.value, 10) || 1 )}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Section
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Marks (+)
            </label>
            <input
              type="number"
              step="0.25"
              min={0.25}
              value={marks}
              onChange={(e) => setMarks(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Negative (-)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
        </div>

        {/* Topic & Correct Answer Selector */}
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Chapter<input value={chapter} onChange={e => setChapter(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Topic Tag
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Algebra, Syllogism, Indian Polity"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Correct Option (`correctIndex`)
            </label>
            <div className="flex items-center gap-2">
              {([0, 1, 2, 3] as const).map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCorrectIndex(idx)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    correctIndex === idx
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Option {String.fromCharCode(65 + idx)} ({idx})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCorrectIndex(null)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  correctIndex === null
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                }`}
              >
                Unset (null)
              </button>
            </div>
          </div>
        </div>

        {/* Question Stem (English & Hindi) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Question Text (English — supports LaTeX `$...$` & Markdown tables)
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? 'Hide Math Preview' : 'Preview LaTeX/Table'}
              </button>
            </div>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter question stem..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Question Text (Hindi — optional `textHi`)
            </label>
            <textarea
              rows={4}
              value={textHi}
              onChange={(e) => setTextHi(e.target.value)}
              placeholder="हिंदी में प्रश्न (वैकल्पिक)..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
        </div>

        {showPreview && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Live Rendered Preview
            </div>
            <MathMarkdown content={text} className="text-sm text-slate-800 dark:text-slate-200" />
            {textHi && (
              <MathMarkdown
                content={textHi}
                className="text-sm text-slate-600 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700"
              />
            )}
          </div>
        )}

        {/* 4 Options (English & Hindi) */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Options (Exactly 4 required)
          </div>
          {([0, 1, 2, 3] as const).map((idx) => {
            const isCorrect = correctIndex === idx;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-colors ${
                  isCorrect
                    ? 'border-emerald-500/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Option {idx + 1} (index {idx})
                  </span>
                  {isCorrect && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={options[idx]}
                    onChange={(e) => handleOptionChange(idx, e.target.value, false)}
                    placeholder={`Option ${String.fromCharCode(65 + idx)} (English)`}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                  <input
                    type="text"
                    value={optionsHi[idx]}
                    onChange={(e) => handleOptionChange(idx, e.target.value, true)}
                    placeholder={`विकल्प ${String.fromCharCode(65 + idx)} (Hindi - optional)`}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Detailed Explanation (supports LaTeX `$...$`)
          </label>
          <textarea
            rows={3}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Step-by-step explanation shown during Answer Review..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
        </div>

        {/* Image Attachment Section (IndexedDB Blob) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={(e) => setHasImage(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <ImageIcon className="w-4 h-4 text-indigo-500" />
              <span>Question requires a diagram / figure (`hasImage`)</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{imageBlob ? 'Replace Image Blob' : 'Upload Image from Computer'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
              {imageBlob && (
                <button
                  type="button"
                  onClick={() => setImageBlob(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Image
                </button>
              )}
            </div>
          </div>

          <div>
            <input
              type="text"
              value={imageDescription}
              onChange={(e) => setImageDescription(e.target.value)}
              placeholder="Image description / alt text (e.g., Circle with chord AB = 16cm)"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          {imagePreviewUrl && (
            <div className="pt-2">
              <div className="text-xs text-slate-500 mb-1">Attached Image (Stored as IndexedDB Blob):</div>
              <img
                src={imagePreviewUrl}
                alt={imageDescription || 'Question figure'}
                className="max-h-56 rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white p-2"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
          >
            {saving ? 'Saving...' : question ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
