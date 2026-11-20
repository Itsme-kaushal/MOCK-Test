import { Paper, Question, Section } from '../types/schema';

export interface PracticeFilter {
  exam?: string;
  paperId?: string;
  section?: string;
  chapter?: string;
  topic?: string;
  bookmarkedOnly?: boolean;
}

export function buildPracticePool(questions: Question[], papers: Paper[], sections: Section[], filter: PracticeFilter): Question[] {
  const paperMap = new Map(papers.map(p => [p.id, p]));
  const sectionMap = new Map(sections.map(s => [s.id, s.name]));
  const seen = new Set<string>();
  return questions.filter(q => {
    if (filter.exam && paperMap.get(q.paperId)?.exam !== filter.exam) return false;
    if (filter.paperId && q.paperId !== filter.paperId) return false;
    if (filter.section && sectionMap.get(q.sectionId) !== filter.section) return false;
    if (filter.chapter && (q.chapter || q.topic) !== filter.chapter) return false;
    if (filter.topic && q.topic !== filter.topic) return false;
    if (filter.bookmarkedOnly && !q.bookmarked) return false;
    // Preserve the complete source paper; avoid repeat questions in drills.
    if (!filter.paperId && seen.has(q.hash)) return false;
    seen.add(q.hash);
    return true;
  });
}

export function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
