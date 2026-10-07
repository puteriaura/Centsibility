import * as React from "react";
import { usePinStatus } from "@/hooks/use-pin-status";
import { Link, useNavigate } from "@tanstack/react-router";
import { usePenny } from "./PennyProvider";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { NumericKeypad, PIN_KEYPAD_KEYS } from "@/components/ui/numeric-keypad";
import { PennyMarkdown } from "@/components/PennyMarkdown";
import { edgeParentVerifyPin } from "@/lib/edge";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";

export interface PennyChatProps {
  inDrawer?: boolean;
  mode: "kid" | "parent";
}

const KID_STARTERS = [
  { label: "Spending", prompt: "I would like to know more about spending." },
  { label: "Savings", prompt: "How can I save better?" },
  { label: "Sadaqah", prompt: "Tell me about sadaqah." },
  { label: "Invest", prompt: "Is investing halal for me?" },
];

const KID_COACH_CHIPS = [
  {
    label: "Teach me something",
    prompt: "Teach me one money idea for my age, with a tiny example.",
  },
  {
    label: "How can I improve?",
    prompt:
      "Look at my spending and Tabung. Give me one tip to do better this week.",
  },
  {
    label: "Summarise my week",
    prompt:
      "Summarise my week: spending, saving and progress, with one takeaway and one next step.",
  },
];

const PARENT_COACH_CHIPS = [
  {
    label: "How are my kids doing?",
    prompt:
      "Give me an overview of how my kids are doing with their spending and savings habits.",
  },
  {
    label: "Allowance ideas",
    prompt:
      "What are some age-appropriate ways to structure allowance and tasks for my kids?",
  },
  {
    label: "Conversation starters",
    prompt:
      "Give me 2 conversation starters I can use with my children to talk about money and barakah this week.",
  },
  {
    label: "Summarise this week",
    prompt:
      "Summarise my family's financial activity this week, with one takeaway and one next step.",
  },
];

export function PennyChat({ inDrawer = false, mode }: PennyChatProps) {
  const nav = useNavigate();
  const {
    messages,
    busy,
    send,
    newChat,
    parentPinRequired,
    setParentPinRequired,
    retryAfterParentPin,
  } = usePenny();

  const attemptStatus = usePinStatus("parent", parentPinRequired);
  const [input, setInput] = React.useState("");
  const [pinInput, setPinInput] = React.useState("");
  const [pinProcessing, setPinProcessing] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input;
    setInput("");
    void send(text);
  };

  const handlePinKeyPress = async (key: string) => {
    if (pinProcessing || attemptStatus.locked) return;
    if (key === "delete" || key === "⌫") {
      setPinInput((prev) => prev.slice(0, -1));
      return;
    }
    if (!/^\d$/.test(key)) return;

    if (pinInput.length < 6) {
      const nextPin = pinInput + key;
      setPinInput(nextPin);

      if (nextPin.length === 6) {
        setPinProcessing(true);
        try {
          const res = await edgeParentVerifyPin({ pin: nextPin });
          if (res.valid) {
            sfx.success();
            setPinInput("");
            setPinProcessing(false);
            await retryAfterParentPin();
          } else {
            const attemptsMsg =
              res.attemptsLeft !== undefined
                ? `Incorrect PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left`
                : "That PIN isn't right.";
            toast.error(attemptsMsg);
            sfx.error();
            setPinInput("");
            setPinProcessing(false);
          }
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "PIN verification failed";
          toast.error(msg);
          sfx.error();
          setPinInput("");
          setPinProcessing(false);
        }
      }
    }
  };

  return (
    <div className={`penny-chat ${inDrawer ? "penny-chat--drawer" : ""}`}>
      {/* Standalone header if not inside drawer */}
      {!inDrawer && (
        <header className="penny-chat__header">
          <button
            type="button"
            className="shell-icon-btn min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            aria-label={mode === "kid" ? "Close chat" : "Back to dashboard"}
            onClick={() => {
              sfx.tap();
              if (mode === "kid") {
                void nav({ to: "/kid/insights" });
              } else {
                void nav({ to: "/parent" });
              }
            }}
          >
            <AppIcon name={mode === "kid" ? "close" : "back"} size={20} />
          </button>
          <div className="penny-chat__title">
            <strong>{mode === "kid" ? "Penny" : "Penny Coach"}</strong>
            <span className="penny-chat__beta">Beta</span>
          </div>
          <button
            type="button"
            className="shell-icon-btn min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            aria-label="New chat"
            onClick={newChat}
          >
            <AppIcon name="plus" size={20} />
          </button>
        </header>
      )}

      {/* Parent PIN prompt view if session expired */}
      {parentPinRequired ? (
        <div className="p-6 flex flex-col items-center justify-center flex-1 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center">
            <AppIcon name="shield" size={24} />
          </div>
          <h2 className="text-lg font-bold text-[var(--ink)]">
            Parent Verification
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs">
            Enter your 6-digit parent PIN to chat with Penny.
          </p>

          <div
            className="flex justify-center gap-2 my-2"
            aria-label="PIN entry"
          >
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border border-[var(--primary)] transition-all ${
                  idx < pinInput.length
                    ? "bg-[var(--primary)] scale-110"
                    : "bg-transparent"
                }`}
              />
            ))}
          </div>

          <div className="w-full max-w-xs">
            <p role="status" className="text-xs text-[var(--text-secondary)]">{attemptStatus.message}</p>
            <NumericKeypad
              keys={PIN_KEYPAD_KEYS}
              onKeyPress={handlePinKeyPress}
              disabled={pinProcessing || attemptStatus.locked}
              variant="pin"
            />
          </div>

          <button
            type="button"
            className="text-xs text-[var(--text-muted)] hover:underline pt-2"
            onClick={() => {
              setParentPinRequired(false);
              setPinInput("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Messages Thread */}
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
                      {m.remaining} AI question{m.remaining === 1 ? "" : "s"}{" "}
                      left today
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
                      onClick={() =>
                        toast("Thanks, we'll keep improving Penny.")
                      }
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

          {/* Quick Starters (shown when only initial welcome message) */}
          {messages.length <= 1 && mode === "kid" && (
            <div className="penny-starters" aria-label="Suggested questions">
              {KID_STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="insights-ask-chip"
                  onClick={() => void send(s.prompt)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Coach Suggestions */}
          <div
            className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar"
            aria-label="Coach suggestions"
          >
            {(mode === "kid" ? KID_COACH_CHIPS : PARENT_COACH_CHIPS).map(
              (chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="insights-ask-chip whitespace-nowrap shrink-0"
                  disabled={busy}
                  onClick={() => void send(chip.prompt)}
                >
                  {chip.label}
                </button>
              ),
            )}
          </div>

          {/* Message Composer */}
          <form className="penny-chat__composer" onSubmit={handleSubmit}>
            <label htmlFor={`penny-input-${mode}`} className="sr-only">
              Ask Penny
            </label>
            <input
              id={`penny-input-${mode}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "kid"
                  ? "Ask Penny"
                  : "Ask Penny about your kids' finances..."
              }
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

          {/* Disclaimer */}
          <p className="penny-chat__disclaimer">
            {mode === "kid"
              ? "Content is educational and not financial advice. Subject to our Terms of Use."
              : "Penny gives general guidance, not financial, legal or religious rulings."}
          </p>

          {/* Link to Insights on full-page kid chat only */}
          {!inDrawer && mode === "kid" && (
            <Link
              to="/kid/insights"
              className="penny-chat__insights-link"
              onClick={() => sfx.tap()}
            >
              <span className="insights-sheet__handle" aria-hidden="true" />
              Insights
            </Link>
          )}
        </>
      )}
    </div>
  );
}
