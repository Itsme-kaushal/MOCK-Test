import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { repository } from '../lib/db/dexieRepository';
import { Attempt, Question } from '../types/schema';
import { MathMarkdown } from '../components/common/MathMarkdown';
import { QuestionSource } from '../components/common/QuestionSource';

export function ReviewPage() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState<Attempt>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  useEffect(() => { if (attemptId) repository.getAttemptById(attemptId).then(async a => {
    if (!a) { setError('Attempt not found.'); return; }
    if (a.status !== 'submitted') { setError('Submit the test before reviewing answers.'); return; }
    setAttempt(a); const qs = await repository.getQuestionsByIds(a.questionIds);
    const map = new Map(qs.map(q => [q.id,q])); setQuestions(a.questionIds.flatMap(id => map.get(id) ? [map.get(id)!] : []));
  }).catch(e => setError(String(e))); }, [attemptId]);
  if (error) return <p role="alert">{error}</p>;
  if (!attempt) return <p>Loading answer review...</p>;
  const status = (q: Question) => q.correctIndex === null || q.answerStatus === 'withdrawn' ? 'excluded' : attempt.answers[q.id] == null ? 'unanswered' : attempt.answers[q.id] === q.correctIndex ? 'correct' : 'wrong';
  return <div className="space-y-5">
    <Link to={`/results/${attempt.id}`} className="text-sm text-indigo-600">← Back to results</Link>
    <h1 className="text-2xl font-bold">Answer review</h1><p className="text-slate-500">{attempt.title}</p>
    <div className="flex flex-wrap gap-2">{['all','wrong','unanswered','correct','excluded'].map(value => <button key={value} onClick={() => setFilter(value)} className={`px-4 py-2 rounded-xl text-sm capitalize ${filter===value ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}>{value} ({value==='all' ? questions.length : questions.filter(q => status(q)===value).length})</button>)}</div>
    {questions.filter(q => filter==='all' || status(q)===filter).map(q => <div key={q.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex justify-between text-sm"><strong>Q.{questions.indexOf(q)+1} · {q.topic}</strong><span className="capitalize">{status(q)}</span></div><MathMarkdown content={q.text} />
      <div className="grid sm:grid-cols-2 gap-3">{q.options.map((opt,i) => <div key={i} className={`p-3 rounded-xl border ${q.correctIndex===i ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : attempt.answers[q.id]===i ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-slate-200 dark:border-slate-700'}`}><p className="text-xs font-bold mb-1">{String.fromCharCode(65+i)} {q.correctIndex===i ? '· Correct answer' : ''} {attempt.answers[q.id]===i ? '· Your answer' : ''}</p><MathMarkdown content={opt} /></div>)}</div>
      {q.explanation && <MathMarkdown content={q.explanation} />}<QuestionSource question={q} />
    </div>)}
  </div>;
}
