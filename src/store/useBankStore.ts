import { create } from 'zustand';
import { Paper, Section, Question } from '../types/schema';
import { BankStats, QuestionFilter } from '../types/repository';
import { repository } from '../lib/db/dexieRepository';

interface BankState {
  papers: Paper[];
  sections: Section[];
  questions: Question[];
  stats: BankStats | null;
  facets: {
    exams: string[];
    years: number[];
    shifts: string[];
    sections: string[];
    topics: string[];
  };
  filter: QuestionFilter;
  isLoading: boolean;

  setFilter: (partial: Partial<QuestionFilter>) => Promise<void>;
  resetFilter: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshQuestions: () => Promise<void>;
}

const defaultFilter: QuestionFilter = {
  exam: undefined,
  year: undefined,
  shift: undefined,
  paperId: undefined,
  sectionName: undefined,
  topic: undefined,
  chapter: undefined,
  keyword: '',
  needsAttention: false,
  bookmarkedOnly: false,
  revisionOnly: false,
  hasImageOnly: false,
};

export const useBankStore = create<BankState>((set, get) => ({
  papers: [],
  sections: [],
  questions: [],
  stats: null,
  facets: {
    exams: [],
    years: [],
    shifts: [],
    sections: [],
    topics: [],
  },
  filter: { ...defaultFilter },
  isLoading: false,

  setFilter: async (partial) => {
    const nextFilter = { ...get().filter, ...partial };
    set({ filter: nextFilter, isLoading: true });
    const questions = await repository.getQuestions(nextFilter);
    set({ questions, isLoading: false });
  },

  resetFilter: async () => {
    set({ filter: { ...defaultFilter }, isLoading: true });
    const questions = await repository.getQuestions(defaultFilter);
    set({ questions, isLoading: false });
  },

  refreshQuestions: async () => {
    set({ isLoading: true });
    const questions = await repository.getQuestions(get().filter);
    const stats = await repository.getBankStats();
    set({ questions, stats, isLoading: false });
  },

  refreshAll: async () => {
    set({ isLoading: true });
    const [papers, sections, questions, stats, facets] = await Promise.all([
      repository.getPapers(),
      repository.getAllSections(),
      repository.getQuestions(get().filter),
      repository.getBankStats(),
      repository.getDistinctFacets(),
    ]);
    set({
      papers,
      sections,
      questions,
      stats,
      facets,
      isLoading: false,
    });
  },
}));
