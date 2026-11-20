import { describe, it, expect } from 'vitest';
import { evaluateAttempt } from './engine';
import { Question, Section, AttemptConfig } from '../../types/schema';

describe('Scoring Engine (src/lib/scoring/engine.ts)', () => {
  const sections: Section[] = [
    {
      id: 'sec-quant',
      paperId: 'paper-1',
      name: 'Quantitative Aptitude',
      order: 1,
      durationMin: 20,
      markingOverride: { correct: 2, negative: 0.5 },
    },
    {
      id: 'sec-eng',
      paperId: 'paper-1',
      name: 'English',
      order: 2,
      durationMin: 20,
      markingOverride: { correct: 3, negative: 1 },
    },
  ];

  const makeQuestion = (
    id: string,
    sectionId: string,
    qNo: number,
    correctIndex: 0 | 1 | 2 | 3 | null,
    topic = 'Algebra'
  ): Question => ({
    id,
    paperId: 'paper-1',
    sectionId,
    qNo,
    text: `Question ${qNo}`,
    textHi: '',
    options: ['A', 'B', 'C', 'D'],
    optionsHi: ['', '', '', ''],
    correctIndex,
    explanation: '',
    marks: 2,
    negativeMarks: 0.5,
    topic,
    hasImage: false,
    imageDescription: '',
    hash: `hash_${id}`,
    bookmarked: false,
    tags: [],
  });

  const baseConfig: AttemptConfig = {
    durationMin: 60,
    sectionLock: false,
    perSectionDuration: false,
    markingCorrect: 2,
    markingNegative: 0.5,
    useSectionMarkingOverride: false,
    shuffleQuestions: false,
    shuffleOptions: false,
    language: 'en',
  };

  it('calculates score, negative marks, and accuracy while excluding null correctIndex questions', () => {
    const questions: Question[] = [
      makeQuestion('q1', 'sec-quant', 1, 0, 'Algebra'), // Will answer correctly (+2)
      makeQuestion('q2', 'sec-quant', 2, 1, 'Geometry'), // Will answer wrong (-0.5)
      makeQuestion('q3', 'sec-quant', 3, 2, 'Algebra'), // Will leave unattempted (0)
      makeQuestion('q4', 'sec-quant', 4, null, 'Trigonometry'), // Null answer -> excluded!
    ];

    const result = evaluateAttempt({
      questions,
      sections,
      answers: {
        q1: 0,
        q2: 3,
        q3: null,
        q4: 1, // Even if user selects an option on a null-answer question, it is excluded
      },
      timePerQ: { q1: 30, q2: 45, q3: 10, q4: 15 },
      config: baseConfig,
    });

    expect(result.totalQuestions).toBe(4);
    expect(result.scorableQuestions).toBe(3);
    expect(result.excludedNullAnswerQuestions).toBe(1);
    expect(result.totalPossibleMarks).toBe(6);
    expect(result.attempted).toBe(2);
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(1);
    expect(result.unattempted).toBe(1);
    expect(result.score).toBe(1.5);
    expect(result.negativeMarksLost).toBe(0.5);
    expect(result.accuracy).toBe(50);
    expect(result.totalTimeSec).toBe(100);
  });

  it('applies per-section marking overrides when useSectionMarkingOverride is enabled', () => {
    const questions: Question[] = [
      makeQuestion('q1', 'sec-quant', 1, 0), // +2
      makeQuestion('q2', 'sec-eng', 2, 1), // +3 (override)
      makeQuestion('q3', 'sec-eng', 3, 2), // -1 (override wrong)
    ];

    const result = evaluateAttempt({
      questions,
      sections,
      answers: { q1: 0, q2: 1, q3: 0 },
      timePerQ: { q1: 20, q2: 20, q3: 20 },
      config: { ...baseConfig, useSectionMarkingOverride: true },
    });

    // Quant: +2, Eng: +3 - 1 = +2 -> Total = 4 out of (2 + 3 + 3 = 8)
    expect(result.score).toBe(4);
    expect(result.totalPossibleMarks).toBe(8);
    expect(result.negativeMarksLost).toBe(1);
    expect(result.sectionStats).toHaveLength(2);
    expect(result.sectionStats[1].score).toBe(2);
    expect(result.sectionStats[1].maxScore).toBe(6);
  });
  it('keeps a source-withdrawn question unscored even if its answer is edited', () => {
    const q = { ...makeQuestion('withdrawn', 'sec-quant', 1, 0), answerStatus: 'withdrawn' as const };
    const result = evaluateAttempt({ questions: [q], sections, answers: { withdrawn: 0 }, timePerQ: {}, config: baseConfig });
    expect(result.score).toBe(0);
    expect(result.totalPossibleMarks).toBe(0);
    expect(result.scorableQuestions).toBe(0);
  });
});
