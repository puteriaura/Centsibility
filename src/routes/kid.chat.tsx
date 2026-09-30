import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import {
  buildSpendingSummary,
  pennyReply,
} from "@/lib/penny-insights";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import { getKidSession } from "@/lib/kid-session";
import { isKidBypassed } from "@/lib/admin-bypass";
import { edgeKidPennyChat } from "@/lib/edge";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  remaining?: number;
  offline?: boolean;
};

type ChatSearch = { q?: string };

export const Route = createFileRoute("/kid/chat")({
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({ meta: [{ title: "Penny — Centsibility" }] }),
  component: KidChat,
});

const STARTERS = [
  { label: "Spending", prompt: "I would like to know more about spending." },
  { label: "Savings", prompt: "How can I save better?" },
  { label: "Sadaqah", prompt: "Tell me about sadaqah." },
  { label: "Invest", prompt: "Is investing halal for me?" },
];

function KidChat() {
  const nav = useNavigate();
  const { q } = Route.useSearch();
  const { data, loading, error, refresh } = useKidData();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  const summary = useMemo(
    () => buildSpendingSummary((data?.txs ?? []) as Parameters<typeof buildSpendingSummary>[0], 90),
    [data?.txs],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    const name = data.kid.name;
    const opener: ChatMessage = {
      id: "welcome",
      role: "assistant",
      text: `Salam and hi there! I'm Penny, your money buddy.\n\nAsk me about spending breakdowns, saving pots, sadaqah, or rewards. I'll use your real activity to guide you.`,
    };
    setMessages([opener]);

    const seedPrompt =
      q === "spending"
        ? "I would like to know more about spending."
        : q === "savings"
          ? "How can I save better?"
          : q === "surprise"
            ? "Surprise me with a tip."
            : q && q.trim()
              ? q.trim()
              : null;
    if (seedPrompt) {
      send(seedPrompt);
    }
  }, [data, q, summary]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !data || busy) return;
    sfx.tap();
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    const code = getKidSession()?.code ?? (isKidBypassed() ? "DEMO_CODE" : null);

    // If no code available, answer using local rules
    if (!code) {
      await new Promise((r) => setTimeout(r, 350));
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: pennyReply(trimmed, summary, data.kid.name),
        offline: true,
      };
      setMessages((m) => [...m, reply]);
      setBusy(false);
      sfx.pop();
      return;
    }

    // Send only the last 10 turns as history
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const res = await edgeKidPennyChat({
        code,
        message: trimmed,
        history,
      });

      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.reply,
        remaining: res.remaining,
      };
      setMessages((m) => [...m, reply]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes("429") ||
        errMsg.toLowerCase().includes("rest") ||
        errMsg.toLowerCase().includes("tomorrow")
      ) {
        toast("Penny needs a rest. Try again tomorrow.");
      }
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: pennyReply(trimmed, summary, data.kid.name),
        offline: true,
      };
      setMessages((m) => [...m, reply]);
    } finally {
      setBusy(false);
      sfx.pop();
    }
  };

  const newChat = () => {
    sfx.tap();
    seeded.current = false;
    setMessages([]);
    nav({ to: "/kid/chat", search: {} });
    if (data) {
      seeded.current = true;
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: `Fresh chat! I'm Penny. What would you like to explore, ${data.kid.name}?`,
        },
      ]);
    }
  };

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton style={{ height: "3rem", borderRadius: "12px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "16px" }} />
      </div>
    );
  }

  return (
    <div className="penny-chat">
      <header className="penny-chat__header">
        <button
          type="button"
          className="shell-icon-btn"
          aria-label="Close chat"
          onClick={() => {
            sfx.tap();
            nav({ to: "/kid/insights" });
          }}
        >
          <AppIcon name="close" size={20} />
        </button>
        <div className="penny-chat__title">
          <strong>Penny</strong>
          <span className="penny-chat__beta">Beta</span>
        </div>
        <button
          type="button"
          className="shell-icon-btn"
          aria-label="New chat"
          onClick={newChat}
        >
          <AppIcon name="plus" size={20} />
        </button>
      </header>

      <div className="penny-chat__thread" role="log" aria-live="polite">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="penny-bubble penny-bubble--user">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="penny-assistant">
              <PennyMarkdown text={m.text} />
              {m.offline && (
                <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-1 italic">
                  Penny is using offline answers right now
                </p>
              )}
              {m.remaining !== undefined && m.remaining <= 5 && (
                <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-1 font-medium">
                  {m.remaining} AI chat{m.remaining === 1 ? "" : "s"} left today
                </p>
              )}
              <div className="penny-assistant__actions">
                <button
                  type="button"
                  aria-label="Helpful"
                  onClick={() => toast.success("Thanks for the feedback!")}
                >
                  <AppIcon name="thumbsup" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Not helpful"
                  onClick={() => toast("Thanks — we'll keep improving Penny.")}
                >
                  <AppIcon name="thumbsdown" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(m.text);
                      toast.success("Copied");
                    } catch {
                      toast.error("Copy failed");
                    }
                  }}
                >
                  <AppIcon name="copy" size={16} />
                </button>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="penny-assistant">
            <p className="penny-assistant__text text-[var(--text-secondary)] italic flex items-center gap-1.5">
              <span>Penny is thinking…</span>
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="penny-starters" aria-label="Suggested questions">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="insights-ask-chip"
              onClick={() => send(s.prompt)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <form
        className="penny-chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="penny-input" className="sr-only">
          Ask Penny
        </label>
        <input
          id="penny-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Penny"
          autoComplete="off"
          disabled={busy}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={busy || !input.trim()}
          aria-label="Send message to Penny"
        >
          Send
        </Button>
      </form>
      <p className="penny-chat__disclaimer">
        Content is educational and not financial advice. Subject to our Terms of Use.
      </p>

      <Link to="/kid/insights" className="penny-chat__insights-link" onClick={() => sfx.tap()}>
        <span className="insights-sheet__handle" aria-hidden="true" />
        Insights
      </Link>
    </div>
  );
}

function PennyMarkdown({ text }: { text: string }) {
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
      tokens.push(<strong key={match.index} className="font-bold text-[var(--ink)]">{matchText.slice(2, -2)}</strong>);
    } else if ((matchText.startsWith("*") && matchText.endsWith("*")) || (matchText.startsWith("_") && matchText.endsWith("_"))) {
      tokens.push(<em key={match.index} className="italic">{matchText.slice(1, -1)}</em>);
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
