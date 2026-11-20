import React, { useMemo } from 'react';
import katex from 'katex';

interface MathMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders text containing:
 * - Block LaTeX: $$...$$
 * - Inline LaTeX: $...$
 * - Markdown tables: | col1 | col2 |
 * - Bold (**...**) and inline code (`...`)
 */
export const MathMarkdown: React.FC<MathMarkdownProps> = ({ content, className = '' }) => {
  const renderedBlocks = useMemo(() => {
    if (!content) return null;

    const lines = content.split(/\r?\n/);
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Native PDF assets preserve diagrams, equations, tables and code.
      const sourceImage = line.trim().match(/^!\[([^\]]*)\]\((\/question-assets\/[a-z0-9.-]+)\)$/);
      if (sourceImage) {
        blocks.push(<img key={`image-${i}`} src={sourceImage[2]} alt={sourceImage[1] || 'Original question content'} loading="lazy" className="max-w-full h-auto rounded-md bg-white p-2" />);
        i++;
        continue;
      }

      // Detect Markdown Table
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (
          i < lines.length &&
          lines[i].trim().startsWith('|') &&
          lines[i].trim().endsWith('|')
        ) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const parseRow = (rowStr: string) =>
            rowStr
              .slice(1, -1)
              .split('|')
              .map((cell) => cell.trim());

          const headers = parseRow(tableLines[0]);
          const isSeparator = tableLines[1].includes('---');
          const dataRows = tableLines.slice(isSeparator ? 2 : 1).map(parseRow);

          blocks.push(
            <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800/80">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <InlineMathText text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                        >
                          <InlineMathText text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Regular paragraph line
      if (line.trim() === '') {
        blocks.push(<div key={`spacer-${i}`} className="h-2" />);
      } else {
        blocks.push(
          <div key={`line-${i}`} className="leading-relaxed">
            <InlineMathText text={line} />
          </div>
        );
      }
      i++;
    }

    return blocks;
  }, [content]);

  return <div className={`space-y-1 ${className}`}>{renderedBlocks}</div>;
};

const InlineMathText: React.FC<{ text: string }> = ({ text }) => {
  const parts = useMemo(() => {
    // Split by $$...$$ first, then $...$
    const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+?\*\*|`[^`]+?`)/g;
    const segments = text.split(regex);

    return segments.map((seg, idx) => {
      if (!seg) return null;

      if (seg.startsWith('$$') && seg.endsWith('$$') && seg.length > 4) {
        const latex = seg.slice(2, -2);
        try {
          const html = katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              className="block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <code key={idx}>{seg}</code>;
        }
      }

      if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
        const latex = seg.slice(1, -1);
        try {
          const html = katex.renderToString(latex, {
            displayMode: false,
            throwOnError: false,
          });
          return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <code key={idx}>{seg}</code>;
        }
      }

      if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
        return (
          <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
            {seg.slice(2, -2)}
          </strong>
        );
      }

      if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-indigo-600 dark:text-indigo-400"
          >
            {seg.slice(1, -1)}
          </code>
        );
      }

      return <React.Fragment key={idx}>{seg}</React.Fragment>;
    });
  }, [text]);

  return <>{parts}</>;
};
