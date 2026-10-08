import { beforeEach, describe, expect, it, vi } from "vitest";
const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: feedback }));
vi.mock("@/lib/sounds", () => ({ sfx: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react", async () => ({
  ...(await vi.importActual<typeof import("react")>("react")),
  useState: () => [false, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
}));
import { useMoneyAction } from "@/hooks/use-money-action";

describe("Penny money feedback", () => {
  beforeEach(() => vi.clearAllMocks());
  it("waits for confirmation before showing the chosen Penny state", async () => {
    let confirm!: (value: { saved: number }) => void;
    const pending = new Promise<{ saved: number }>((resolve) => {
      confirm = resolve;
    });
    const action = useMoneyAction();
    const result = action.run(() => pending, {
      success: "Saved",
      pennyState: (res) => (res.saved >= 100 ? "celebrate" : "saved"),
    });
    expect(feedback.success).not.toHaveBeenCalled();
    expect(await action.run(async () => ({ saved: 10 }))).toBeNull();
    confirm({ saved: 100 });
    await result;
    expect(feedback.success.mock.calls[0][1].icon.props.state).toBe(
      "celebrate",
    );
  });
  it("shows calm failure feedback without celebrating a failed action", async () => {
    await useMoneyAction().run(
      async () => {
        throw new Error("Offline");
      },
      { success: "Saved", retry: false },
    );
    expect(feedback.success).not.toHaveBeenCalled();
    expect(feedback.error.mock.calls[0][1].icon.props.state).toBe(
      "unavailable",
    );
    expect(feedback.error.mock.calls[0][1].action).toBeUndefined();
  });
});
