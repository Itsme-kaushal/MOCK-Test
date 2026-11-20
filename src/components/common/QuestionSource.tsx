import { Question } from '../../types/schema';

export function QuestionSource({ question }: { question: Question }) {
  if (!question.sourceFile) return null;
  return <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 space-y-1">
    <p>Source: {question.sourceFile} · Q.{question.qNo} · PDF page {question.sourcePages?.join(', ')}</p>
    {question.extractionStatus === 'review' && <p>Original images are preserved. Search text and topic labels may need review.</p>}
    {question.answerStatus === 'withdrawn' && <p className="text-amber-700">The source withdrew this question. It is excluded from scoring.</p>}
  </div>;
}
