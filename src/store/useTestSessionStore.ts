import { create } from 'zustand';
import {
  Attempt,
  Question,
  Section,
  AttemptConfig,
} from '../types/schema';
import { repository } from '../lib/db/dexieRepository';
import { evaluateAttempt } from '../lib/scoring/engine';

export type PaletteStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked'
  | 'answered_marked';

interface TestSessionState {
  attempt: Attempt | null;
  questions: Question[];
  sections: Section[];
  currentIndex: number;
  isSubmitting: boolean;

  loadAttemptSession: (attemptId: string) => Promise<boolean>;
  selectOption: (questionId: string, originalOptionIdx: number) => Promise<void>;
  clearResponse: (questionId: string) => Promise<void>;
  toggleMarkForReview: (questionId: string) => Promise<void>;
  goToQuestionIndex: (index: number) => Promise<void>;
  saveAndNext: () => Promise<void>;
  markAndNext: () => Promise<void>;
  previousQuestion: () => Promise<void>;
  tickSecondOnCurrentQuestion: () => Promise<void>;
  incrementTabSwitch: () => Promise<void>;
  submitTest: () => Promise<string | null>;
}

export function getQuestionPaletteStatus(
  attempt: Attempt,
  questionId: string
): PaletteStatus {
  const isVisited = attempt.visited.includes(questionId);
  const hasAnswer =
    attempt.answers[questionId] !== undefined &&
    attempt.answers[questionId] !== null;
  const isMarked = attempt.markedForReview.includes(questionId);

  if (!isVisited) return 'not_visited';
  if (hasAnswer && isMarked) return 'answered_marked';
  if (isMarked) return 'marked';
  if (hasAnswer) return 'answered';
  return 'not_answered';
}

export const useTestSessionStore = create<TestSessionState>((set, get) => ({
  attempt: null,
  questions: [],
  sections: [],
  currentIndex: 0,
  isSubmitting: false,

  loadAttemptSession: async (attemptId: string) => {
    const attempt = await repository.getAttemptById(attemptId);
    if (!attempt) return false;

    const rawQuestions = await repository.getQuestionsByIds(attempt.questionIds);
    const qMap = new Map(rawQuestions.map((q) => [q.id, q]));
    const orderedQuestions = attempt.questionIds
      .map((id) => qMap.get(id))
      .filter((q): q is Question => Boolean(q));

    let sections: Section[] = [];
    if (attempt.targetType === 'paper') {
      sections = await repository.getSectionsByPaperId(attempt.targetId);
    } else {
      const allSec = await repository.getAllSections();
      const usedSecIds = new Set(orderedQuestions.map((q) => q.sectionId));
      sections = allSec.filter((s) => usedSecIds.has(s.id));
    }

    const activeIdx = attempt.activeQuestionId
      ? Math.max(
          0,
          orderedQuestions.findIndex((q) => q.id === attempt.activeQuestionId)
        )
      : 0;

    const firstQId = orderedQuestions[activeIdx]?.id;
    if (firstQId && !attempt.visited.includes(firstQId)) {
      attempt.visited = [...attempt.visited, firstQId];
      attempt.activeQuestionId = firstQId;
      await repository.saveAttempt(attempt);
    }

    set({
      attempt,
      questions: orderedQuestions,
      sections,
      currentIndex: activeIdx,
    });
    return true;
  },

  selectOption: async (questionId: string, originalOptionIdx: number) => {
    const { attempt } = get();
    if (!attempt || attempt.status === 'submitted') return;

    const nextAttempt: Attempt = {
      ...attempt,
      answers: {
        ...attempt.answers,
        [questionId]: originalOptionIdx,
      },
      visited: attempt.visited.includes(questionId)
        ? attempt.visited
        : [...attempt.visited, questionId],
    };

    set({ attempt: nextAttempt });
    await repository.saveAttempt(nextAttempt);
  },

  clearResponse: async (questionId: string) => {
    const { attempt } = get();
    if (!attempt || attempt.status === 'submitted') return;

    const nextAttempt: Attempt = {
      ...attempt,
      answers: {
        ...attempt.answers,
        [questionId]: null,
      },
    };

    set({ attempt: nextAttempt });
    await repository.saveAttempt(nextAttempt);
  },

  toggleMarkForReview: async (questionId: string) => {
    const { attempt } = get();
    if (!attempt || attempt.status === 'submitted') return;

    const exists = attempt.markedForReview.includes(questionId);
    const nextMarked = exists
      ? attempt.markedForReview.filter((id) => id !== questionId)
      : [...attempt.markedForReview, questionId];

    const nextAttempt: Attempt = {
      ...attempt,
      markedForReview: nextMarked,
    };

    set({ attempt: nextAttempt });
    await repository.saveAttempt(nextAttempt);
  },

  goToQuestionIndex: async (index: number) => {
    const { attempt, questions } = get();
    if (!attempt || index < 0 || index >= questions.length) return;

    const targetQ = questions[index];
    const nextVisited = attempt.visited.includes(targetQ.id)
      ? attempt.visited
      : [...attempt.visited, targetQ.id];

    const nextAttempt: Attempt = {
      ...attempt,
      visited: nextVisited,
      activeQuestionId: targetQ.id,
      activeSectionId: targetQ.sectionId,
    };

    set({ currentIndex: index, attempt: nextAttempt });
    await repository.saveAttempt(nextAttempt);
  },

  saveAndNext: async () => {
    const { currentIndex, questions, goToQuestionIndex } = get();
    if (currentIndex + 1 < questions.length) {
      await goToQuestionIndex(currentIndex + 1);
    }
  },

  markAndNext: async () => {
    const { attempt, questions, currentIndex, goToQuestionIndex } = get();
    if (!attempt) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    if (!attempt.markedForReview.includes(currentQ.id)) {
      const nextAttempt: Attempt = {
        ...attempt,
        markedForReview: [...attempt.markedForReview, currentQ.id],
      };
      set({ attempt: nextAttempt });
      await repository.saveAttempt(nextAttempt);
    }

    if (currentIndex + 1 < questions.length) {
      await goToQuestionIndex(currentIndex + 1);
    }
  },

  previousQuestion: async () => {
    const { currentIndex, goToQuestionIndex } = get();
    if (currentIndex > 0) {
      await goToQuestionIndex(currentIndex - 1);
    }
  },

  tickSecondOnCurrentQuestion: async () => {
    const { attempt, questions, currentIndex } = get();
    if (!attempt || attempt.status === 'submitted') return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const prevSec = attempt.timePerQ[currentQ.id] || 0;
    const nextAttempt: Attempt = {
      ...attempt,
      timePerQ: {
        ...attempt.timePerQ,
        [currentQ.id]: prevSec + 1,
      },
    };
    set({ attempt: nextAttempt });
    // Persist every 3 seconds to avoid excessive IndexedDB churn while keeping crash resilience
    if ((prevSec + 1) % 3 === 0) {
      await repository.saveAttempt(nextAttempt);
    }
  },

  incrementTabSwitch: async () => {
    const { attempt } = get();
    if (!attempt || attempt.status === 'submitted') return;
    const nextAttempt: Attempt = {
      ...attempt,
      tabSwitchCount: (attempt.tabSwitchCount || 0) + 1,
    };
    set({ attempt: nextAttempt });
    await repository.saveAttempt(nextAttempt);
  },

  submitTest: async () => {
    const { attempt, questions, sections, isSubmitting } = get();
    if (!attempt || isSubmitting) return null;
    if (attempt.status === 'submitted') return attempt.id;

    set({ isSubmitting: true });
    try {
      const evaluation = evaluateAttempt({
        questions,
        sections,
        answers: attempt.answers,
        timePerQ: attempt.timePerQ,
        config: attempt.config,
      });

      const finalizedAttempt: Attempt = {
        ...attempt,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        score: evaluation.score,
        totalPossibleMarks: evaluation.totalPossibleMarks,
        negativeMarksLost: evaluation.negativeMarksLost,
        accuracy: evaluation.accuracy,
        sectionStats: evaluation.sectionStats,
      };

      await repository.saveAttempt(finalizedAttempt);
      set({ attempt: finalizedAttempt, isSubmitting: false });
      return finalizedAttempt.id;
    } catch (e) {
      set({ isSubmitting: false });
      throw e;
    }
  },
}));

/**
 * Helper to create and persist a new Attempt in IndexedDB before launching `/test/:attemptId`
 */
export async function createNewTestAttempt(params: {
  targetId: string;
  targetType: 'paper' | 'custom';
  title: string;
  exam: string;
  questions: Question[];
  config: AttemptConfig;
}): Promise<Attempt> {
  const { targetId, targetType, title, exam, questions, config } = params;
  if (!questions.length) throw new Error('Choose at least one question to start a test.');
  const effectiveConfig = { ...config, durationMin: targetType === 'paper' ? 120 : config.durationMin };

  let orderedQuestions = [...questions];
  if (config.shuffleQuestions) {
    for (let i = orderedQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orderedQuestions[i], orderedQuestions[j]] = [
        orderedQuestions[j],
        orderedQuestions[i],
      ];
    }
  }

  const optionPermutations: Record<string, [number, number, number, number]> = {};
  orderedQuestions.forEach((q) => {
    const perm: [number, number, number, number] = [0, 1, 2, 3];
    if (config.shuffleOptions) {
      for (let i = perm.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
    }
    optionPermutations[q.id] = perm;
  });

  const now = Date.now();
  const durationMs = effectiveConfig.durationMin * 60 * 1000;
  const firstQ = orderedQuestions[0];

  const attempt: Attempt = {
    id: crypto.randomUUID(),
    targetId,
    targetType,
    title,
    exam,
    status: 'in_progress',
    config: effectiveConfig,
    questionIds: orderedQuestions.map((q) => q.id),
    optionPermutations,
    answers: {},
    markedForReview: [],
    visited: firstQ ? [firstQ.id] : [],
    timePerQ: {},
    activeQuestionId: firstQ?.id,
    activeSectionId: firstQ?.sectionId,
    tabSwitchCount: 0,
    startedAt: new Date(now).toISOString(),
    endTime: now + durationMs,
    submittedAt: null,
    score: 0,
    totalPossibleMarks: 0,
    negativeMarksLost: 0,
    accuracy: 0,
    sectionStats: [],
  };

  await repository.saveAttempt(attempt);
  return attempt;
}
