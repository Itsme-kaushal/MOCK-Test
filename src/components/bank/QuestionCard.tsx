import React, { useEffect, useState } from 'react';
import { Question, Paper, Section, CorrectIndex } from '../../types/schema';
import { MathMarkdown } from '../common/MathMarkdown';
import { Badge } from '../common/Badge';
import { QuestionSource } from '../common/QuestionSource';
import {
  Bookmark,
  Edit3,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Upload,
  ListPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  paper?: Paper;
  section?: Section;
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
  onQuickSetAnswer: (id: string, idx: CorrectIndex) => void;
  onQuickAttachImage: (id: string, file: File) => void;
  onToggleBookmark: (id: string) => void;
  onToggleRevision: (id: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  paper,
  section,
  onEdit,
  onDelete,
  onQuickSetAnswer,
  onQuickAttachImage,
  onToggleBookmark,
  onToggleRevision,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (question.imageBlob) {
      const url = URL.createObjectURL(question.imageBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (question.imageUrl) {
      setImageUrl(question.imageUrl);
    } else {
      setImageUrl(null);
    }
  }, [question.imageBlob, question.imageUrl]);

  const missingAnswer = question.correctIndex === null;
  const missingImage = question.hasImage && !question.imageBlob && !question.imageUrl;

  return (
    <div
      className={`rounded-2xl border p-5 transition-all bg-white dark:bg-slate-900 shadow-2xs ${
        missingAnswer || missingImage
          ? 'border-amber-300 dark:border-amber-800/80'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">
            Q.{question.qNo}
          </span>
          {paper && (
            <Badge variant="indigo">
              {paper.exam} ({paper.year} • {paper.shift})
            </Badge>
          )}
          {section && <Badge variant="slate">{section.name}</Badge>}
          <Badge variant="purple">{question.topic || 'General'}</Badge>
          {question.extractionStatus === 'review' && <Badge variant="amber">Content review</Badge>}
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            +{question.marks} / -{question.negativeMarks}
          </span>

          {missingAnswer && (
            <Badge variant="amber">
              <AlertCircle className="w-3.5 h-3.5" /> {question.answerStatus === 'withdrawn' ? 'Withdrawn' : 'Answer key needed'}
            </Badge>
          )}
          {missingImage && (
            <Badge variant="rose">
              <ImageIcon className="w-3.5 h-3.5" /> Image Needed
            </Badge>
          )}
          {question.hasImage && !missingImage && (
            <Badge variant="emerald">
              <ImageIcon className="w-3.5 h-3.5" /> Image Attached
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <label
            title="Attach or replace image from computer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onQuickAttachImage(question.id, file);
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => onToggleBookmark(question.id)}
            title={question.bookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
            className={`p-1.5 rounded-lg transition-colors ${
              question.bookmarked
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => onToggleRevision(question.id)}
            title={question.inRevisionList ? 'In Revision List' : 'Add to Revision List'}
            className={`p-1.5 rounded-lg transition-colors ${
              question.inRevisionList
                ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ListPlus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(question)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>

          <button
            type="button"
            onClick={() => onDelete(question.id)}
            title="Delete Question"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Question Stem */}
      <div className="space-y-2 mb-4">
        <MathMarkdown
          content={question.text}
          className="text-slate-900 dark:text-slate-100 text-sm sm:text-base"
        />
        {question.textHi && (
          <MathMarkdown
            content={question.textHi}
            className="text-slate-600 dark:text-slate-400 text-sm pl-3 border-l-2 border-indigo-200 dark:border-indigo-800"
          />
        )}
      </div>

      {/* Attached Image or Placeholder */}
      {(imageUrl || question.hasImage) && (
        <div className="mb-4">
          {imageUrl ? (
            <div className="inline-block p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white">
              <img
                src={imageUrl}
                alt={question.imageDescription || `Question ${question.qNo} diagram`}
                className="max-h-64 object-contain rounded-lg"
              />
              {question.imageDescription && (
                <p className="text-xs text-slate-500 mt-1 text-center">
                  {question.imageDescription}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-dashed border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Missing Diagram:</strong>{' '}
                  {question.imageDescription || 'This question has hasImage=true but no image uploaded yet.'}
                </span>
              </div>
              <label className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer shrink-0">
                Attach Image Now
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onQuickAttachImage(question.id, file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Options Grid (with quick click to set answer if null or change answer) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {question.options.map((opt, idx) => {
          const isCorrect = question.correctIndex === idx;
          const optHi = question.optionsHi?.[idx];

          return (
            <div
              key={idx}
              onClick={() => onQuickSetAnswer(question.id, idx as CorrectIndex)}
              title="Click to set this option as the correct answer"
              className={`group flex items-start gap-2.5 p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-300 dark:hover:border-indigo-700'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  isCorrect
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900'
                }`}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <div className="flex-1 min-w-0">
                <MathMarkdown content={opt} />
                {optHi && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <MathMarkdown content={optHi} />
                  </div>
                )}
              </div>
              {isCorrect && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" />
              )}
            </div>
          );
        })}
      </div>

      <QuestionSource question={question} />
      {/* Footer: Explanation toggle */}
      {question.explanation && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {showExplanation ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Hide Explanation
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> View Explanation
              </>
            )}
          </button>
          {showExplanation && (
            <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <MathMarkdown content={question.explanation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
