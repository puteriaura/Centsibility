import { describe, it, expect } from "vitest";
import { getSproutStage } from "@/components/SproutIllustration";
import { LESSON_CARDS, SADAQAH_PLEDGE } from "@/content/lessons";
import { KID_CARD_THEMES } from "@/lib/theme";
import { getMalaysiaSeason, JAKIM_ESOLAT_SOURCE_URL } from "@/content/ramadan";
import { getKidCopy, GLOSSARY_TERMS } from "@/lib/i18n";
import { levelNameFor } from "@/lib/kid-level";
import { TRANSACTION_TYPE_LABELS, APPROVAL_KIND_LABELS } from "@/lib/labels";
import { KNOWN_CREDIT_TYPES, walletDeltaCents } from "../../supabase/functions/_shared/wallet-transactions";

describe("V3 Delight unit checks", () => {
  it("computes all 6 sprout stages accurately and guards NaN/0", () => {
    expect(getSproutStage(0).label).toBe("Seed");
    expect(getSproutStage(Number.NaN).label).toBe("Seed");
    expect(getSproutStage(10).label).toBe("Shoot");
    expect(getSproutStage(30).label).toBe("Two leaves");
    expect(getSproutStage(60).label).toBe("Three leaves");
    expect(getSproutStage(85).label).toBe("Bud");
    expect(getSproutStage(100).label).toBe("Bloom");
  });

  it("provides sourced lesson cards and Sadaqah pledge", () => {
    expect(LESSON_CARDS.sadaqah.source).toBe("Sahih Muslim 2588");
    expect(LESSON_CARDS.sadaqah.pledge).toBe(SADAQAH_PLEDGE);
    expect(LESSON_CARDS.tabung.source).toContain("7:31");
    expect(LESSON_CARDS.qard.source).toContain("6:152");
  });

  it("exposes 6 child card colours with >= 7:1 contrast", () => {
    expect(KID_CARD_THEMES).toHaveLength(6);
    for (const theme of KID_CARD_THEMES) {
      const ratio = Number.parseFloat(theme.ratio);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    }
  });

  it("computes JAKIM 2026-2027 Ramadan and Raya dates", () => {
    const r1 = getMalaysiaSeason(new Date("2026-02-19T06:00:00Z"), "auto");
    expect(r1.mode).toBe("ramadan");
    expect(r1.ramadanDay).toBe(1);
    expect(r1.sourceUrl).toBe(JAKIM_ESOLAT_SOURCE_URL);

    const raya = getMalaysiaSeason(new Date("2026-03-21T06:00:00Z"), "auto");
    expect(raya.mode).toBe("raya");
    expect(raya.syawalDay).toBe(1);

    const r2 = getMalaysiaSeason(new Date("2027-02-08T06:00:00Z"), "auto");
    expect(r2.mode).toBe("ramadan");
    expect(r2.hijriYear).toBe("1448H");
  });

  it("supports age 6-9 simplified words, BM dictionary, and 7 glossary terms", () => {
    expect(getKidCopy("en", "6-9").outstandingBorrowing).toBe("Money I owe");
    expect(getKidCopy("ms", "10-12").home).toBe("Utama");
    expect(Object.keys(GLOSSARY_TERMS)).toHaveLength(7);
  });

  it("maps named kid levels, BM copy, and CHORE labels/credits", () => {
    expect(levelNameFor(1)).toBe("Seedling");
    expect(levelNameFor(2)).toBe("Sprout");
    expect(levelNameFor(3)).toBe("Sapling");
    expect(levelNameFor(4)).toBe("Tree");
    expect(TRANSACTION_TYPE_LABELS.CHORE).toBe("Chore reward");
    expect(APPROVAL_KIND_LABELS.CHORE).toBe("Chore request");
    expect(KNOWN_CREDIT_TYPES.has("CHORE")).toBe(true);
    expect(getKidCopy("ms", "6-9").agesPrefix).toBe("Umur");
    expect(getKidCopy("ms", "6-9").toSpend).toBe("untuk belanja");
    expect(walletDeltaCents({ type: "CHORE", amount: 3.5 })).toBe(350);
  });
});
