import React from "react";

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

export function PennyMarkdown({ text }: { text: string }) {
  // Strip em/en dashes
  const clean = text.replace(/—/g, ", ").replace(/–/g, "-");
  // Replies use single newlines, so every line is its own paragraph and
  // consecutive bullet or numbered lines form one list.
  const blocks: Block[] = [];
  for (const raw of clean.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s+/.exec(line);
    const marker = bullet ?? /^\d+[.)]\s+/.exec(line);
    if (!marker) {
      blocks.push({ kind: "p", text: line });
      continue;
    }
    const kind = bullet ? "ul" : "ol";
    const item = line.slice(marker[0].length);
    const last = blocks.at(-1);
    if (last && last.kind === kind) last.items.push(item);
    else blocks.push({ kind, items: [item] });
  }

  // No m-0/my-*: margin utilities would cancel the space-y gap between blocks.
  return (
    <div className="penny-assistant__text space-y-3">
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i} className="leading-relaxed">
              {renderInlineMarkdown(block.text)}
            </p>
          );
        }
        const List = block.kind;
        return (
          <List
            key={i}
            className={`${List === "ul" ? "list-disc" : "list-decimal"} pl-5 space-y-1`}
          >
            {block.items.map((item, j) => (
              <li key={j}>{renderInlineMarkdown(item)}</li>
            ))}
          </List>
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
