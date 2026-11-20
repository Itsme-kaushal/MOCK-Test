import React, { useState } from 'react';
import { FileCode, Copy, Check, ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SCHEMA_TEMPLATE = `{
  "schemaVersion": "1.0",
  "papers": [
    {
      "exam": "SSC CGL Tier-1",
      "paperName": "SSC CGL 2025 Mock Shift 1",
      "year": 2025,
      "date": "2025-09-14",
      "shift": "Shift 1",
      "durationMin": 60,
      "totalMarks": 200,
      "marking": {
        "correct": 2,
        "negative": 0.5
      },
      "sections": [
        {
          "name": "Quantitative Aptitude",
          "durationMin": 20,
          "marking": {
            "correct": 2,
            "negative": 0.5
          },
          "questions": [
            {
              "qNo": 1,
              "text": "If $x + \\\\frac{1}{x} = 5$, find $x^2 + \\\\frac{1}{x^2}$.",
              "textHi": "यदि $x + \\\\frac{1}{x} = 5$ है, तो $x^2 + \\\\frac{1}{x^2}$ ज्ञात करें।",
              "options": ["23", "25", "27", "21"],
              "optionsHi": ["23", "25", "27", "21"],
              "correctIndex": 0,
              "explanation": "$(x + 1/x)^2 - 2 = 25 - 2 = 23$.",
              "marks": 2,
              "negativeMarks": 0.5,
              "topic": "Algebra",
              "hasImage": false,
              "imageDescription": ""
            }
          ]
        }
      ]
    }
  ]
}`;

const LLM_PROMPT_TEMPLATE = `Convert the following exam questions into a strict JSON object matching MockTest Studio schemaVersion "1.0":
- Root keys: "schemaVersion": "1.0", "papers": [...]
- Each paper has: "exam" (string), "paperName" (string), "year" (number), "date" (YYYY-MM-DD), "shift" (string), "durationMin" (number), "totalMarks" (number), "marking": { "correct": number, "negative": number }, "sections": [...]
- Each section has: "name" (string), "durationMin" (number or null), "marking": { "correct": number, "negative": number } (or null), "questions": [...]
- Each question has: "qNo" (int >= 1), "text" (string, use $...$ for inline LaTeX and markdown tables if needed), "textHi" (string, optional), "options" (array of EXACTLY 4 strings), "optionsHi" (array of 4 strings, optional), "correctIndex" (0, 1, 2, 3, or null if answer is unknown), "explanation" (string), "marks" (number), "negativeMarks" (number), "topic" (string), "hasImage" (boolean), "imageDescription" (string).
- Output ONLY valid JSON with no extra keys.`;

export const SchemaHelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const copyText = (text: string, type: 'schema' | 'prompt') => {
    navigator.clipboard.writeText(text);
    if (type === 'schema') {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
    } else {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/import')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCode className="w-6 h-6 text-indigo-600" />
              JSON Schema v1.0 Reference & LLM Prompt Guide
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Everything you need to generate valid JSON files with ChatGPT, Claude, or Gemini.
            </p>
          </div>
        </div>
        <a
          href="/sample-questions.json"
          download="mocktest-studio-sample.json"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
        >
          <Download className="w-4 h-4" />
          Download Full Sample JSON
        </a>
      </div>

      {/* Ready-to-use LLM Prompt */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Copy-Paste Prompt for Your LLM
            </h2>
            <p className="text-xs text-slate-500">
              Paste this instruction into Claude/ChatGPT/Gemini when converting raw questions into JSON.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText(LLM_PROMPT_TEMPLATE, 'prompt')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-xs font-semibold"
          >
            {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedPrompt ? 'Copied!' : 'Copy LLM Prompt'}
          </button>
        </div>
        <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed">
          {LLM_PROMPT_TEMPLATE}
        </pre>
      </div>

      {/* Schema Example & Field Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Annotated Schema v1.0 Template
            </h2>
            <button
              type="button"
              onClick={() => copyText(SCHEMA_TEMPLATE, 'schema')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {copiedSchema ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSchema ? 'Copied!' : 'Copy Template'}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300 text-xs font-mono overflow-x-auto leading-relaxed">
            {SCHEMA_TEMPLATE}
          </pre>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Validation Rules & Defaults
          </h2>
          <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                1. Fixed 4 Options (`options` & `optionsHi`)
              </strong>
              Every question must have an <code className="font-mono">options</code> array of{' '}
              <strong>exactly 4 strings</strong>. If <code className="font-mono">optionsHi</code> is omitted, it defaults to <code className="font-mono">["", "", "", ""]</code>.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                2. Answer Index (`correctIndex`: 0..3 or null)
              </strong>
              Use <code className="font-mono">0</code> for Option A, <code className="font-mono">1</code> for B, <code className="font-mono">2</code> for C, <code className="font-mono">3</code> for D. If the answer key is missing, pass <code className="font-mono">null</code>—the app badges it as <em>Needs Attention</em> and excludes it from test scoring until you set an answer inline.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                3. Sensible Defaults for Optional Fields
              </strong>
              Missing <code className="font-mono">marks</code> or <code className="font-mono">negativeMarks</code> inherit from the section or paper <code className="font-mono">marking</code> object. Missing <code className="font-mono">topic</code> defaults to <code className="font-mono">"General"</code>. Missing <code className="font-mono">hasImage</code> defaults to <code className="font-mono">false</code>.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                4. Duplicate Protection
              </strong>
              Papers are uniquely identified by <code className="font-mono">exam + year + date + shift</code>. Individual questions are hashed by normalized <code className="font-mono">text + options</code>.
            </li>
            <li className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                5. LaTeX Math & Markdown Tables
              </strong>
              Wrap inline math in <code className="font-mono">$...$</code> and display math in <code className="font-mono">$$...$$</code>. Remember to double-escape backslashes in JSON strings (e.g., <code className="font-mono">"\\frac{1}{2}"</code>).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
