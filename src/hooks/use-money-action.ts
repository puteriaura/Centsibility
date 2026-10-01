import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { sanitizeDisplayText } from "@/lib/labels";

export interface MoneyActionOptions<T> {
  success?: string | ((res: T) => string);
  failure?: string;
  onSuccess?: (res: T) => void | Promise<void>;
  onError?: (err: Error) => void;
  refresh?: () => void | Promise<void>;
  retry?: boolean;
}

export function useMoneyAction() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(
    async <T>(
      actionFn: () => Promise<T>,
      options: MoneyActionOptions<T> = {}
    ): Promise<T | null> => {
      if (busyRef.current) return null;

      busyRef.current = true;
      setBusy(true);

      try {
        const res = await actionFn();
        sfx.success();
        if (options.success) {
          const text =
            typeof options.success === "function"
              ? options.success(res)
              : options.success;
          if (text) toast.success(text);
        }
        if (options.onSuccess) {
          await options.onSuccess(res);
        }
        if (options.refresh) {
          await options.refresh();
        }
        return res;
      } catch (err: unknown) {
        sfx.error();
        const rawMsg = err instanceof Error ? err.message : String(err);
        const cleanMsg = sanitizeDisplayText(rawMsg);
        const failTitle = options.failure || "Action didn't go through";
        const allowRetry = options.retry ?? true;

        toast.error(failTitle, {
          description: cleanMsg,
          ...(allowRetry
            ? {
                action: {
                  label: "Retry",
                  onClick: () => {
                    void run(actionFn, options);
                  },
                },
              }
            : {}),
          duration: 8000,
        });

        if (options.onError) {
          options.onError(err instanceof Error ? err : new Error(cleanMsg));
        }
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    []
  );

  return { busy, run };
}
