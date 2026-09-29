import { describe, it, expect } from "vitest";
import { parentDisplayName } from "../../src/lib/display-name";

describe("parentDisplayName", () => {
  it("resolves Google user with full_name", () => {
    const user = {
      user_metadata: { full_name: "Ahmad Albab" },
      email: "ahmad@gmail.com",
    };
    expect(parentDisplayName(user)).toBe("Ahmad Albab");
  });

  it("resolves old email user with display_name", () => {
    const user = {
      user_metadata: { display_name: "Fatima Zahra" },
      email: "fatima@example.com",
    };
    expect(parentDisplayName(user)).toBe("Fatima Zahra");
  });

  it("resolves user with no metadata using email username", () => {
    const user = {
      user_metadata: {},
      email: "khadijah@example.com",
    };
    expect(parentDisplayName(user)).toBe("khadijah");
  });

  it("prefers display_name over full_name and name", () => {
    const user = {
      user_metadata: {
        display_name: "Custom Name",
        full_name: "Google Full Name",
        name: "Google Name",
      },
      email: "custom@gmail.com",
    };
    expect(parentDisplayName(user)).toBe("Custom Name");
  });

  it("falls back to 'Parent' when no metadata and no email", () => {
    expect(parentDisplayName(null)).toBe("Parent");
    expect(parentDisplayName(undefined)).toBe("Parent");
    expect(parentDisplayName({ user_metadata: null, email: null })).toBe("Parent");
  });
});
