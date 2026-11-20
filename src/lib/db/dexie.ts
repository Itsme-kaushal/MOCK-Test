import Dexie, { type Table } from 'dexie';
import {
  Paper,
  Section,
  Question,
  CustomTest,
  Attempt,
  AiExplanation,
} from '../../types/schema';

export class MockTestDatabase extends Dexie {
  papers!: Table<Paper, string>;
  sections!: Table<Section, string>;
  questions!: Table<Question, string>;
  customTests!: Table<CustomTest, string>;
  attempts!: Table<Attempt, string>;
  aiExplanations!: Table<AiExplanation, [string, number]>;
  metadata!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('MockTestStudioDB');

    this.version(1).stores({
      papers: 'id, [exam+year+date+shift], exam, year, shift, importedAt',
      sections: 'id, paperId, [paperId+order], name',
      questions:
        'id, paperId, sectionId, qNo, hash, topic, correctIndex, bookmarked, inRevisionList, *tags',
      customTests: 'id, createdAt, name',
      attempts: 'id, targetId, targetType, status, startedAt, submittedAt',
      aiExplanations: '[questionId+optionIndex], questionId',
    });
    this.version(2).stores({ metadata: 'key' });
  }
}

export const db = new MockTestDatabase();
