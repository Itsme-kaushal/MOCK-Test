import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Copy,
  Layers,
} from 'lucide-react';
import {
  validateImportJson,
  computePaperIdentityKey,
} from '../lib/import/validator';
import { repository } from '../lib/db/dexieRepository';
import {
  ValidationResult,
  DuplicateResolutionStrategy,
} from '../types/schema';
import { ImportSummary } from '../types/repository';
import { Badge } from '../components/common/Badge';
import { useBankStore } from '../store/useBankStore';

export const ImportPage: React.FC = () => {
  const navigate = useNavigate();
  const refreshAll = useBankStore((s) => s.refreshAll);

  const [rawText, setRawText] = useState<string>('');
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateResolutionStrategy>('skip');
  const [importing, setImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const runValidation = async (jsonInput: string) => {
    setIsValidating(true);
    setImportSummary(null);
    try {
      const existingPapers = await repository.getPapers();
      const existingQuestions = await repository.getQuestions();

      const existingPaperIdentities = new Map<string, string>();
      existingPapers.forEach((p) => {
        existingPaperIdentities.set(
          computePaperIdentityKey(p.exam, p.year, p.date, p.shift),
          p.id
        );
      });

      const existingQuestionHashes = new Set<string>(
        existingQuestions.map((q) => q.hash)
      );

      const res = validateImportJson(jsonInput, {
        existingPaperIdentities,
        existingQuestionHashes,
      });
      setValidation(res);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const names: string[] = [];
    const mergedPapers: unknown[] = [];
    let firstRawText = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      names.push(file.name);
      const text = await file.text();
      if (i === 0) firstRawText = text;

      try {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.papers)) {
          mergedPapers.push(...parsed.papers);
        } else {
          // Keep invalid file raw text so line-level validator highlights the exact syntax/schema error
          setUploadedFileNames([file.name]);
          setRawText(text);
          await runValidation(text);
          return;
        }
      } catch {
        setUploadedFileNames([file.name]);
        setRawText(text);
        await runValidation(text);
        return;
      }
    }

    const finalJson =
      files.length === 1
        ? firstRawText
        : JSON.stringify(
            {
              schemaVersion: '1.0',
              papers: mergedPapers,
            },
            null,
            2
          );

    setUploadedFileNames(names);
    setRawText(finalJson);
    await runValidation(finalJson);
  };

  const handleLoadSample = async () => {
    try {
      const res = await fetch('/sample-questions.json');
      const text = await res.text();
      setUploadedFileNames(['sample-questions.json']);
      setRawText(text);
      await runValidation(text);
    } catch (err) {
      console.error('Failed to load sample JSON:', err);
    }
  };

  const handleSaveToBank = async () => {
    if (!validation?.valid || !validation.normalizedPayload) return;
    setImporting(true);
    try {
      const summary = await repository.importPayload(
        validation.normalizedPayload,
        duplicateStrategy
      );
      setImportSummary(summary);
      await refreshAll();
    } finally {
      setImporting(false);
    }
  };

  const hasDuplicatePapers =
    validation?.previews.some((p) => p.isDuplicatePaper) ?? false;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileJson className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Import Questions (JSON v1.0)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Upload one or multiple structured <code className="font-mono">.json</code> files or paste raw LLM-generated JSON. Imports are strictly validated and additive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Load Sample (2 Shifts, 3 Sections)
          </button>

          <a
            href="/sample-questions.json"
            download="mocktest-studio-sample.json"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Sample JSON
          </a>

          <button
            type="button"
            onClick={() => navigate('/schema-help')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            JSON Format Help
          </button>
        </div>
      </div>

      {/* Upload & Paste Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: File Dropzone + Raw Paste Box */}
        <div className="lg:col-span-6 space-y-4">
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer transition-all">
            <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Click to select one or multiple <code className="font-mono">.json</code> files
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Supports multi-file batch import (e.g., Shift 1 + Shift 2 JSON files)
            </span>
            {uploadedFileNames.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {uploadedFileNames.map((name, i) => (
                  <Badge key={i} variant="indigo">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
            <input
              type="file"
              accept=".json,application/json"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Or Paste / Edit Raw JSON
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRawText('');
                    setValidation(null);
                    setUploadedFileNames([]);
                    setImportSummary(null);
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => runValidation(rawText)}
                  disabled={isValidating}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                >
                  {isValidating ? 'Validating...' : 'Validate JSON'}
                </button>
              </div>
            </div>

            <textarea
              rows={16}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='Paste JSON here: { "schemaVersion": "1.0", "papers": [ ... ] }'
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Right: Validation Preview, Line Errors, Warnings & Save */}
        <div className="lg:col-span-6 space-y-4">
          {!validation && !importSummary && (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <Layers className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                Validation & Pre-Import Preview
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Upload a <code className="font-mono">.json</code> file, paste your JSON, or click{' '}
                <strong>Load Sample</strong> to inspect papers, sections, question counts, line-level errors, and duplicate checks before saving.
              </p>
            </div>
          )}

          {/* Import Success Banner */}
          {importSummary && (
            <div className="p-6 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                    Import Completed Successfully!
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Your Question Bank has been updated additively.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-lg font-bold text-emerald-600">
                    {importSummary.papersAdded + importSummary.papersOverwritten}
                  </div>
                  <div className="text-xs text-slate-500">Papers Saved</div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-lg font-bold text-indigo-600">
                    {importSummary.questionsAdded + importSummary.questionsOverwritten}
                  </div>
                  <div className="text-xs text-slate-500">Questions Saved</div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-lg font-bold text-amber-600">
                    {importSummary.papersSkipped}
                  </div>
                  <div className="text-xs text-slate-500">Duplicates Skipped</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/bank')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Browse Question Bank</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/create-test')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Create a Timed Test</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Validation Errors (Line-Level) */}
          {validation && !validation.valid && (
            <div className="p-5 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 space-y-4">
              <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300">
                <XCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">
                    Schema Validation Failed ({validation.errors.length} error
                    {validation.errors.length === 1 ? '' : 's'})
                  </h3>
                  <p className="text-xs opacity-90">
                    Fix the errors below in your JSON and click Validate JSON again.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {err.path}
                      </span>
                      {err.line && (
                        <Badge variant="rose">
                          Line {err.line}
                          {err.column ? `, Col ${err.column}` : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {err.message}
                    </p>
                    {err.snippet && (
                      <pre className="p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-400 overflow-x-auto">
                        {err.snippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid Preview Card */}
          {validation && validation.valid && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Schema Validated — Ready to Import
                    </h3>
                    <p className="text-xs text-slate-500">
                      Found {validation.previews.length} paper(s) and{' '}
                      {validation.previews.reduce((a, b) => a + b.totalQuestions, 0)}{' '}
                      total questions
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToBank}
                  disabled={importing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {importing ? 'Saving to Bank...' : 'Save to Question Bank'}
                </button>
              </div>

              {/* Duplicate Resolution Control if duplicates exist */}
              {hasDuplicatePapers && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Duplicate Paper Detected (Same Exam + Year + Date + Shift)</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    MockTest Studio never creates two copies of the same paper. How should existing papers be handled?
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                      />
                      <span>Skip duplicate papers (keep existing)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'overwrite'}
                        onChange={() => setDuplicateStrategy('overwrite')}
                      />
                      <span>Overwrite existing paper (preserves attached images & bookmarks)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Papers & Sections Breakdown */}
              <div className="space-y-3">
                {validation.previews.map((paper) => (
                  <div
                    key={paper.paperIndex}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {paper.paperName}
                          </span>
                          {paper.isDuplicatePaper && (
                            <Badge variant="amber">Already in Bank</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {paper.exam} • {paper.year} • {paper.date} • {paper.shift}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="indigo">{paper.durationMin} mins</Badge>
                        <Badge variant="emerald">
                          +{paper.marking.correct} / -{paper.marking.negative}
                        </Badge>
                        <Badge variant="purple">{paper.totalQuestions} Qs</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {paper.sections.map((sec, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {sec.name}
                          </div>
                          <div className="text-slate-500 mt-0.5 flex items-center justify-between">
                            <span>{sec.questionCount} questions</span>
                            {sec.durationMin && <span>{sec.durationMin}m</span>}
                          </div>
                          {(sec.missingAnswerCount > 0 || sec.hasImageCount > 0) && (
                            <div className="flex gap-1.5 mt-1.5">
                              {sec.missingAnswerCount > 0 && (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                  {sec.missingAnswerCount} null ans
                                </span>
                              )}
                              {sec.hasImageCount > 0 && (
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                  {sec.hasImageCount} image Q
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings List */}
              {validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Pre-Import Warnings ({validation.warnings.length})</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {validation.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200"
                      >
                        {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
