import {
  Paper,
  Section,
  Question,
  RawImportPayload,
  RawImportPaper,
  RawImportSection,
  RawImportQuestion,
} from '../../types/schema';

/**
 * Reconstructs a schemaVersion "1.0" JSON payload from database entities.
 */
export function buildExportPayload(
  papers: Paper[],
  sections: Section[],
  questions: Question[]
): RawImportPayload {
  const sectionsByPaper = new Map<string, Section[]>();
  sections.forEach((sec) => {
    const list = sectionsByPaper.get(sec.paperId) || [];
    list.push(sec);
    sectionsByPaper.set(sec.paperId, list);
  });

  const questionsBySection = new Map<string, Question[]>();
  questions.forEach((q) => {
    const list = questionsBySection.get(q.sectionId) || [];
    list.push(q);
    questionsBySection.set(q.sectionId, list);
  });

  const exportPapers: RawImportPaper[] = papers.map((paper) => {
    const paperSections = (sectionsByPaper.get(paper.id) || []).sort(
      (a, b) => a.order - b.order
    );

    const rawSections: RawImportSection[] = paperSections.map((sec) => {
      const secQuestions = (questionsBySection.get(sec.id) || []).sort(
        (a, b) => a.qNo - b.qNo
      );

      const rawQuestions: RawImportQuestion[] = secQuestions.map((q) => ({
        chapter: q.chapter,
        searchText: q.searchText,
        sourceFile: q.sourceFile,
        sourceQuestionId: q.sourceQuestionId,
        sourcePages: q.sourcePages,
        sourceSection: q.sourceSection,
        extractionStatus: q.extractionStatus,
        answerStatus: q.answerStatus,
        qNo: q.qNo,
        text: q.text,
        textHi: q.textHi || '',
        options: q.options,
        optionsHi: q.optionsHi || ['', '', '', ''],
        correctIndex: q.correctIndex,
        explanation: q.explanation || '',
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        topic: q.topic || 'General',
        hasImage: Boolean(q.hasImage),
        imageDescription: q.imageDescription || '',
      }));

      return {
        name: sec.name,
        ...(sec.durationMin !== null ? { durationMin: sec.durationMin } : {}),
        ...(sec.markingOverride !== null ? { marking: sec.markingOverride } : {}),
        questions: rawQuestions,
      };
    });

    return {
      sourceFile: paper.sourceFile,
      sourceDurationMin: paper.sourceDurationMin,
      dateKind: paper.dateKind,
      exam: paper.exam,
      paperName: paper.paperName,
      year: paper.year,
      date: paper.date,
      shift: paper.shift,
      durationMin: paper.durationMin,
      totalMarks: paper.totalMarks,
      marking: {
        correct: paper.markingCorrect,
        negative: paper.markingNegative,
      },
      sections: rawSections,
    };
  });

  return {
    schemaVersion: '1.0',
    papers: exportPapers,
  };
}

/**
 * Triggers a browser file download of a JSON payload.
 */
export function downloadJsonFile(payload: unknown, filename: string): void {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
