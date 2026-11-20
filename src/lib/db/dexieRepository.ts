import { db } from './dexie';
import {
  IQuestionBankRepository,
  QuestionFilter,
  BankStats,
  ImportSummary,
} from '../../types/repository';
import {
  Paper,
  Section,
  Question,
  CustomTest,
  Attempt,
  AiExplanation,
  RawImportPayload,
  DuplicateResolutionStrategy,
} from '../../types/schema';
import { computeQuestionHash, computePaperIdentityKey } from '../import/validator';
import { buildExportPayload } from '../import/exporter';

export class DexieQuestionBankRepository implements IQuestionBankRepository {
  async importPayload(
    payload: RawImportPayload,
    strategy: DuplicateResolutionStrategy
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      papersAdded: 0,
      papersOverwritten: 0,
      papersSkipped: 0,
      questionsAdded: 0,
      questionsOverwritten: 0,
      questionsSkipped: 0,
    };

    await db.transaction('rw', [db.papers, db.sections, db.questions], async () => {
      const existingPapers = await db.papers.toArray();
      const paperIdentityMap = new Map<string, Paper>();
      for (const p of existingPapers) {
        paperIdentityMap.set(
          computePaperIdentityKey(p.exam, p.year, p.date, p.shift),
          p
        );
      }

      for (const rawPaper of payload.papers) {
        const identityKey = computePaperIdentityKey(
          rawPaper.exam,
          rawPaper.year,
          rawPaper.date,
          rawPaper.shift
        );
        const existingPaper = paperIdentityMap.get(identityKey);

        if (existingPaper && strategy === 'skip') {
          summary.papersSkipped++;
          const qCount = rawPaper.sections.reduce(
            (acc, s) => acc + s.questions.length,
            0
          );
          summary.questionsSkipped += qCount;
          continue;
        }

        let paperId: string = crypto.randomUUID();

        // Preserve existing question blobs and bookmarks if overwriting the same paper
        const preservedQuestionMeta = new Map<
          string,
          { id: string; imageBlob?: Blob | null; bookmarked: boolean; inRevisionList?: boolean; tags: string[] }
        >();
        const preservedSourceMeta = new Map<string, { id: string; imageBlob?: Blob | null; bookmarked: boolean; inRevisionList?: boolean; tags: string[] }>();
        const preservedSectionIds = new Map<string, string>();

        if (existingPaper && strategy === 'overwrite') {
          paperId = existingPaper.id;
          const oldQuestions = await db.questions
            .where('paperId')
            .equals(paperId)
            .toArray();
          for (const sec of await db.sections.where('paperId').equals(paperId).toArray()) preservedSectionIds.set(sec.name, sec.id);
          for (const oq of oldQuestions) {
            const meta = {
              id: oq.id,
              imageBlob: oq.imageBlob,
              bookmarked: oq.bookmarked,
              inRevisionList: oq.inRevisionList,
              tags: oq.tags,
            };
            preservedQuestionMeta.set(oq.hash, meta);
            if (oq.sourceQuestionId) preservedSourceMeta.set(oq.sourceQuestionId, meta);
          }

          await db.questions.where('paperId').equals(paperId).delete();
          await db.sections.where('paperId').equals(paperId).delete();
          summary.papersOverwritten++;
        } else {
          summary.papersAdded++;
        }

        const newPaper: Paper = {
          sourceFile: rawPaper.sourceFile,
          sourceDurationMin: rawPaper.sourceDurationMin,
          dateKind: rawPaper.dateKind,
          id: paperId,
          exam: rawPaper.exam.trim(),
          paperName: rawPaper.paperName.trim(),
          year: rawPaper.year,
          date: rawPaper.date.trim(),
          shift: rawPaper.shift.trim(),
          durationMin: rawPaper.durationMin,
          totalMarks: rawPaper.totalMarks,
          markingCorrect: rawPaper.marking.correct,
          markingNegative: rawPaper.marking.negative,
          importedAt: new Date().toISOString(),
        };

        await db.papers.put(newPaper);
        paperIdentityMap.set(identityKey, newPaper);

        const sectionsToInsert: Section[] = [];
        const questionsToInsert: Question[] = [];

        rawPaper.sections.forEach((rawSec, secIdx) => {
          const sectionId = preservedSectionIds.get(rawSec.name.trim()) || crypto.randomUUID();
          const effectiveMarking = rawSec.marking ?? rawPaper.marking;

          sectionsToInsert.push({
            id: sectionId,
            paperId,
            name: rawSec.name.trim(),
            order: secIdx + 1,
            durationMin: rawSec.durationMin ?? null,
            markingOverride: rawSec.marking ?? null,
          });

          rawSec.questions.forEach((rawQ) => {
            const hash = computeQuestionHash(rawQ.text, rawQ.options);
            const preserved = (rawQ.sourceQuestionId && preservedSourceMeta.get(rawQ.sourceQuestionId)) || preservedQuestionMeta.get(hash);

            questionsToInsert.push({
              chapter: rawQ.chapter || rawQ.topic || 'General',
              searchText: rawQ.searchText,
              sourceFile: rawQ.sourceFile,
              sourceQuestionId: rawQ.sourceQuestionId,
              sourcePages: rawQ.sourcePages,
              sourceSection: rawQ.sourceSection,
              extractionStatus: rawQ.extractionStatus,
              answerStatus: rawQ.answerStatus,
              id: preserved?.id || crypto.randomUUID(),
              paperId,
              sectionId,
              qNo: rawQ.qNo,
              text: rawQ.text,
              textHi: rawQ.textHi ?? '',
              options: rawQ.options,
              optionsHi: rawQ.optionsHi ?? ['', '', '', ''],
              correctIndex: rawQ.correctIndex ?? null,
              explanation: rawQ.explanation ?? '',
              marks: rawQ.marks ?? effectiveMarking.correct,
              negativeMarks: rawQ.negativeMarks ?? effectiveMarking.negative,
              topic: (rawQ.topic || 'General').trim(),
              hasImage: Boolean(rawQ.hasImage),
              imageBlob: preserved?.imageBlob ?? null,
              imageUrl: null,
              imageDescription: rawQ.imageDescription ?? '',
              hash,
              bookmarked: preserved?.bookmarked ?? false,
              inRevisionList: preserved?.inRevisionList ?? false,
              tags: preserved?.tags ?? [],
            });

            if (existingPaper && strategy === 'overwrite') {
              summary.questionsOverwritten++;
            } else {
              summary.questionsAdded++;
            }
          });
        });

        await db.sections.bulkPut(sectionsToInsert);
        await db.questions.bulkPut(questionsToInsert);
      }
    });

    return summary;
  }

  async exportToJson(paperId?: string): Promise<RawImportPayload> {
    if (paperId) {
      const paper = await db.papers.get(paperId);
      if (!paper) {
        return { schemaVersion: '1.0', papers: [] };
      }
      const sections = await db.sections.where('paperId').equals(paperId).toArray();
      const questions = await db.questions.where('paperId').equals(paperId).toArray();
      return buildExportPayload([paper], sections, questions);
    }

    const papers = await db.papers.toArray();
    const sections = await db.sections.toArray();
    const questions = await db.questions.toArray();
    return buildExportPayload(papers, sections, questions);
  }

  async getPapers(): Promise<Paper[]> {
    const papers = await db.papers.toArray();
    return papers.sort(
      (a, b) => b.year - a.year || b.importedAt.localeCompare(a.importedAt)
    );
  }

  async getPaperById(id: string): Promise<Paper | undefined> {
    return db.papers.get(id);
  }

  async findPaperByIdentity(
    exam: string,
    year: number,
    date: string,
    shift: string
  ): Promise<Paper | undefined> {
    const targetKey = computePaperIdentityKey(exam, year, date, shift);
    const all = await db.papers.toArray();
    return all.find(
      (p) => computePaperIdentityKey(p.exam, p.year, p.date, p.shift) === targetKey
    );
  }

  async deletePaper(id: string): Promise<void> {
    await db.transaction('rw', [db.papers, db.sections, db.questions], async () => {
      await db.questions.where('paperId').equals(id).delete();
      await db.sections.where('paperId').equals(id).delete();
      await db.papers.delete(id);
    });
  }

  async getSectionsByPaperId(paperId: string): Promise<Section[]> {
    const sections = await db.sections.where('paperId').equals(paperId).toArray();
    return sections.sort((a, b) => a.order - b.order);
  }

  async getAllSections(): Promise<Section[]> {
    return db.sections.toArray();
  }

  async getPreviouslyWrongQuestionIds(): Promise<Set<string>> {
    const attempts = await db.attempts.where('status').equals('submitted').toArray();
    const allQuestions = await db.questions.toArray();
    const qMap = new Map(allQuestions.map((q) => [q.id, q]));
    const wrongIds = new Set<string>();

    for (const att of attempts) {
      for (const [qId, selectedIdx] of Object.entries(att.answers)) {
        if (selectedIdx === null || selectedIdx === undefined) continue;
        const q = qMap.get(qId);
        if (q && q.correctIndex !== null && selectedIdx !== q.correctIndex) {
          wrongIds.add(qId);
        }
      }
    }
    return wrongIds;
  }

  async getQuestions(filter?: QuestionFilter): Promise<Question[]> {
    let questions = await db.questions.toArray();

    if (!filter) {
      return questions.sort((a, b) => a.qNo - b.qNo);
    }

    const [papers, sections, wrongSet] = await Promise.all([
      db.papers.toArray(),
      db.sections.toArray(),
      filter.previouslyWrongOnly
        ? this.getPreviouslyWrongQuestionIds()
        : Promise.resolve(new Set<string>()),
    ]);

    const paperMap = new Map(papers.map((p) => [p.id, p]));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));

    questions = questions.filter((q) => {
      const paper = paperMap.get(q.paperId);
      const section = sectionMap.get(q.sectionId);

      if (filter.paperId && q.paperId !== filter.paperId) return false;
      if (filter.sectionId && q.sectionId !== filter.sectionId) return false;
      if (filter.exam && paper?.exam !== filter.exam) return false;
      if (filter.year && paper?.year !== filter.year) return false;
      if (filter.shift && paper?.shift !== filter.shift) return false;
      if (filter.sectionName && section?.name !== filter.sectionName) return false;
      if (filter.topic && q.topic !== filter.topic) return false;
      if (filter.chapter && (q.chapter || q.topic) !== filter.chapter) return false;
      if (filter.bookmarkedOnly && !q.bookmarked) return false;
      if (filter.revisionOnly && !q.inRevisionList) return false;
      if (filter.hasImageOnly && !q.hasImage && ![q.text, ...q.options].some(t => t.includes('/question-assets/'))) return false;
      if (filter.previouslyWrongOnly && !wrongSet.has(q.id)) return false;

      if (filter.needsAttention) {
        const missingAnswer = q.correctIndex === null;
        const missingImage = q.hasImage && !q.imageBlob && !q.imageUrl;
        if (!missingAnswer && !missingImage && q.extractionStatus !== 'review') return false;
      }

      if (filter.keyword && filter.keyword.trim() !== '') {
        const kw = filter.keyword.trim().toLowerCase();
        const inText = q.text.toLowerCase().includes(kw);
        const inTextHi = q.textHi?.toLowerCase().includes(kw);
        const inTopic = q.topic.toLowerCase().includes(kw);
        const inExplanation = q.explanation?.toLowerCase().includes(kw);
        const inOptions = q.options.some((o) => o.toLowerCase().includes(kw));
        const inSearchText = q.searchText?.toLowerCase().includes(kw);
        const inChapter = q.chapter?.toLowerCase().includes(kw);
        if (!inText && !inTextHi && !inTopic && !inExplanation && !inOptions && !inSearchText && !inChapter) {
          return false;
        }
      }

      return true;
    });

    return questions.sort((a, b) => {
      if (a.paperId !== b.paperId) return a.paperId.localeCompare(b.paperId);
      return a.qNo - b.qNo;
    });
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    return db.questions.get(id);
  }

  async getQuestionsByIds(ids: string[]): Promise<Question[]> {
    const items = await db.questions.bulkGet(ids);
    return items.filter((item): item is Question => Boolean(item));
  }

  async findQuestionsByHashes(hashes: string[]): Promise<Question[]> {
    if (hashes.length === 0) return [];
    return db.questions.where('hash').anyOf(hashes).toArray();
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    const existing = await db.questions.get(id);
    if (!existing) return;

    const updatedText = updates.text ?? existing.text;
    const updatedOptions = updates.options ?? existing.options;
    const newHash = computeQuestionHash(updatedText, updatedOptions);

    await db.questions.update(id, {
      ...updates,
      hash: newHash,
    });
  }

  async addQuestion(questionData: Omit<Question, 'id' | 'hash'>): Promise<Question> {
    const hash = computeQuestionHash(questionData.text, questionData.options);
    const newQuestion: Question = {
      ...questionData,
      id: crypto.randomUUID(),
      hash,
    };
    await db.questions.add(newQuestion);
    return newQuestion;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db.questions.delete(id);
  }

  async attachQuestionImage(questionId: string, blob: Blob | null): Promise<void> {
    await db.questions.update(questionId, {
      imageBlob: blob,
      hasImage: blob !== null ? true : undefined,
    });
  }

  async toggleBookmark(questionId: string): Promise<boolean> {
    const q = await db.questions.get(questionId);
    if (!q) return false;
    const nextVal = !q.bookmarked;
    await db.questions.update(questionId, { bookmarked: nextVal });
    return nextVal;
  }

  async toggleRevisionList(questionId: string): Promise<boolean> {
    const q = await db.questions.get(questionId);
    if (!q) return false;
    const nextVal = !q.inRevisionList;
    await db.questions.update(questionId, { inRevisionList: nextVal });
    return nextVal;
  }

  async getBankStats(): Promise<BankStats> {
    const [papers, sections, questions] = await Promise.all([
      db.papers.toArray(),
      db.sections.toArray(),
      db.questions.toArray(),
    ]);

    const paperMap = new Map(papers.map((p) => [p.id, p]));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));

    let missingAnswerCount = 0;
    let missingImageCount = 0;
    let needsAttentionCount = 0;
    let bookmarkedCount = 0;
    let revisionCount = 0;

    const examQuestionCounts = new Map<string, number>();
    const examPaperCounts = new Map<string, number>();
    papers.forEach((p) => {
      examPaperCounts.set(p.exam, (examPaperCounts.get(p.exam) || 0) + 1);
    });

    const sectionCounts = new Map<string, number>();
    const topicCounts = new Map<string, number>();

    for (const q of questions) {
      const missingAns = q.correctIndex === null;
      const missingImg = q.hasImage && !q.imageBlob && !q.imageUrl;

      if (missingAns) missingAnswerCount++;
      if (missingImg) missingImageCount++;
      if (missingAns || missingImg || q.extractionStatus === 'review') needsAttentionCount++;
      if (q.bookmarked) bookmarkedCount++;
      if (q.inRevisionList) revisionCount++;

      const paper = paperMap.get(q.paperId);
      if (paper) {
        examQuestionCounts.set(
          paper.exam,
          (examQuestionCounts.get(paper.exam) || 0) + 1
        );
      }

      const sec = sectionMap.get(q.sectionId);
      const secName = sec?.name || 'Uncategorized';
      sectionCounts.set(secName, (sectionCounts.get(secName) || 0) + 1);

      const topicName = q.topic || 'General';
      topicCounts.set(topicName, (topicCounts.get(topicName) || 0) + 1);
    }

    const allExams = new Set([
      ...examPaperCounts.keys(),
      ...examQuestionCounts.keys(),
    ]);

    const questionsByExam = Array.from(allExams).map((exam) => ({
      exam,
      count: examQuestionCounts.get(exam) || 0,
      papers: examPaperCounts.get(exam) || 0,
    }));

    const questionsBySection = Array.from(sectionCounts.entries())
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count);

    const questionsByTopic = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalPapers: papers.length,
      totalQuestions: questions.length,
      needsAttentionCount,
      missingAnswerCount,
      missingImageCount,
      bookmarkedCount,
      revisionCount,
      questionsByExam,
      questionsBySection,
      questionsByTopic,
    };
  }

  async getDistinctFacets(): Promise<{
    exams: string[];
    years: number[];
    shifts: string[];
    sections: string[];
    topics: string[];
  }> {
    const [papers, sections, questions] = await Promise.all([
      db.papers.toArray(),
      db.sections.toArray(),
      db.questions.toArray(),
    ]);

    const exams = Array.from(new Set(papers.map((p) => p.exam))).sort();
    const years = Array.from(new Set(papers.map((p) => p.year))).sort(
      (a, b) => b - a
    );
    const shifts = Array.from(new Set(papers.map((p) => p.shift))).sort();
    const sectionNames = Array.from(new Set(sections.map((s) => s.name))).sort();
    const topics = Array.from(new Set(questions.map((q) => q.topic))).sort();

    return {
      exams,
      years,
      shifts,
      sections: sectionNames,
      topics,
    };
  }

  // Custom Tests
  async getCustomTests(): Promise<CustomTest[]> {
    const list = await db.customTests.toArray();
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCustomTestById(id: string): Promise<CustomTest | undefined> {
    return db.customTests.get(id);
  }

  async saveCustomTest(test: CustomTest): Promise<void> {
    await db.customTests.put(test);
  }

  async deleteCustomTest(id: string): Promise<void> {
    await db.customTests.delete(id);
  }

  // Attempts
  async getAttempts(targetId?: string): Promise<Attempt[]> {
    let list = targetId
      ? await db.attempts.where('targetId').equals(targetId).toArray()
      : await db.attempts.toArray();
    return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getAttemptById(id: string): Promise<Attempt | undefined> {
    return db.attempts.get(id);
  }

  async getInProgressAttempt(): Promise<Attempt | undefined> {
    return db.attempts.where('status').equals('in_progress').first();
  }

  async saveAttempt(attempt: Attempt): Promise<void> {
    await db.attempts.put(attempt);
  }

  async deleteAttempt(id: string): Promise<void> {
    await db.attempts.delete(id);
  }

  // AI Explanation Cache
  async getAiExplanation(
    questionId: string,
    optionIndex: 0 | 1 | 2 | 3
  ): Promise<AiExplanation | undefined> {
    return db.aiExplanations.get([questionId, optionIndex]);
  }

  async saveAiExplanation(explanation: AiExplanation): Promise<void> {
    await db.aiExplanations.put(explanation);
  }

  async clearAllData(): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.papers,
        db.sections,
        db.questions,
        db.customTests,
        db.attempts,
        db.aiExplanations,
      ],
      async () => {
        await db.papers.clear();
        await db.sections.clear();
        await db.questions.clear();
        await db.customTests.clear();
        await db.attempts.clear();
        await db.aiExplanations.clear();
      }
    );
  }
}

export const repository = new DexieQuestionBankRepository();
