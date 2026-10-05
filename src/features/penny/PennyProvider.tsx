import * as React from "react";
import {
  type ChatMessage,
  type PennyPageContext,
  type PennyOpenOptions,
  type PennyContextValue,
} from "./types";
import { PennyDrawer } from "./PennyDrawer";
import { loadCachedMessages, saveCachedMessages } from "./storage";
import {
  edgeKidPennyChat,
  edgeParentPennyChat,
  extractEdgeErrorMessage,
} from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { isKidBypassed } from "@/lib/admin-bypass";
import { buildSpendingSummary, pennyReply } from "@/lib/penny-insights";
import { useKidData } from "@/hooks/use-kid-data";
import { useAuth } from "@/providers/auth";
import { sfx } from "@/lib/sounds";
import { toast } from "sonner";

const PennyContext = React.createContext<PennyContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function usePenny(): PennyContextValue {
  const ctx = React.useContext(PennyContext);
  if (!ctx) {
    throw new Error("usePenny must be used within a PennyProvider");
  }
  return ctx;
}

function getInitialGreeting(
  mode: "kid" | "parent",
  comfortName?: string,
): ChatMessage {
  if (mode === "parent") {
    const target = comfortName ? ` ${comfortName}` : "";
    return {
      id: "welcome",
      role: "assistant",
      text: `Salam${target}! I'm Penny, your family's Shariah money coach.\n\nI can help you review your children's habits, give you gentle conversation starters, or suggest next steps for allowance and saving. What would you like to explore?`,
    };
  }
  return {
    id: "welcome",
    role: "assistant",
    text: `Salam and hi there! I'm Penny, your money buddy.\n\nAsk me about spending breakdowns, Tabung, sadaqah, or rewards. I'll use your real activity to guide you.`,
  };
}

export interface PennyProviderProps {
  children: React.ReactNode;
  mode: "kid" | "parent";
}

export function PennyProvider({ children, mode }: PennyProviderProps) {
  const { user } = useAuth();
  // useKidData is safe to call if in kid context
  const kidData = useKidData();
  const parentComfortName = (
    user?.user_metadata as { comfort_name?: string } | undefined
  )?.comfort_name?.trim();

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    const cached = loadCachedMessages(mode);
    if (cached && cached.length > 0) return cached;
    return [getInitialGreeting(mode, parentComfortName)];
  });

  const [busy, setBusy] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [pageContext, setPageContext] = React.useState<PennyPageContext | null>(
    null,
  );
  const [parentPinRequired, setParentPinRequired] = React.useState(false);
  const pendingMessageRef = React.useRef<{
    text: string;
    context?: PennyPageContext;
  } | null>(null);

  // Sync to session storage on change
  React.useEffect(() => {
    if (messages.length > 0) {
      saveCachedMessages(mode, messages);
    }
  }, [messages, mode]);

  const kidSummary = React.useMemo(() => {
    if (mode !== "kid" || !kidData?.data?.txs) return null;
    return buildSpendingSummary(
      kidData.data.txs as Parameters<typeof buildSpendingSummary>[0],
      90,
    );
  }, [mode, kidData?.data?.txs]);

  const send = React.useCallback(
    async (text: string, contextOverride?: PennyPageContext) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      sfx.tap();
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);

      const ctxToSend = contextOverride ?? pageContext ?? undefined;

      if (mode === "kid") {
        const code =
          getKidSession()?.code ?? (isKidBypassed() ? "DEMO_CODE" : null);

        // Fallback to offline rule-based response if no session code
        if (!code) {
          await new Promise((r) => setTimeout(r, 350));
          const offlineReply: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: pennyReply(
              trimmed,
              kidSummary,
              kidData?.data?.kid?.name ?? "friend",
            ),
            offline: true,
          };
          setMessages((prev) => [...prev, offlineReply]);
          setBusy(false);
          sfx.pop();
          return;
        }

        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.text,
        }));

        try {
          const res = await edgeKidPennyChat({
            code,
            message: trimmed,
            history,
            context: ctxToSend,
          });

          const replyMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: res.reply,
            remaining: res.remaining,
          };
          setMessages((prev) => [...prev, replyMsg]);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (
            errMsg.includes("429") ||
            errMsg.toLowerCase().includes("rest") ||
            errMsg.toLowerCase().includes("tomorrow")
          ) {
            toast("Penny needs a rest. Try again tomorrow.");
          }
          const offlineReply: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: pennyReply(
              trimmed,
              kidSummary,
              kidData?.data?.kid?.name ?? "friend",
            ),
            offline: true,
          };
          setMessages((prev) => [...prev, offlineReply]);
        } finally {
          setBusy(false);
          sfx.pop();
        }
      } else {
        // Parent mode
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.text,
        }));

        try {
          const res = await edgeParentPennyChat({
            message: trimmed,
            history,
            context: ctxToSend,
          });

          const replyMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: res.reply,
            remaining: res.remaining,
          };
          setMessages((prev) => [...prev, replyMsg]);
          sfx.pop();
        } catch (err: unknown) {
          const errMsg = await extractEdgeErrorMessage(err);
          if (
            errMsg.includes("PIN required") ||
            errMsg.includes("403") ||
            errMsg.toLowerCase().includes("pin")
          ) {
            // Store pending message to retry after parent PIN verified
            pendingMessageRef.current = { text: trimmed, context: ctxToSend };
            setParentPinRequired(true);
            setBusy(false);
            return;
          }

          if (
            errMsg.includes("429") ||
            errMsg.toLowerCase().includes("limit") ||
            errMsg.toLowerCase().includes("tomorrow")
          ) {
            toast(
              "Penny needs a rest. You've reached your daily quota. Try again tomorrow.",
            );
          } else {
            toast.error(errMsg || "Penny couldn't respond right now.");
          }

          const fallbackMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: "I'm having a little trouble connecting right now. Please try asking again in a moment, or check back later.",
          };
          setMessages((prev) => [...prev, fallbackMsg]);
        } finally {
          setBusy(false);
        }
      }
    },
    [busy, mode, messages, pageContext, kidSummary, kidData?.data?.kid?.name],
  );

  const retryAfterParentPin = React.useCallback(async () => {
    setParentPinRequired(false);
    const pending = pendingMessageRef.current;
    if (!pending) return;
    pendingMessageRef.current = null;

    setBusy(true);
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const res = await edgeParentPennyChat({
        message: pending.text,
        history,
        context: pending.context ?? pageContext ?? undefined,
      });

      const replyMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.reply,
        remaining: res.remaining,
      };
      setMessages((prev) => [...prev, replyMsg]);
      sfx.pop();
    } catch (err: unknown) {
      const errMsg = await extractEdgeErrorMessage(err);
      toast.error(errMsg || "Penny couldn't respond right now.");
    } finally {
      setBusy(false);
    }
  }, [messages, pageContext]);

  const openPenny = React.useCallback(
    (opts?: PennyOpenOptions) => {
      if (opts?.context) {
        setPageContext(opts.context);
      }
      setIsOpen(true);
      if (opts?.prompt && opts.prompt.trim()) {
        void send(opts.prompt.trim(), opts.context);
      }
    },
    [send],
  );

  const closePenny = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const newChat = React.useCallback(() => {
    sfx.tap();
    const fresh = [getInitialGreeting(mode, parentComfortName)];
    setMessages(fresh);
    saveCachedMessages(mode, fresh);
  }, [mode, parentComfortName]);

  const contextValue: PennyContextValue = React.useMemo(
    () => ({
      messages,
      busy,
      isOpen,
      mode,
      pageContext,
      parentPinRequired,
      openPenny,
      closePenny,
      send,
      newChat,
      setPageContext,
      setParentPinRequired,
      retryAfterParentPin,
    }),
    [
      messages,
      busy,
      isOpen,
      mode,
      pageContext,
      parentPinRequired,
      openPenny,
      closePenny,
      send,
      newChat,
      retryAfterParentPin,
    ],
  );

  return (
    <PennyContext.Provider value={contextValue}>
      {children}
      <PennyDrawer />
    </PennyContext.Provider>
  );
}
