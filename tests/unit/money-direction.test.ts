import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEBIT_TYPES,
  formatTransactionSign,
  isDebitTransaction,
  isWalletTransaction,
  transactionAmount,
} from "@/lib/finance";

describe("T30 money direction — table test over all ledger types", () => {
  interface TestCase {
    type: string;
    label?: string | null;
    isWallet: boolean;
    isDebit: boolean;
    sign: "+" | "-";
    expectedText: string;
    expectedTone: "in" | "out";
  }

  const cases: TestCase[] = [
    // Credits
    {
      type: "DEPOSIT",
      isWallet: true,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
    {
      type: "HIBAH",
      isWallet: true,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
    {
      type: "QARD",
      isWallet: true,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
    {
      type: "INVEST_OUT",
      isWallet: true,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
    {
      type: "GOAL_OUT",
      isWallet: true,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
    {
      type: "TRANSFER_IN",
      isWallet: true,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },

    // Debits
    {
      type: "WITHDRAWAL",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "SADAQAH",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "INVEST_IN",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "FEE",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "QARD_REPAY",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "GOAL_IN",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "TRANSFER_OUT",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },
    {
      type: "QARD",
      label: "Loan repayment",
      isWallet: true,
      isDebit: true,
      sign: "-",
      expectedText: "−RM10.00",
      expectedTone: "out",
    },

    // Pot only
    {
      type: "INVEST_GAIN",
      isWallet: false,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
    {
      type: "INVEST_LOSS",
      isWallet: false,
      isDebit: false,
      sign: "+",
      expectedText: "+RM10.00",
      expectedTone: "in",
    },
  ];

  for (const c of cases) {
    const testName = c.label ? `${c.type} (${c.label})` : c.type;
    it(`verifies ${testName}`, () => {
      expect(isWalletTransaction(c.type)).toBe(c.isWallet);
      expect(isDebitTransaction(c.type, c.label)).toBe(c.isDebit);
      expect(formatTransactionSign(c.type, c.label)).toBe(c.sign);

      const res = transactionAmount(c.type, c.label, 10);
      expect(res.text).toBe(c.expectedText);
      expect(res.tone).toBe(c.expectedTone);
      // Unicode minus sign (\u2212) check for out
      if (c.expectedTone === "out") {
        expect(res.text.startsWith("\u2212")).toBe(true);
      } else {
        expect(res.text.startsWith("+")).toBe(true);
      }
    });
  }
});

describe("T30 drift guard — DEBIT_TYPES matches edge function", () => {
  it("client DEBIT_TYPES equals edge _shared/deepseek.ts DEBIT_TYPES", () => {
    const edgeFilePath = path.resolve(__dirname, "../../supabase/functions/_shared/deepseek.ts");
    const edgeContent = fs.readFileSync(edgeFilePath, "utf-8");

    const match = edgeContent.match(/const\s+DEBIT_TYPES\s*=\s*new\s+Set\(\s*\[([\s\S]*?)\]\s*\);/);
    expect(match).not.toBeNull();
    const rawItems = match![1].match(/["']([^"']+)["']/g);
    expect(rawItems).not.toBeNull();
    const edgeTypes = rawItems!.map((item) => item.replace(/["']/g, ""));
    const edgeSet = new Set(edgeTypes);

    expect(DEBIT_TYPES).toEqual(edgeSet);
  });
});

describe("T30 source guard — no hand-written WITHDRAWAL arrays in routes or features", () => {
  it("ensures zero occurrences of [ 'WITHDRAWAL' in src/routes and src/features", () => {
    const srcDir = path.resolve(__dirname, "../../src");
    const targetDirs = [path.join(srcDir, "routes"), path.join(srcDir, "features")];
    const regex = /\[\s*["']WITHDRAWAL["']/;

    const violations: { file: string; line: number; text: string }[] = [];

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              violations.push({
                file: path.relative(srcDir, fullPath).replace(/\\/g, "/"),
                line: idx + 1,
                text: line.trim(),
              });
            }
          });
        }
      }
    }

    for (const d of targetDirs) {
      scanDir(d);
    }

    expect(violations).toEqual([]);
  });
});
