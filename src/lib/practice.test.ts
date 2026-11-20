import { describe, expect, it } from 'vitest';
import { buildPracticePool } from './practice';
import { Paper, Question, Section } from '../types/schema';

const papers = [{ id: 'a', exam: 'TGT' }, { id: 'b', exam: 'PGT' }] as Paper[];
const sections = [{ id: 's1', name: 'Computer Science' }, { id: 's2', name: 'English' }] as Section[];
const questions = [
  { id: 'q1', paperId: 'a', sectionId: 's1', chapter: 'Databases', topic: 'SQL', hash: 'same' },
  { id: 'q2', paperId: 'b', sectionId: 's1', chapter: 'Databases', topic: 'SQL', hash: 'same', bookmarked: true },
  { id: 'q3', paperId: 'b', sectionId: 's1', chapter: 'Databases', topic: 'Normalization', hash: 'different' },
  { id: 'q4', paperId: 'b', sectionId: 's2', chapter: 'Vocabulary', topic: 'Synonyms', hash: 'english' },
] as Question[];

describe('practice selection', () => {
  it('keeps chapter, topic and section filters hierarchical', () => {
    expect(buildPracticePool(questions,papers,sections,{ section: 'Computer Science', chapter: 'Databases', topic: 'SQL' }).map(q => q.id)).toEqual(['q1']);
    expect(buildPracticePool(questions,papers,sections,{ section: 'English', chapter: 'Databases' })).toEqual([]);
  });
  it('keeps every question in a full paper, even if shared across papers', () => {
    expect(buildPracticePool(questions,papers,sections,{ paperId: 'b' }).map(q => q.id)).toEqual(['q2','q3','q4']);
  });
  it('applies exam and bookmark filters before removing repeats', () => {
    expect(buildPracticePool(questions,papers,sections,{ exam: 'PGT', topic: 'SQL' }).map(q => q.id)).toEqual(['q2']);
    expect(buildPracticePool(questions,papers,sections,{ bookmarkedOnly: true }).map(q => q.id)).toEqual(['q2']);
  });
});
