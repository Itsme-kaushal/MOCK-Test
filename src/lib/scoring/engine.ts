import {
  Question,
  Section,
  AttemptConfig,
  SectionStat,
} from '../../types/schema';

export interface ScoringInput {
  questions: Question[];
  sections: Section[];
  answers: Record<string, number | null>; // questionId -> original option index (0..3) or null
  timePerQ: Record<string, number>; // questionId -> seconds spent
  config: AttemptConfig;
}

export interface TopicAccuracyStat {
  topic: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  avgTimeSec: number;
}

export interface ScoringOutput {
  score: number;
  totalPossibleMarks: number;
  negativeMarksLost: number;
  accuracy: number;
  totalQuestions: number;
  scorableQuestions: number;
  excludedNullAnswerQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  totalTimeSec: number;
  sectionStats: SectionStat[];
  topicStats: TopicAccuracyStat[];
}

/**
 * Pure, deterministic scoring engine for MockTest Studio.
 * - Excludes questions where correctIndex === null from scoring and maxPossibleMarks.
 * - Honors section-level marking overrides (when config.useSectionMarkingOverride is true)
 *   or question-level marks, falling back to config.markingCorrect / config.markingNegative.
 */
export function evaluateAttempt(input: ScoringInput): ScoringOutput {
  const { questions, sections, answers, timePerQ, config } = input;

  const sectionMap = new Map<string, Section>();
  sections.forEach((s) => sectionMap.set(s.id, s));

  const sectionAccMap = new Map<
    string,
    {
      sectionId: string;
      sectionName: string;
      order: number;
      totalQuestions: number;
      scorableQuestions: number;
      attempted: number;
      correct: number;
      wrong: number;
      unattempted: number;
      score: number;
      maxScore: number;
      negativeMarksLost: number;
      timeSpentSec: number;
    }
  >();

  const topicAccMap = new Map<
    string,
    {
      topic: string;
      total: number;
      attempted: number;
      correct: number;
      wrong: number;
      timeSec: number;
    }
  >();

  let totalScore = 0;
  let totalPossibleMarks = 0;
  let totalNegativeMarksLost = 0;
  let totalScorableQuestions = 0;
  let excludedNullAnswerQuestions = 0;
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let totalTimeSec = 0;

  for (const q of questions) {
    const sec = sectionMap.get(q.sectionId);
    const secId = sec ? sec.id : q.sectionId || 'custom_sec';
    const secName = sec ? sec.name : 'General Section';
    const secOrder = sec ? sec.order : 999;

    if (!sectionAccMap.has(secId)) {
      sectionAccMap.set(secId, {
        sectionId: secId,
        sectionName: secName,
        order: secOrder,
        totalQuestions: 0,
        scorableQuestions: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        unattempted: 0,
        score: 0,
        maxScore: 0,
        negativeMarksLost: 0,
        timeSpentSec: 0,
      });
    }
    const secStat = sectionAccMap.get(secId)!;
    secStat.totalQuestions++;

    const qTime = timePerQ[q.id] || 0;
    secStat.timeSpentSec += qTime;
    totalTimeSec += qTime;

    // Exclude questions with correctIndex === null from scoring
    if (q.correctIndex === null || q.answerStatus === 'withdrawn') {
      excludedNullAnswerQuestions++;
      continue;
    }

    // Determine effective marks for this question
    let posMarks = config.markingCorrect;
    let negMarks = config.markingNegative;

    if (config.useSectionMarkingOverride && sec?.markingOverride) {
      posMarks = sec.markingOverride.correct;
      negMarks = sec.markingOverride.negative;
    } else if (q.marks > 0) {
      posMarks = q.marks;
      negMarks = q.negativeMarks;
    }

    totalScorableQuestions++;
    secStat.scorableQuestions++;
    totalPossibleMarks += posMarks;
    secStat.maxScore += posMarks;

    const topicKey = q.topic || 'General';
    if (!topicAccMap.has(topicKey)) {
      topicAccMap.set(topicKey, {
        topic: topicKey,
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        timeSec: 0,
      });
    }
    const topStat = topicAccMap.get(topicKey)!;
    topStat.total++;
    topStat.timeSec += qTime;

    const selected = answers[q.id];
    if (selected === undefined || selected === null) {
      totalUnattempted++;
      secStat.unattempted++;
    } else {
      totalAttempted++;
      secStat.attempted++;
      topStat.attempted++;

      if (selected === q.correctIndex) {
        totalCorrect++;
        secStat.correct++;
        topStat.correct++;
        totalScore += posMarks;
        secStat.score += posMarks;
      } else {
        totalWrong++;
        secStat.wrong++;
        topStat.wrong++;
        totalScore -= negMarks;
        secStat.score -= negMarks;
        totalNegativeMarksLost += negMarks;
        secStat.negativeMarksLost += negMarks;
      }
    }
  }

  const sectionStats: SectionStat[] = Array.from(sectionAccMap.values())
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      totalQuestions: s.totalQuestions,
      scorableQuestions: s.scorableQuestions,
      attempted: s.attempted,
      correct: s.correct,
      wrong: s.wrong,
      unattempted: s.unattempted,
      score: Number(s.score.toFixed(2)),
      maxScore: Number(s.maxScore.toFixed(2)),
      negativeMarksLost: Number(s.negativeMarksLost.toFixed(2)),
      accuracy:
        s.attempted > 0 ? Number(((s.correct / s.attempted) * 100).toFixed(2)) : 0,
      timeSpentSec: s.timeSpentSec,
    }));

  const topicStats: TopicAccuracyStat[] = Array.from(topicAccMap.values())
    .map((t) => ({
      topic: t.topic,
      total: t.total,
      attempted: t.attempted,
      correct: t.correct,
      wrong: t.wrong,
      accuracy:
        t.attempted > 0 ? Number(((t.correct / t.attempted) * 100).toFixed(2)) : 0,
      avgTimeSec: t.total > 0 ? Math.round(t.timeSec / t.total) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const overallAccuracy =
    totalAttempted > 0
      ? Number(((totalCorrect / totalAttempted) * 100).toFixed(2))
      : 0;

  return {
    score: Number(totalScore.toFixed(2)),
    totalPossibleMarks: Number(totalPossibleMarks.toFixed(2)),
    negativeMarksLost: Number(totalNegativeMarksLost.toFixed(2)),
    accuracy: overallAccuracy,
    totalQuestions: questions.length,
    scorableQuestions: totalScorableQuestions,
    excludedNullAnswerQuestions,
    attempted: totalAttempted,
    correct: totalCorrect,
    wrong: totalWrong,
    unattempted: totalUnattempted,
    totalTimeSec,
    sectionStats,
    topicStats,
  };
}
