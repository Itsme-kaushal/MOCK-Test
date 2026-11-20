import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { RawImportPayloadSchema } from './schema';

const root = process.cwd();
const bank = JSON.parse(readFileSync(resolve(root, 'public/extracted-question-bank.json'), 'utf8'));
const report = JSON.parse(readFileSync(resolve(root, 'public/extraction-report.json'), 'utf8'));

describe('extracted PDF corpus', () => {
  it('imports every English question from all nine papers', () => {
    expect(RawImportPayloadSchema.safeParse(bank).success).toBe(true);
    expect(bank.papers).toHaveLength(9);
    const all = bank.papers.flatMap((p: any) => p.sections.flatMap((s: any) => s.questions));
    expect(all).toHaveLength(2020);
    expect(all.filter((q: any) => q.correctIndex === null)).toHaveLength(24);
    expect(all.filter((q: any) => q.answerStatus === 'withdrawn')).toHaveLength(24);
    expect(all.find((q: any) => q.sourceFile === 'tgt_computer_science1.pdf' && q.qNo === 1).correctIndex).toBe(3);
  });
  it('preserves question numbers, passages, source provenance and all four options', () => {
    for (const p of bank.papers) {
      expect(p.durationMin).toBe(120);
      const qs = p.sections.flatMap((s: any) => s.questions);
      const source = report.papers.find((r: any) => r.sourceFile === p.sourceFile);
      expect(qs).toHaveLength(p.exam === 'DSSSB TGT' ? 180 : 280);
      expect(new Set(qs.map((q: any) => q.qNo)).size).toBe(qs.length);
      const fullRange = Array.from({ length: p.exam === 'DSSSB TGT' ? 200 : 300 }, (_, i) => i + 1);
      expect(qs.map((q: any) => q.qNo).sort((a: number, b: number) => a-b)).toEqual(fullRange.filter(n => !source.excludedHindiQuestionNumbers.includes(n)));
      expect(p.sections.every((s: any) => !/hindi/i.test(s.name))).toBe(true);
      for (const q of qs) {
        expect(q.chapter.length).toBeGreaterThan(0);
        expect(q.topic.length).toBeGreaterThan(0);
        expect(q.sourceFile).toBe(p.sourceFile);
        expect(q.sourcePages.length).toBeGreaterThan(0);
        expect(q.sourcePages.every((n: number) => n >= 1 && n <= source.sourcePageCount)).toBe(true);
        expect(q.options).toHaveLength(4);
        expect(q.options.every((o: string) => o.trim().length > 0)).toBe(true);
        expect(/[\u0900-\u097f]/.test(q.text + q.options.join(''))).toBe(false);
        if (q.answerStatus === 'withdrawn') expect(q.correctIndex).toBeNull();
        if (q.topic === 'Reading Comprehension') expect(q.text).toContain('Read the passage');
      }
    }
  });
  it('ships every original image referenced by a question or option', () => {
    const qs = bank.papers.flatMap((p: any) => p.sections.flatMap((s: any) => s.questions));
    const assets = new Set<string>();
    for (const q of qs) for (const text of [q.text, ...q.options]) {
      for (const m of text.matchAll(/!\[[^\]]*\]\((\/question-assets\/[^)]+)\)/g)) assets.add(m[1]);
    }
    expect(assets.size).toBeGreaterThan(2000);
    for (const asset of assets) {
      const path = resolve(root, 'public', asset.slice(1));
      expect(existsSync(path), asset).toBe(true);
      expect(readFileSync(path).subarray(1,4).toString()).toBe('PNG');
    }
  });
  it('includes actual recognized text for image-based papers', () => {
    expect(report.ocr.errors).toBe(0);
    expect(report.ocr.nonemptyAssets).toBeGreaterThan(2500);
    const scanned = bank.papers.filter((p: any) => p.year === 2022).flatMap((p: any) => p.sections.flatMap((s: any) => s.questions));
    const riya = scanned.find((q: any) => q.sourceFile === 'pgt_comp_sci_female_21st_nov_22_s2.pdf' && q.qNo === 1);
    expect(riya.searchText).toMatch(/Riya/i);
    expect(scanned.filter((q: any) => q.searchText.trim().length > 20).length).toBeGreaterThan(500);
  });
});
