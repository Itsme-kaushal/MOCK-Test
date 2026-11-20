import { z } from 'zod';

export const MarkingSchemeSchema = z
  .object({
    correct: z.number({
      required_error: 'marking.correct is required',
      invalid_type_error: 'marking.correct must be a positive number',
    }).positive('marking.correct must be greater than 0'),
    negative: z.number({
      required_error: 'marking.negative is required',
      invalid_type_error: 'marking.negative must be a non-negative number',
    }).min(0, 'marking.negative must be 0 or a positive number (e.g., 0.5 for -0.5 penalty)'),
  })
  .strict();

export const RawQuestionSchema = z
  .object({
    qNo: z
      .number({
        required_error: 'qNo is required',
        invalid_type_error: 'qNo must be an integer',
      })
      .int('qNo must be an integer')
      .positive('qNo must be >= 1'),
    text: z
      .string({
        required_error: 'Question text is required',
      })
      .min(1, 'Question text cannot be empty'),
    textHi: z.string().optional().default(''),
    options: z
      .array(z.string(), {
        required_error: 'options array is required',
        invalid_type_error: 'options must be an array of 4 strings',
      })
      .length(4, 'options must have exactly 4 entries')
      .transform((arr) => [arr[0], arr[1], arr[2], arr[3]] as [string, string, string, string]),
    optionsHi: z
      .array(z.string())
      .length(4, 'optionsHi must have exactly 4 entries when provided')
      .optional()
      .default(['', '', '', ''])
      .transform((arr) => [arr[0], arr[1], arr[2], arr[3]] as [string, string, string, string]),
    correctIndex: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.null(),
      ], {
        errorMap: () => ({
          message: 'correctIndex must be 0, 1, 2, 3, or null',
        }),
      })
      .optional()
      .default(null),
    explanation: z.string().optional().default(''),
    marks: z.number().positive('marks must be > 0').optional(),
    negativeMarks: z.number().min(0, 'negativeMarks must be >= 0').optional(),
    topic: z.string().optional().default('General'),
    chapter: z.string().optional(),
    searchText: z.string().optional(),
    sourceFile: z.string().optional(),
    sourceQuestionId: z.string().optional(),
    sourcePages: z.array(z.number().int().positive()).optional(),
    sourceSection: z.string().optional(),
    extractionStatus: z.enum(['extracted', 'review']).optional(),
    answerStatus: z.enum(['provided', 'withdrawn', 'missing']).optional(),
    hasImage: z.boolean().optional().default(false),
    imageDescription: z.string().optional().default(''),
  })
  .strict();

export const RawSectionSchema = z
  .object({
    name: z
      .string({ required_error: 'Section name is required' })
      .min(1, 'Section name cannot be empty'),
    durationMin: z.number().positive('Section durationMin must be > 0').nullable().optional().default(null),
    marking: MarkingSchemeSchema.nullable().optional().default(null),
    questions: z
      .array(RawQuestionSchema, {
        required_error: 'Section questions array is required',
      })
      .min(1, 'Each section must contain at least 1 question'),
  })
  .strict();

export const RawPaperSchema = z
  .object({
    sourceFile: z.string().optional(),
    sourceDurationMin: z.number().positive().optional(),
    dateKind: z.string().optional(),
    exam: z
      .string({ required_error: 'exam name is required' })
      .min(1, 'exam cannot be empty'),
    paperName: z
      .string({ required_error: 'paperName is required' })
      .min(1, 'paperName cannot be empty'),
    year: z
      .number({ required_error: 'year is required', invalid_type_error: 'year must be a number' })
      .int('year must be an integer')
      .min(1990, 'year must be >= 1990')
      .max(2100, 'year must be <= 2100'),
    date: z
      .string({ required_error: 'date is required' })
      .min(1, 'date cannot be empty'),
    shift: z
      .string({ required_error: 'shift is required' })
      .min(1, 'shift cannot be empty'),
    durationMin: z
      .number({ required_error: 'durationMin is required' })
      .positive('durationMin must be > 0'),
    totalMarks: z
      .number({ required_error: 'totalMarks is required' })
      .positive('totalMarks must be > 0'),
    marking: MarkingSchemeSchema,
    sections: z
      .array(RawSectionSchema, {
        required_error: 'sections array is required',
      })
      .min(1, 'Each paper must have at least 1 section'),
  })
  .strict();

export const RawImportPayloadSchema = z
  .object({
    schemaVersion: z.literal('1.0', {
      errorMap: () => ({
        message: 'schemaVersion must be exactly "1.0"',
      }),
    }),
    papers: z
      .array(RawPaperSchema, {
        required_error: 'papers array is required',
      })
      .min(1, 'Payload must contain at least 1 paper'),
  })
  .strict();
