import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useKidData } from "@/hooks/use-kid-data";
import {
  buildSpendingSummary,
  pennyReply,
  type ChatMessage,
} from "@/lib/penny-insights";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";

type ChatSearch = { q?: string };

export const Route = createFileRoute("/kid/chat")({
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({ meta: [{ title: "Penny Sensei — Centsibility" }] }),
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
  const { data, loading } = useKidData();
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
      text: `Hi there! I'm Penny Sensei, your financial best friend.\n\nAsk me about spending, savings, sadaqah, or investments — I'll use your real activity to guide you.`,
    };
    setMessages([opener]);

    const seedPrompt =
      q === "spending"
        ? "I would like to know more about spending."
        : q === "savings"
          ? "How can I save better?"
          : q === "surprise"
            ? "Surprise me with a tip."
            : null;
    if (seedPrompt) {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: seedPrompt,
      };
      const reply: ChatMessage = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        text: pennyReply(seedPrompt, summary, name),
      };
      setMessages([opener, userMsg, reply]);
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
    // Local rule-based reply (no external AI dependency)
    await new Promise((r) => setTimeout(r, 350));
    const reply: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      text: pennyReply(trimmed, summary, data.kid.name),
    };
    setMessages((m) => [...m, reply]);
    setBusy(false);
    sfx.pop();
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
          text: `Fresh chat! I'm Penny Sensei. What would you like to explore, ${data.kid.name}?`,
        },
      ]);
    }
  };

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
          <strong>Penny Sensei</strong>
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
              <p className="penny-assistant__text">{m.text}</p>
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
          <p className="text-xs text-[var(--text-muted)] px-1">Penny is thinking…</p>
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
          Ask Penny Sensei
        </label>
        <input
          id="penny-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Penny Sensei"
          autoComplete="off"
          disabled={busy}
        />
        <Button type="submit" variant="primary" size="sm" disabled={busy || !input.trim()}>
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
