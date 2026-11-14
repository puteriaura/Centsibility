import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildWeeklyDigest } from "@/lib/weekly-digest";
import { PRIVACY_NOTICE_VERSION } from "../../supabase/functions/_shared/privacy-version";

describe("V4 privacy, weekly digest, and offline shell", () => {
  it("computes 7-day weekly digest metrics and talking point", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const kids = [
      { id: "k1", name: "Child A", streak: 5 },
      { id: "k2", name: "Child B", streak: 2 },
    ];
    const txs = [
      { id: "t1", type: "DEPOSIT", amount: 15, created_at: "2026-11-14T10:00:00Z" },
      { id: "t2", type: "CHORE", amount: 4.5, created_at: "2026-11-13T10:00:00Z" },
      { id: "t3", type: "SADAQAH", amount: 3, created_at: "2026-11-12T10:00:00Z" },
      { id: "t4", type: "DEPOSIT", amount: 99, created_at: "2026-10-01T10:00:00Z" },
    ];
    const approvals = [
      { id: "a1", status: "PENDING" },
      { id: "a2", status: "APPROVED" },
    ];

    const digest = buildWeeklyDigest(kids, txs, approvals, now);
    expect(digest.savedAmount).toBe(19.5);
    expect(digest.givenAmount).toBe(3);
    expect(digest.pendingRequests).toBe(1);
    expect(digest.topStreak).toBe(5);
    expect(digest.topStreakKid).toBe("Child A");
    expect(digest.txCount).toBe(3);
    expect(digest.talkingPointEn).toContain("1 waiting request");
  });

  it("keeps service worker cache strictly limited to static shell and never caches API routes", () => {
    const sw = fs.readFileSync(path.resolve("public/sw.js"), "utf8");
    expect(sw).toContain('url.pathname.startsWith("/functions/")');
    expect(sw).toContain('url.pathname.startsWith("/rest/")');
    expect(sw).toContain('url.pathname.startsWith("/auth/")');
    expect(sw).toContain('self.addEventListener("push"');
    expect(sw).toContain('self.addEventListener("notificationclick"');
  });

  it("updates privacy notice version and removes planned-feature wording", () => {
    expect(PRIVACY_NOTICE_VERSION).toBe("2026-11-15");
    const privacy = fs.readFileSync(path.resolve("src/routes/privacy.tsx"), "utf8");
    expect(privacy).not.toContain("planned features");
    expect(privacy).toContain("Retention rule");
    expect(privacy).toContain("Peraturan penyimpanan");
  });
});
