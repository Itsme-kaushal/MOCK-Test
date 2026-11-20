export type CorrectIndex = 0 | 1 | 2 | 3 | null;

export interface MarkingScheme {
  correct: number;
  negative: number;
}

// ==========================================
// 1. JSON IMPORT SCHEMA TYPES (v1.0)
// ==========================================

export interface QuestionSource {
  chapter?: string;
  searchText?: string;
  sourceFile?: string;
  sourceQuestionId?: string;
  sourcePages?: number[];
  sourceSection?: string;
  extractionStatus?: 'extracted' | 'review';
  answerStatus?: 'provided' | 'withdrawn' | 'missing';
}

export interface RawImportQuestion extends QuestionSource {
  qNo: number;
  text: string;
  textHi?: string;
  options: [string, string, string, string];
  optionsHi?: [string, string, string, string];
  correctIndex: CorrectIndex;
  explanation?: string;
  marks?: number;
  negativeMarks?: number;
  topic?: string;
  hasImage?: boolean;
  imageDescription?: string;
}

export interface RawImportSection {
  name: string;
  durationMin?: number | null;
  marking?: MarkingScheme | null;
  questions: RawImportQuestion[];
}

export interface RawImportPaper {
  sourceFile?: string;
  sourceDurationMin?: number;
  dateKind?: string;
  exam: string;
  paperName: string;
  year: number;
  date: string;
  shift: string;
  durationMin: number;
  totalMarks: number;
  marking: MarkingScheme;
  sections: RawImportSection[];
}

export interface RawImportPayload {
  schemaVersion: '1.0';
  papers: RawImportPaper[];
}

// ==========================================
// 2. DATABASE ENTITY TYPES (Dexie / SQL Portable)
// ==========================================

export interface Paper {
  sourceFile?: string;
  sourceDurationMin?: number;
  dateKind?: string;
  id: string;
  exam: string;
  paperName: string;
  year: number;
  date: string;
  shift: string;
  durationMin: number;
  totalMarks: number;
  markingCorrect: number;
  markingNegative: number;
  importedAt: string;
}

export interface Section {
  id: string;
  paperId: string;
  name: string;
  order: number;
  durationMin: number | null;
  markingOverride: MarkingScheme | null;
}

export interface Question extends QuestionSource {
  id: string;
  paperId: string;
  sectionId: string;
  qNo: number;
  text: string;
  textHi: string;
  options: [string, string, string, string];
  optionsHi: [string, string, string, string];
  correctIndex: CorrectIndex;
  explanation: string;
  marks: number;
  negativeMarks: number;
  topic: string;
  hasImage: boolean;
  imageBlob?: Blob | null;
  imageUrl?: string | null;
  imageDescription: string;
  hash: string;
  bookmarked: boolean;
  inRevisionList?: boolean;
  tags: string[];
}

export type TestLanguage = 'en' | 'hi' | 'bilingual';

export interface CustomTest {
  id: string;
  name: string;
  questionIds: string[];
  durationMin: number;
  sectionLock: boolean;
  markingCorrect: number;
  markingNegative: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  language: TestLanguage;
  createdAt: string;
}

export interface SectionStat {
  sectionId: string;
  sectionName: string;
  totalQuestions: number;
  scorableQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  maxScore: number;
  negativeMarksLost: number;
  accuracy: number;
  timeSpentSec: number;
}

export interface AttemptConfig {
  durationMin: number;
  sectionLock: boolean;
  perSectionDuration: boolean;
  markingCorrect: number;
  markingNegative: number;
  useSectionMarkingOverride: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  language: TestLanguage;
}

export interface Attempt {
  id: string;
  targetId: string; // paperId or customTestId
  targetType: 'paper' | 'custom';
  title: string;
  exam: string;
  status: 'in_progress' | 'submitted';
  config: AttemptConfig;
  questionIds: string[];
  optionPermutations: Record<string, [number, number, number, number]>;
  answers: Record<string, number | null>; // questionId -> original option index (0-3) or null
  markedForReview: string[]; // questionIds
  visited: string[]; // questionIds
  timePerQ: Record<string, number>; // questionId -> seconds spent
  activeQuestionId?: string;
  activeSectionId?: string;
  tabSwitchCount: number;
  startedAt: string;
  endTime: number; // epoch ms so countdown survives page refresh
  submittedAt: string | null;
  score: number;
  totalPossibleMarks: number;
  negativeMarksLost: number;
  accuracy: number;
  sectionStats: SectionStat[];
}

export interface AiExplanation {
  questionId: string;
  optionIndex: 0 | 1 | 2 | 3;
  text: string;
  createdAt: string;
}

// ==========================================
// 3. IMPORT VALIDATION & PREVIEW TYPES
// ==========================================

export interface LineError {
  path: string;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export interface ImportWarning {
  type: 'missing_answer' | 'empty_option' | 'duplicate_qno' | 'has_image' | 'duplicate_paper' | 'duplicate_question';
  paperIndex: number;
  paperTitle: string;
  sectionName?: string;
  qNo?: number;
  message: string;
  existingId?: string;
}

export interface ValidatedPaperPreview {
  paperIndex: number;
  exam: string;
  paperName: string;
  year: number;
  date: string;
  shift: string;
  durationMin: number;
  totalMarks: number;
  marking: MarkingScheme;
  isDuplicatePaper: boolean;
  existingPaperId?: string;
  sections: {
    name: string;
    durationMin: number | null;
    marking: MarkingScheme | null;
    questionCount: number;
    missingAnswerCount: number;
    hasImageCount: number;
  }[];
  totalQuestions: number;
  duplicateQuestionHashes: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: LineError[];
  warnings: ImportWarning[];
  normalizedPayload?: RawImportPayload;
  previews: ValidatedPaperPreview[];
}

export type DuplicateResolutionStrategy = 'skip' | 'overwrite';
