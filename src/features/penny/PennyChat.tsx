import * as React from "react";
import { useTheme } from "@/lib/theme";
import { usePinStatus } from "@/hooks/use-pin-status";
import { Link, useNavigate } from "@tanstack/react-router";
import { usePenny } from "./PennyProvider";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { NumericKeypad, PIN_KEYPAD_KEYS } from "@/components/ui/numeric-keypad";
import { StreamingPennyReply } from "@/components/StreamingPennyReply";
import { AIInputWithLoading } from "@/components/AIInputWithLoading";
import { ShiningText } from "@/components/ShiningText";
import { cn } from "@/lib/utils";
import { edgeParentVerifyPin } from "@/lib/edge";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";
import { PennyMascot } from "@/components/PennyMascot";

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
  const { reduced } = useTheme();
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
  const initialMessageIds = React.useRef(new Set(messages.map(m => m.id)));
  const [pinInput, setPinInput] = React.useState("");
  const [pinProcessing, setPinProcessing] = React.useState(false);
  const threadRef = React.useRef<HTMLDivElement>(null);

  // Scroll only the thread: scrollIntoView also scrolled the page and the drawer.
  // Until the conversation starts, keep the welcome and its AI notice in view.
  React.useEffect(() => {
    const thread = threadRef.current;
    if (!thread || (messages.length <= 1 && !busy)) return;
    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: reduced ? "instant" : "smooth",
    });
  }, [messages, busy, reduced]);

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
    <div className={cn("penny-chat", inDrawer && "penny-chat--drawer")}>
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
          <PennyMascot
            state={pinProcessing ? "loading" : "attentive"}
            size={96}
          />
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
                className={cn("w-3.5 h-3.5 rounded-full border border-[var(--primary)] transition-all", idx < pinInput.length ? "bg-[var(--primary)] scale-110" : "bg-transparent")}
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
          {/* Messages Thread: the welcome, starters and replies scroll together */}
          <div
            ref={threadRef}
            className="penny-chat__thread"
            role="log"
            aria-live="polite"
          >
            <div className="penny-chat__mascot" aria-live="off">
              <PennyMascot
                state={
                  busy
                    ? "loading"
                    : messages.at(-1)?.offline
                      ? "reassuring"
                      : messages.length <= 1
                        ? "welcome"
                        : "neutral"
                }
                size={72}
              />
              <span className="penny-chat__tagline">
                {busy ? "Preparing your reply…" : "Your money buddy"}
              </span>
              <p className="penny-chat__note">
                Penny is an AI helper and can make mistakes. Ask a parent about
                real money decisions.
              </p>
            </div>
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} data-new={!initialMessageIds.current.has(m.id) || undefined} className="penny-bubble penny-bubble--user">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} data-new={!initialMessageIds.current.has(m.id) || undefined} className="penny-assistant">
                  <StreamingPennyReply text={m.text} animate={m.id === messages[messages.length - 1]?.id && !initialMessageIds.current.has(m.id)} />
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
                <p className="penny-assistant__text text-[var(--text-secondary)] flex items-center gap-1.5">
                  <ShiningText text="Penny is thinking…" />
                </p>
              </div>
            )}
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
          </div>

          {/* Pinned footer: suggestions, composer and disclaimer never shrink the thread */}
          <div className="penny-chat__footer">
            {/* Coach Suggestions */}
            <div
              className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar"
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
            <AIInputWithLoading id={`penny-input-${mode}`} busy={busy} onSubmit={send} placeholder={mode === "kid" ? "Ask about saving, spending, or where to tap" : "Ask about your family’s money habits"} />

            {/* Disclaimer */}
            <p className="penny-chat__disclaimer">
              {mode === "kid"
                ? "Penny's AI sees your question with names and numbers removed. Content is educational and not financial advice."
                : "Penny's AI sees your question with names and numbers removed. Penny gives general guidance, not financial, legal or religious rulings."}
            </p>

            <Link to="/privacy" className="text-xs underline">Privacy notice</Link>

            {/* Link to Insights on full-page kid chat only */}
            {!inDrawer && mode === "kid" && (
              <Link
                to="/kid/insights"
                className="penny-chat__insights-link"
                onClick={() => sfx.tap()}
              >
                Insights
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
