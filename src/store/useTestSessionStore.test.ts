import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptConfig, Question } from '../types/schema';
import { remainingSeconds } from '../lib/timer';

vi.mock('../lib/db/dexieRepository', () => ({ repository: { saveAttempt: vi.fn().mockResolvedValue(undefined) } }));
import { createNewTestAttempt } from './useTestSessionStore';

const config: AttemptConfig = { durationMin: 180, sectionLock: false, perSectionDuration: false, markingCorrect: 1, markingNegative: .25, useSectionMarkingOverride: true, shuffleQuestions: false, shuffleOptions: false, language: 'en' };
const question = { id: 'q1', sectionId: 's1', options: ['a','b','c','d'] } as Question;

describe('timed attempts', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('fixes full papers at two hours and keeps the same deadline after a refresh', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const attempt = await createNewTestAttempt({ targetId: 'paper', targetType: 'paper', title: 'Paper', exam: 'DSSSB', questions: [question], config });
    expect(attempt.config.durationMin).toBe(120);
    expect(attempt.endTime).toBe(8_200_000);
    expect(remainingSeconds(attempt.endTime, 1_000_000)).toBe(7200);
    const resumed = JSON.parse(JSON.stringify(attempt));
    expect(remainingSeconds(resumed.endTime, 1_060_000)).toBe(7140);
    expect(remainingSeconds(resumed.endTime, 8_200_000)).toBe(0);
    expect(remainingSeconds(resumed.endTime, 9_000_000)).toBe(0);
  });
  it('allows a shorter topic drill and rejects empty tests', async () => {
    const params = { targetId: 'drill', targetType: 'custom' as const, title: 'Drill', exam: 'DSSSB', questions: [question], config: { ...config, durationMin: 20 } };
    expect((await createNewTestAttempt(params)).config.durationMin).toBe(20);
    await expect(createNewTestAttempt({ ...params, questions: [] })).rejects.toThrow('at least one');
  });
});
