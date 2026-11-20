# MockTest Studio

A personal DSSSB TGT / PGT Computer Science practice website, updated with the English-language questions from the nine supplied PDFs.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open the address Vite prints. The extracted bank loads automatically. The local preview currently runs at http://127.0.0.1:5173/.

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Use a consistent browser and address: answers, attempts, bookmarks and revision lists are stored in IndexedDB on that browser origin. A JSON export contains question content and provenance, but is not a backup of attempt history or bookmarks.

## Included bank

| Section | Source questions |
| --- | ---: |
| Computer Science | 1,260 |
| Reasoning & Aptitude | 180 |
| Quantitative Aptitude | 180 |
| General Awareness | 180 |
| English | 180 |
| Teaching Aptitude | 40 |
| Total | 2,020 |

The five TGT papers have 180 retained questions each. The four PGT papers have 280 each. Each source omits its 20 Hindi-subject questions, while the English version of bilingual questions is retained. Original question numbers are preserved, so numbering gaps are intentional.

All nine paper identities remain available for full-paper mocks. Shared questions are removed from chapter, topic and section drills by normalized content hash. Image variants may remain distinct when their source pixels differ.

24 questions are explicitly withdrawn in the supplied sources. They remain visible, retain their withdrawal notices and are excluded from scores, maximum marks and accuracy. Provided keys were read from the green option labels; no answer keys were guessed.

Full-paper practice is fixed at **120 minutes**, including PGT sources originally labelled 180 minutes, as requested. Shorter chapter, topic and section drills have their own duration. Timers use a saved deadline and auto-submit when it expires, including after reloading or reopening a test.

## Practice

- **Dashboard:** choose a section or a complete source paper.
- **Practice:** choose an exam, section, chapter and topic; study with answer feedback or launch a timed drill.
- **Question Bank:** search native and OCR text, edit chapter/topic labels, bookmark questions and maintain a revision list.
- **Create Test:** take a complete two-hour paper or build a custom mixed test.
- **Analytics & History:** inspect scores and section/topic performance, then review every answer.
- **Settings:** export the question bank and inspect the extraction report.

## Data and extraction

- `public/extracted-question-bank.json`: importable bank, with keys and source provenance.
- `public/extraction-report.json`: per-file counts, source SHA-256 hashes, omitted Hindi numbers, source duration and image review lists.
- `public/question-assets/`: original prompt/option images and crops preserving typeset equations. Keep this folder with the bank JSON.
- `scripts/extract_pdfs.py`: extraction and chapter/topic classification.
- `scripts/ocr.swift`: offline macOS Vision OCR.

Every question records its source file, source question ID, PDF page references and original section. PDF creation dates are labelled as document metadata; they should not be assumed to be exam dates. The 2022 exam date comes from the supplied filenames.

Native raster content is displayed as images. Superscripts and other fragile mathematical layouts are preserved as rendered crops. Answer ticks/crosses are excluded and answer-label colors are neutralized in rendered options. OCR supplies searchable text rather than replacing original images.

Chapter and topic classification is keyword-assisted. Broad "Essentials" chapters and ambiguous labels can be refined in the editor. The 813 questions containing raster/layout content or withdrawal notices are flagged for content review; image retention does not mean every OCR character or topic label was manually verified. Source explanations were not supplied, so no invented explanations are included.

To regenerate on macOS, install Python packages `pdfplumber` and `Pillow` (including pdfplumber's PDF renderer), then use:

```sh
python3 scripts/extract_pdfs.py
swiftc -module-cache-path tmp/pdfs/swift-cache scripts/ocr.swift -o tmp/pdfs/ocr
tmp/pdfs/ocr tmp/pdfs/ocr-manifest.json tmp/pdfs/ocr.jsonl
python3 scripts/extract_pdfs.py --finalize
```

The extractor currently reads the supplied filenames from `/Users/kaushal/Downloads`. Update its source directory to use another location. The Codex bundled Python runtime already contains the extraction dependencies. macOS Vision may need to run outside a restricted workspace sandbox; finalization rejects an OCR run that produced errors or no recognized text.

Bundled bank updates are fingerprinted and imported once per content revision. Source question IDs and existing section IDs are retained during replacement so answer records, bookmarks and revision selections continue to refer to the same questions. Existing unrelated imports are preserved. Manual edits are preserved across normal reloads; replacing the bundled source bank is an explicit data update.
