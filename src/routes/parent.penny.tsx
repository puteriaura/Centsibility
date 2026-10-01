import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth";
import { useParentData } from "@/hooks/use-parent-data";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import { edgeParentPennyChat, extractEdgeErrorMessage, type PennyChatMessage } from "@/lib/edge";
import { PennyMarkdown } from "@/components/PennyMarkdown";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  remaining?: number;
};

export const Route = createFileRoute("/parent/penny")({
  head: () => ({ meta: [{ title: "Penny Coach — Centsibility" }] }),
  component: ParentPennyChat,
});

const PARENT_COACH_CHIPS = [
  {
    label: "How are my kids doing?",
    prompt: "Give me an overview of how my kids are doing with their spending and savings habits.",
  },
  {
    label: "Allowance ideas",
    prompt: "What are some age-appropriate ways to structure allowance and tasks for my kids?",
  },
  {
    label: "Conversation starters",
    prompt: "Give me 2 conversation starters I can use with my children to talk about money and barakah this week.",
  },
  {
    label: "Summarise this week",
    prompt: "Summarise my family's financial activity this week, with one takeaway and one next step.",
  },
];

function ParentPennyChat() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { loading } = useParentData();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  const comfortName = (user?.user_metadata as { comfort_name?: string } | undefined)?.comfort_name?.trim();
  const greetingTarget = comfortName || "there";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const opener: ChatMessage = {
      id: "welcome",
      role: "assistant",
      text: `Salam ${greetingTarget}! I'm Penny, your family's Shariah money coach.\n\nI can help you review your children's habits, give you gentle conversation starters, or suggest next steps for allowance and saving. What would you like to explore?`,
    };
    setMessages([opener]);
  }, [greetingTarget]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sfx.tap();
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

    const history: PennyChatMessage[] = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const res = await edgeParentPennyChat({
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
      sfx.pop();
    } catch (err: unknown) {
      const errMsg = await extractEdgeErrorMessage(err);
      if (
        errMsg.includes("429") ||
        errMsg.toLowerCase().includes("limit") ||
        errMsg.toLowerCase().includes("tomorrow")
      ) {
        toast("Penny needs a rest. You've reached your daily quota. Try again tomorrow.");
      } else {
        toast.error(errMsg || "Penny couldn't respond right now.");
      }

      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: "I'm having a little trouble connecting right now. Please try asking again in a moment, or check back later.",
      };
      setMessages((m) => [...m, reply]);
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    sfx.tap();
    if (window.confirm("Start a fresh conversation with Penny?")) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: `Fresh chat! What would you like guidance on today, ${greetingTarget}?`,
        },
      ]);
    }
  };

  if (loading && messages.length === 0) {
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
          aria-label="Back to dashboard"
          onClick={() => {
            sfx.tap();
            nav({ to: "/parent" });
          }}
        >
          <AppIcon name="back" size={20} />
        </button>
        <div className="penny-chat__title">
          <strong>Penny Coach</strong>
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
              {m.remaining !== undefined && m.remaining <= 5 && (
                <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-1 font-medium">
                  {m.remaining} AI question{m.remaining === 1 ? "" : "s"} left today
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

      <div className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar" aria-label="Coach suggestions">
        {PARENT_COACH_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="insights-ask-chip whitespace-nowrap shrink-0"
            disabled={busy}
            onClick={() => send(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form
        className="penny-chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="parent-penny-input" className="sr-only">
          Ask Penny
        </label>
        <input
          id="parent-penny-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Penny about your kids' finances..."
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
        Penny gives general guidance, not financial, legal or religious rulings.
      </p>
    </div>
  );
}
