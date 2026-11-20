import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Bookmark, ChevronLeft, ChevronRight, Play, Shuffle } from 'lucide-react';
import { repository } from '../lib/db/dexieRepository';
import { buildPracticePool, shuffle } from '../lib/practice';
import { Paper, Question, Section } from '../types/schema';
import { createNewTestAttempt } from '../store/useTestSessionStore';
import { MathMarkdown } from '../components/common/MathMarkdown';
import { QuestionSource } from '../components/common/QuestionSource';

export function PracticePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState<{ questions: Question[]; papers: Paper[]; sections: Section[] }>({ questions: [], papers: [], sections: [] });
  const [scope, setScope] = useState('chapter');
  const [exam, setExam] = useState('');
  const [section, setSection] = useState(params.get('section') || 'Computer Science');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [paperId, setPaperId] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [session, setSession] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [duration, setDuration] = useState(20);
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState(false);
  const eligiblePapers = data.papers.filter(p => !exam || p.exam === exam);
  const effectivePaperId = eligiblePapers.find(p => p.id === paperId)?.id || eligiblePapers[0]?.id;
  useEffect(() => { Promise.all([repository.getQuestions(), repository.getPapers(), repository.getAllSections()]).then(([questions, papers, sections]) => setData({ questions, papers, sections })).catch(e => setError(String(e))); }, []);
  const basePool = useMemo(() => buildPracticePool(data.questions, data.papers, data.sections, { exam, section: scope === 'paper' ? undefined : section, paperId: scope === 'paper' ? effectivePaperId : undefined, bookmarkedOnly: scope !== 'paper' && bookmarkedOnly }), [data, exam, section, scope, effectivePaperId, bookmarkedOnly]);
  const chapters = [...new Set(basePool.map(q => q.chapter || q.topic))].sort();
  const chapterPool = basePool.filter(q => !chapter || (q.chapter || q.topic) === chapter);
  const topics = [...new Set(chapterPool.map(q => q.topic))].sort();
  const pool = useMemo(() => buildPracticePool(data.questions, data.papers, data.sections, { exam, section: scope === 'paper' ? undefined : section, paperId: scope === 'paper' ? effectivePaperId : undefined, chapter: scope === 'chapter' || scope === 'topic' ? chapter : undefined, topic: scope === 'topic' ? topic : undefined, bookmarkedOnly: scope !== 'paper' && bookmarkedOnly }), [data, exam, section, scope, effectivePaperId, chapter, topic, bookmarkedOnly]);
  const q = session[index];
  const revealed = q && checked.includes(q.id);
  const startStudy = () => { setSession(shuffle(pool).slice(0, limit)); setIndex(0); setResponses({}); setChecked([]); };
  const startTimed = async () => {
    setLaunching(true); setError('');
    try {
      if (scope === 'paper') { navigate(`/create-test?paperId=${effectivePaperId}`); return; }
      const questions = shuffle(pool).slice(0, limit);
      const attempt = await createNewTestAttempt({ targetId: crypto.randomUUID(), targetType: 'custom', title: `${topic || chapter || section || 'Mixed'} Practice`, exam: exam || 'DSSSB Practice', questions, config: { durationMin: duration, sectionLock: false, perSectionDuration: false, markingCorrect: 1, markingNegative: .25, useSectionMarkingOverride: true, shuffleQuestions: false, shuffleOptions: false, language: 'en' } });
      navigate(`/test/${attempt.id}`);
    } catch (e) { setError(String(e)); } finally { setLaunching(false); }
  };
  const selectStyle = 'w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm';
  return <div className="space-y-6">
    <div><p className="text-xs font-bold tracking-widest uppercase text-indigo-600">Your daily practice</p><h1 className="text-3xl font-bold mt-2">Build confidence, one topic at a time.</h1><p className="text-slate-500 mt-2">Study with answer feedback or launch a timed drill. Full-paper mocks run for 2 hours.</p></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Practice mode">
      {['chapter', 'topic', 'section', 'paper'].map(value => <button key={value} role="tab" aria-selected={scope === value} onClick={() => { setScope(value); setSession([]); }} className={`p-3 rounded-xl text-sm font-semibold border ${scope === value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>{value === 'paper' ? 'Full paper' : `${value[0].toUpperCase() + value.slice(1)} wise`}</button>)}
    </div>
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="text-xs font-semibold">Exam<select aria-label="Exam" className={selectStyle} value={exam} onChange={e => { setExam(e.target.value); setChapter(''); setTopic(''); }}><option value="">All exams</option>{[...new Set(data.papers.map(p => p.exam))].sort().map(e => <option key={e}>{e}</option>)}</select></label>
        {scope === 'paper' ? <label className="text-xs font-semibold sm:col-span-2">Paper<select aria-label="Paper" className={selectStyle} value={effectivePaperId || ''} onChange={e => setPaperId(e.target.value)}>{eligiblePapers.map(p => <option key={p.id} value={p.id}>{p.paperName}</option>)}</select></label> : <label className="text-xs font-semibold">Section<select aria-label="Section" className={selectStyle} value={section} onChange={e => { setSection(e.target.value); setChapter(''); setTopic(''); }}><option value="">All sections</option>{[...new Set(data.sections.map(s => s.name))].sort().map(s => <option key={s}>{s}</option>)}</select></label>}
        {(scope === 'chapter' || scope === 'topic') && <label className="text-xs font-semibold">Chapter<select aria-label="Chapter" className={selectStyle} value={chapter} onChange={e => { setChapter(e.target.value); setTopic(''); }}><option value="">All chapters</option>{chapters.map(c => <option key={c}>{c}</option>)}</select></label>}
        {scope === 'topic' && <label className="text-xs font-semibold">Topic<select aria-label="Topic" className={selectStyle} value={topic} onChange={e => setTopic(e.target.value)}><option value="">All topics</option>{topics.map(t => <option key={t}>{t}</option>)}</select></label>}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold text-indigo-600">{pool.length} {scope === 'paper' ? 'paper' : 'distinct'} questions available</span>
        {scope !== 'paper' && <label><input type="checkbox" checked={bookmarkedOnly} onChange={e => setBookmarkedOnly(e.target.checked)} className="mr-2" />Bookmarks only</label>}
        {scope !== 'paper' && <><label>Questions <input aria-label="Number of questions" type="number" min="1" max={Math.max(1, pool.length)} value={limit} onChange={e => setLimit(Math.min(Math.max(1, pool.length), Math.max(1, Number(e.target.value))))} className="w-20 ml-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent" /></label><label>Minutes <input aria-label="Practice duration" type="number" min="1" max="120" value={duration} onChange={e => setDuration(Math.min(120, Math.max(1, Number(e.target.value))))} className="w-20 ml-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent" /></label></>}
      </div>
      <div className="flex flex-wrap gap-3">
        {scope !== 'paper' && <button disabled={!pool.length} onClick={startStudy} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"><BookOpen size={17} />Start practice</button>}
        <button disabled={!pool.length || launching} onClick={startTimed} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-indigo-300 text-indigo-600 font-semibold text-sm disabled:opacity-40"><Play size={17} />{scope === 'paper' ? 'Start 2-hour mock' : 'Take timed drill'}</button>
      </div>
      {scope !== 'paper' && <p className="text-xs text-slate-500">Repeated questions shared by multiple source papers appear once in drills.</p>}
      {error && <p role="alert" className="text-rose-600">{error}</p>}
    </div>
    {q && <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-5">
      <div className="flex justify-between items-center"><div><span className="text-xs text-indigo-600 font-bold">QUESTION {index + 1} OF {session.length}</span><p className="text-xs text-slate-500 mt-1">{q.chapter} / {q.topic}</p></div><button aria-label="Bookmark question" onClick={async () => { const value = await repository.toggleBookmark(q.id); setSession(session.map(item => item.id === q.id ? { ...item, bookmarked: value } : item)); setData({ ...data, questions: data.questions.map(item => item.id === q.id ? { ...item, bookmarked: value } : item) }); }} className="p-2"><Bookmark size={20} fill={q.bookmarked ? 'currentColor' : 'none'} /></button></div>
      <MathMarkdown content={q.text} />
      <div className="grid sm:grid-cols-2 gap-3">{q.options.map((option, i) => <button key={i} disabled={revealed} onClick={() => setResponses({ ...responses, [q.id]: i })} className={`text-left p-4 rounded-xl border flex items-start gap-3 ${revealed && q.correctIndex === i ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : revealed && responses[q.id] === i && q.correctIndex !== null ? 'bg-rose-50 border-rose-400 text-rose-900' : responses[q.id] === i ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}><span className="font-bold text-sm shrink-0">{String.fromCharCode(65+i)}.</span><MathMarkdown content={option} className="min-w-0" /></button>)}</div>
      {revealed && <div role="status" className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm">{q.correctIndex === null ? 'This question has no usable answer key and is excluded from scoring.' : responses[q.id] === q.correctIndex ? 'Correct! Well done.' : `Correct answer: ${String.fromCharCode(65 + q.correctIndex)}.`}{q.explanation && <MathMarkdown content={q.explanation} className="mt-2" />}</div>}
      <div className="flex flex-wrap gap-3 items-center justify-between"><button disabled={!index} onClick={() => setIndex(index-1)} className="inline-flex gap-1 items-center text-sm disabled:opacity-30"><ChevronLeft size={18} />Previous</button>{!revealed && <button disabled={responses[q.id] === undefined} onClick={() => setChecked([...checked,q.id])} className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">Check answer</button>}{index < session.length-1 ? <button onClick={() => setIndex(index+1)} className="inline-flex gap-1 items-center text-sm">Next<ChevronRight size={18} /></button> : <button onClick={startStudy} className="inline-flex gap-2 items-center text-sm text-indigo-600"><Shuffle size={17} />New practice set</button>}</div>
      <QuestionSource question={q} />
    </div>}
  </div>;
}
