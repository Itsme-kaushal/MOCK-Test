import { describe, it, expect } from 'vitest';
import {
  validateImportJson,
  computeQuestionHash,
  computePaperIdentityKey,
} from './validator';

describe('JSON Import Validator (src/lib/import/validator.ts)', () => {
  const validMinimalJson = JSON.stringify(
    {
      schemaVersion: '1.0',
      papers: [
        {
          exam: 'SSC CGL',
          paperName: 'SSC CGL Tier-1 Mock',
          year: 2025,
          date: '2025-09-14',
          shift: 'Shift 1',
          durationMin: 60,
          totalMarks: 200,
          marking: { correct: 2, negative: 0.5 },
          sections: [
            {
              name: 'Quantitative Aptitude',
              questions: [
                {
                  qNo: 1,
                  text: 'If $x + \\frac{1}{x} = 5$, find $x^2 + \\frac{1}{x^2}$.',
                  options: ['23', '25', '27', '21'],
                  correctIndex: 0,
                },
                {
                  qNo: 2,
                  text: 'Observe the given bar chart and find the ratio.',
                  options: ['3:4', '4:5', '2:3', '5:6'],
                  correctIndex: null,
                  hasImage: true,
                  imageDescription: 'Bar chart of annual exports',
                },
              ],
            },
          ],
        },
      ],
    },
    null,
    2
  );

  it('validates a well-formed payload and populates sensible defaults for optional fields', () => {
    const result = validateImportJson(validMinimalJson);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalizedPayload).toBeDefined();

    const q1 = result.normalizedPayload!.papers[0].sections[0].questions[0];
    expect(q1.marks).toBe(2);
    expect(q1.negativeMarks).toBe(0.5);
    expect(q1.topic).toBe('General');
    expect(q1.textHi).toBe('');
    expect(q1.optionsHi).toEqual(['', '', '', '']);
    expect(q1.hasImage).toBe(false);

    // Warnings for Q2 (missing_answer + has_image)
    expect(result.warnings.some((w) => w.type === 'missing_answer' && w.qNo === 2)).toBe(true);
    expect(result.warnings.some((w) => w.type === 'has_image' && w.qNo === 2)).toBe(true);
  });

  it('rejects malformed JSON and provides line number information', () => {
    const brokenJson = `{\n  "schemaVersion": "1.0",\n  "papers": [\n    { "exam": "SSC" \n  ]\n}`;
    const result = validateImportJson(brokenJson);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/JSON Syntax Error/i);
    expect(result.errors[0].line).toBeGreaterThanOrEqual(1);
  });

  it('rejects wrong schemaVersion', () => {
    const badVersion = JSON.stringify({
      schemaVersion: '2.0',
      papers: [],
    });
    const result = validateImportJson(badVersion);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
  });

  it('rejects questions that do not have exactly 4 options', () => {
    const threeOptions = JSON.stringify({
      schemaVersion: '1.0',
      papers: [
        {
          exam: 'GATE',
          paperName: 'GATE CS',
          year: 2025,
          date: '2025-02-01',
          shift: 'Morning',
          durationMin: 180,
          totalMarks: 100,
          marking: { correct: 2, negative: 0.66 },
          sections: [
            {
              name: 'Algorithms',
              questions: [
                {
                  qNo: 1,
                  text: 'Time complexity of Merge Sort?',
                  options: ['O(n)', 'O(n log n)', 'O(n^2)'],
                  correctIndex: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    const result = validateImportJson(threeOptions);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.message.includes('options must have exactly 4 entries')
      )
    ).toBe(true);
  });

  it('rejects unknown fields due to strict schema validation', () => {
    const unknownFieldJson = JSON.stringify({
      schemaVersion: '1.0',
      unexpectedRootProp: true,
      papers: [],
    });
    const result = validateImportJson(unknownFieldJson);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes('Unknown field(s)'))
    ).toBe(true);
  });

  it('detects duplicate papers and duplicate question hashes against existing bank', () => {
    const identityKey = computePaperIdentityKey('SSC CGL', 2025, '2025-09-14', 'Shift 1');
    const q1Hash = computeQuestionHash('If $x + \\frac{1}{x} = 5$, find $x^2 + \\frac{1}{x^2}$.', [
      '23',
      '25',
      '27',
      '21',
    ]);

    const result = validateImportJson(validMinimalJson, {
      existingPaperIdentities: new Map([[identityKey, 'existing-paper-uuid']]),
      existingQuestionHashes: new Set([q1Hash]),
    });

    expect(result.valid).toBe(true);
    expect(result.previews[0].isDuplicatePaper).toBe(true);
    expect(result.previews[0].existingPaperId).toBe('existing-paper-uuid');
    expect(result.warnings.some((w) => w.type === 'duplicate_paper')).toBe(true);
    expect(result.warnings.some((w) => w.type === 'duplicate_question')).toBe(true);
  });
});
