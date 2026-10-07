import { useRef, useState } from "react";
import { CornerRightUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";
export interface AIInputWithLoadingProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  busy: boolean;
  onSubmit: (value: string) => void | Promise<void>;
  className?: string;
}
export function AIInputWithLoading({ id = "penny-input", placeholder = "Ask about saving, spending, or where to tap", minHeight = 56, maxHeight = 160, busy, onSubmit, className }: AIInputWithLoadingProps) {
  const [value, setValue] = useState("");
  const submitting = useRef(false);
  const { textareaRef } = useAutoResizeTextarea({ minHeight, maxHeight, value });
  const submit = async () => {
    if (busy || submitting.current || !value.trim()) return;
    submitting.current = true;
    try { await onSubmit(value.trim()); setValue(""); }
    finally { submitting.current = false; }
  };
  return <div className={cn("w-full px-4 py-2", className)}>
    <label htmlFor={id} className="sr-only">Ask Penny</label>
    <div className="relative">
      <Textarea id={id} ref={textareaRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }} placeholder={placeholder} maxLength={2000} disabled={busy} className="resize-none rounded-3xl pl-4 pr-14 py-4 leading-snug" style={{ minHeight, maxHeight }} />
      <button type="button" onClick={() => void submit()} disabled={busy || !value.trim()} aria-label="Send message to Penny" className="absolute right-2 bottom-2 w-11 h-11 flex items-center justify-center rounded-full bg-[var(--primary)] text-white disabled:opacity-50"><CornerRightUp size={20} aria-hidden="true" /></button>
    </div>
    <p className="mt-1 text-xs text-[var(--text-secondary)]">{busy ? "Waiting for Penny’s answer…" : "Enter to send · Shift + Enter for a new line. Never share your PIN."}</p>
  </div>;
}
