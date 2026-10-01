import React from "react";

export function PennyMarkdown({ text }: { text: string }) {
  // Strip em/en dashes
  const clean = text.replace(/—/g, ", ").replace(/–/g, "-");
  const paragraphs = clean.split(/\n\s*\n/);

  return (
    <div className="penny-assistant__text space-y-2">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        const isList = lines.every((l) => /^\s*[-*•]\s+/.test(l) || /^\s*\d+\.\s+/.test(l));
        if (isList) {
          return (
            <ul key={pIdx} className="list-disc pl-5 space-y-1 my-1">
              {lines.map((l, lIdx) => {
                const itemText = l.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+\.\s+/, "");
                return <li key={lIdx}>{renderInlineMarkdown(itemText)}</li>;
              })}
            </ul>
          );
        }
        return (
          <p key={pIdx} className="m-0 leading-relaxed">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInlineMarkdown(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|_.*?_)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const matchText = match[0];
    if (matchText.startsWith("**") && matchText.endsWith("**")) {
      tokens.push(
        <strong key={match.index} className="font-bold text-[var(--ink)]">
          {matchText.slice(2, -2)}
        </strong>
      );
    } else if (
      (matchText.startsWith("*") && matchText.endsWith("*")) ||
      (matchText.startsWith("_") && matchText.endsWith("_"))
    ) {
      tokens.push(
        <em key={match.index} className="italic">
          {matchText.slice(1, -1)}
        </em>
      );
    } else {
      tokens.push(matchText);
    }
    lastIndex = match.index + matchText.length;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens.length > 0 ? tokens : text;
}
