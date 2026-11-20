import { ZodIssue } from 'zod';
import { RawImportPayloadSchema } from './schema';
import {
  LineError,
  ImportWarning,
  ValidationResult,
  ValidatedPaperPreview,
  RawImportPayload,
} from '../../types/schema';

/**
 * Generates a deterministic normalized hash for a question based on its text and 4 options.
 * Used for duplicate question detection across imports.
 */
export function computeQuestionHash(text: string, options: [string, string, string, string]): string {
  const normText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const normOpts = options.map((o) => o.trim().toLowerCase().replace(/\s+/g, ' ')).join('||');
  const combined = `${normText}###${normOpts}`;

  // FNV-1a 64-bit / dual 32-bit deterministic hash for fast synchronous execution in browser & Node
  let h1 = 0xdeadbeef ^ combined.length;
  let h2 = 0x41c6ce57 ^ combined.length;

  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `qhash_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Creates a canonical identity key for a paper (exam + year + date + shift)
 */
export function computePaperIdentityKey(
  exam: string,
  year: number,
  date: string,
  shift: string
): string {
  return [
    exam.trim().toLowerCase(),
    String(year).trim(),
    date.trim().toLowerCase(),
    shift.trim().toLowerCase(),
  ].join('::');
}

/**
 * Extracts line and column from a JSON.parse SyntaxError message if available.
 */
function locateJsonSyntaxError(rawText: string, err: Error): LineError {
  const msg = err.message || 'Invalid JSON syntax';
  const posMatch = msg.match(/position\s+(\d+)/i);
  const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);

  const lines = rawText.split(/\r?\n/);

  if (lineColMatch) {
    const line = parseInt(lineColMatch[1], 10);
    const column = parseInt(lineColMatch[2], 10);
    return {
      path: '$root',
      message: `JSON Syntax Error: ${msg}`,
      line,
      column,
      snippet: lines[line - 1]?.trim().slice(0, 120),
    };
  }

  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const nextPos = currentPos + lines[i].length + 1;
      if (pos <= nextPos) {
        const line = i + 1;
        const column = pos - currentPos + 1;
        return {
          path: '$root',
          message: `JSON Syntax Error: ${msg}`,
          line,
          column,
          snippet: lines[i]?.trim().slice(0, 120),
        };
      }
      currentPos = nextPos;
    }
  }

  return {
    path: '$root',
    message: `JSON Syntax Error: ${msg}`,
    line: 1,
    column: 1,
    snippet: lines[0]?.trim().slice(0, 120),
  };
}

/**
 * Locates the approximate line number in raw JSON text corresponding to a Zod issue path.
 */
function findLineForZodPath(rawText: string, path: (string | number)[]): { line?: number; snippet?: string } {
  const lines = rawText.split(/\r?\n/);
  if (path.length === 0) {
    return { line: 1, snippet: lines[0]?.trim().slice(0, 120) };
  }

  let currentLineIdx = 0;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (typeof segment === 'string') {
      const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`"${escaped}"\\s*:`);
      for (let l = currentLineIdx; l < lines.length; l++) {
        if (regex.test(lines[l])) {
          currentLineIdx = l;
          break;
        }
      }
    } else if (typeof segment === 'number' && i > 0) {
      const parentKey = path[i - 1];
      if (parentKey === 'papers' || parentKey === 'sections' || parentKey === 'questions') {
        const markerKey =
          parentKey === 'papers'
            ? '"exam"'
            : parentKey === 'sections'
            ? '"name"'
            : '"qNo"';
        let count = -1;
        for (let l = currentLineIdx; l < lines.length; l++) {
          if (lines[l].includes(markerKey)) {
            count++;
            if (count === segment) {
              currentLineIdx = l;
              break;
            }
          }
        }
      }
    }
  }

  return {
    line: currentLineIdx + 1,
    snippet: lines[currentLineIdx]?.trim().slice(0, 120),
  };
}

function formatZodIssue(rawText: string, issue: ZodIssue): LineError {
  const pathStr = issue.path.length > 0 ? issue.path.join('.') : '$root';
  const { line, snippet } = findLineForZodPath(rawText, issue.path);

  let message = issue.message;
  if (issue.code === 'unrecognized_keys') {
    message = `Unknown field(s) not allowed in schema v1.0: ${issue.keys.map((k) => `"${k}"`).join(', ')}`;
  }

  return {
    path: pathStr,
    message,
    line,
    snippet,
  };
}

export interface ExistingBankLookup {
  existingPaperIdentities?: Map<string, string>; // identityKey -> paperId
  existingQuestionHashes?: Set<string>;
}

/**
 * Validates raw JSON text against the MockTest Studio v1.0 schema,
 * fills sensible defaults for optional fields, and computes warnings & previews.
 */
export function validateImportJson(
  rawText: string,
  lookup: ExistingBankLookup = {}
): ValidationResult {
  if (!rawText || !rawText.trim()) {
    return {
      valid: false,
      errors: [
        {
          path: '$root',
          message: 'JSON input is empty. Please upload a .json file or paste valid JSON.',
          line: 1,
        },
      ],
      warnings: [],
      previews: [],
    };
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawText);
  } catch (err) {
    return {
      valid: false,
      errors: [locateJsonSyntaxError(rawText, err as Error)],
      warnings: [],
      previews: [],
    };
  }

  const parseResult = RawImportPayloadSchema.safeParse(parsedRaw);

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((issue) => formatZodIssue(rawText, issue));
    return {
      valid: false,
      errors,
      warnings: [],
      previews: [],
    };
  }

  const payload = parseResult.data as RawImportPayload;
  const warnings: ImportWarning[] = [];
  const previews: ValidatedPaperPreview[] = [];
  const seenPaperIdentitiesInPayload = new Set<string>();

  payload.papers.forEach((paper, paperIndex) => {
    const paperTitle = `${paper.exam} - ${paper.paperName} (${paper.year}, ${paper.date}, ${paper.shift})`;
    const identityKey = computePaperIdentityKey(paper.exam, paper.year, paper.date, paper.shift);

    // Check duplicate paper within same JSON file
    if (seenPaperIdentitiesInPayload.has(identityKey)) {
      warnings.push({
        type: 'duplicate_paper',
        paperIndex,
        paperTitle,
        message: `Duplicate paper in the same import payload: "${paperTitle}" appears more than once.`,
      });
    }
    seenPaperIdentitiesInPayload.add(identityKey);

    // Check duplicate paper against existing database
    const existingPaperId = lookup.existingPaperIdentities?.get(identityKey);
    const isDuplicatePaper = Boolean(existingPaperId);
    if (isDuplicatePaper) {
      warnings.push({
        type: 'duplicate_paper',
        paperIndex,
        paperTitle,
        existingId: existingPaperId,
        message: `Paper "${paperTitle}" already exists in the Question Bank. Choose whether to skip or overwrite.`,
      });
    }

    const seenQNosInPaper = new Set<number>();
    const duplicateQuestionHashes: string[] = [];
    let totalQuestions = 0;

    const sectionPreviews = paper.sections.map((section) => {
      const effectiveMarking = section.marking ?? paper.marking;
      let missingAnswerCount = 0;
      let hasImageCount = 0;

      section.questions.forEach((q) => {
        totalQuestions++;

        // Fill defaults for marks and negativeMarks from section/paper marking scheme
        if (q.marks === undefined) {
          q.marks = effectiveMarking.correct;
        }
        if (q.negativeMarks === undefined) {
          q.negativeMarks = effectiveMarking.negative;
        }

        // Check duplicate qNo within paper
        if (seenQNosInPaper.has(q.qNo)) {
          warnings.push({
            type: 'duplicate_qno',
            paperIndex,
            paperTitle,
            sectionName: section.name,
            qNo: q.qNo,
            message: `Duplicate question number Q.${q.qNo} in section "${section.name}".`,
          });
        }
        seenQNosInPaper.add(q.qNo);

        // Check missing answer
        if (q.correctIndex === null) {
          missingAnswerCount++;
          warnings.push({
            type: 'missing_answer',
            paperIndex,
            paperTitle,
            sectionName: section.name,
            qNo: q.qNo,
            message: `Q.${q.qNo} (${section.name}) has correctIndex = null. It will be flagged as "Needs Attention" and excluded from scoring until an answer is set.`,
          });
        }

        // Check empty options
        const hasEmptyOption = q.options.some((opt) => !opt || opt.trim().length === 0);
        if (hasEmptyOption) {
          warnings.push({
            type: 'empty_option',
            paperIndex,
            paperTitle,
            sectionName: section.name,
            qNo: q.qNo,
            message: `Q.${q.qNo} (${section.name}) has one or more blank option strings.`,
          });
        }

        // Check hasImage
        if (q.hasImage) {
          hasImageCount++;
          warnings.push({
            type: 'has_image',
            paperIndex,
            paperTitle,
            sectionName: section.name,
            qNo: q.qNo,
            message: `Q.${q.qNo} (${section.name}) requires an image (${q.imageDescription || 'No description'}). You can attach an image in the Question Bank editor.`,
          });
        }

        // Check duplicate question hash in existing DB
        const qHash = computeQuestionHash(q.text, q.options);
        if (lookup.existingQuestionHashes?.has(qHash)) {
          duplicateQuestionHashes.push(qHash);
          warnings.push({
            type: 'duplicate_question',
            paperIndex,
            paperTitle,
            sectionName: section.name,
            qNo: q.qNo,
            message: `Q.${q.qNo} (${section.name}) matches an existing question in the bank (identical normalized text & options).`,
          });
        }
      });

      return {
        name: section.name,
        durationMin: section.durationMin ?? null,
        marking: section.marking ?? null,
        questionCount: section.questions.length,
        missingAnswerCount,
        hasImageCount,
      };
    });

    previews.push({
      paperIndex,
      exam: paper.exam,
      paperName: paper.paperName,
      year: paper.year,
      date: paper.date,
      shift: paper.shift,
      durationMin: paper.durationMin,
      totalMarks: paper.totalMarks,
      marking: paper.marking,
      isDuplicatePaper,
      existingPaperId,
      sections: sectionPreviews,
      totalQuestions,
      duplicateQuestionHashes,
    });
  });

  return {
    valid: true,
    errors: [],
    warnings,
    normalizedPayload: payload,
    previews,
  };
}
