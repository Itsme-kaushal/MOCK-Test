import {
  Paper,
  Section,
  Question,
  CustomTest,
  Attempt,
  AiExplanation,
  RawImportPayload,
  DuplicateResolutionStrategy,
} from './schema';

export interface QuestionFilter {
  exam?: string;
  year?: number;
  shift?: string;
  paperId?: string;
  sectionId?: string;
  sectionName?: string;
  topic?: string;
  chapter?: string;
  keyword?: string;
  needsAttention?: boolean; // correctIndex === null or (hasImage && !imageBlob && !imageUrl)
  bookmarkedOnly?: boolean;
  revisionOnly?: boolean;
  previouslyWrongOnly?: boolean;
  hasImageOnly?: boolean;
}

export interface BankStats {
  totalPapers: number;
  totalQuestions: number;
  needsAttentionCount: number;
  missingAnswerCount: number;
  missingImageCount: number;
  bookmarkedCount: number;
  revisionCount: number;
  questionsByExam: { exam: string; count: number; papers: number }[];
  questionsBySection: { section: string; count: number }[];
  questionsByTopic: { topic: string; count: number }[];
}

export interface ImportSummary {
  papersAdded: number;
  papersOverwritten: number;
  papersSkipped: number;
  questionsAdded: number;
  questionsOverwritten: number;
  questionsSkipped: number;
}

/**
 * Portable Repository Interface for MockTest Studio.
 * Default implementation uses Dexie (IndexedDB).
 * Can be swapped cleanly with a Supabase/Postgres or Firebase implementation in Phase 2.
 */
export interface IQuestionBankRepository {
  // Import & Export
  importPayload(
    payload: RawImportPayload,
    strategy: DuplicateResolutionStrategy
  ): Promise<ImportSummary>;
  exportToJson(paperId?: string): Promise<RawImportPayload>;

  // Papers & Sections
  getPapers(): Promise<Paper[]>;
  getPaperById(id: string): Promise<Paper | undefined>;
  findPaperByIdentity(
    exam: string,
    year: number,
    date: string,
    shift: string
  ): Promise<Paper | undefined>;
  deletePaper(id: string): Promise<void>;
  getSectionsByPaperId(paperId: string): Promise<Section[]>;
  getAllSections(): Promise<Section[]>;

  // Questions
  getQuestions(filter?: QuestionFilter): Promise<Question[]>;
  getQuestionById(id: string): Promise<Question | undefined>;
  getQuestionsByIds(ids: string[]): Promise<Question[]>;
  findQuestionsByHashes(hashes: string[]): Promise<Question[]>;
  updateQuestion(id: string, updates: Partial<Question>): Promise<void>;
  addQuestion(question: Omit<Question, 'id' | 'hash'>): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  attachQuestionImage(questionId: string, blob: Blob | null): Promise<void>;
  toggleBookmark(questionId: string): Promise<boolean>;
  toggleRevisionList(questionId: string): Promise<boolean>;

  // Stats & Facets
  getBankStats(): Promise<BankStats>;
  getDistinctFacets(): Promise<{
    exams: string[];
    years: number[];
    shifts: string[];
    sections: string[];
    topics: string[];
  }>;

  // Custom Tests
  getCustomTests(): Promise<CustomTest[]>;
  getCustomTestById(id: string): Promise<CustomTest | undefined>;
  saveCustomTest(test: CustomTest): Promise<void>;
  deleteCustomTest(id: string): Promise<void>;

  // Attempts
  getAttempts(targetId?: string): Promise<Attempt[]>;
  getAttemptById(id: string): Promise<Attempt | undefined>;
  getInProgressAttempt(): Promise<Attempt | undefined>;
  saveAttempt(attempt: Attempt): Promise<void>;
  deleteAttempt(id: string): Promise<void>;
  getPreviouslyWrongQuestionIds(): Promise<Set<string>>;

  // AI Explanation Cache
  getAiExplanation(
    questionId: string,
    optionIndex: 0 | 1 | 2 | 3
  ): Promise<AiExplanation | undefined>;
  saveAiExplanation(explanation: AiExplanation): Promise<void>;

  // Maintenance
  clearAllData(): Promise<void>;
}
