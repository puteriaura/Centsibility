import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { PennyChat, usePenny } from "@/features/penny";

type ChatSearch = { q?: string };

export const Route = createFileRoute("/kid/chat")({
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({ meta: [{ title: "Penny | Centsibility" }] }),
  component: KidChatRoute,
});

function KidChatRoute() {
  const { q } = Route.useSearch();
  const { send } = usePenny();
  const handledQ = useRef<string | null>(null);

  useEffect(() => {
    if (q && q.trim() && handledQ.current !== q) {
      handledQ.current = q;
      const seedPrompt =
        q === "spending"
          ? "I would like to know more about spending."
          : q === "savings"
            ? "How can I save better?"
            : q === "surprise"
              ? "Surprise me with a tip."
              : q.trim();
      void send(seedPrompt);
    }
  }, [q, send]);

  return <PennyChat inDrawer={false} mode="kid" />;
}
