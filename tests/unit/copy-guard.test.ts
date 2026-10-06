import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source: string, fileName: string): string {
  try {
    return ts.transpileModule(source, {
      fileName,
      compilerOptions: {
        removeComments: true,
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
      },
    }).outputText;
  } catch {
    return source;
  }
}

const BANNED_SPACE_WORDS = [
  "commander",
  "cadet",
  "galaxy",
  "rocket",
  "orbit",
  "planet",
  "astronaut",
  "spaceship",
];

describe("Copy Guard (T37 items 2 & 3)", { timeout: 30000 }, () => {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, "src");
  const allSrcFiles = getFiles(srcDir);

  it("asserts no em dashes (\u2014) or en dashes (\u2013) remain outside comments and PennyMarkdown sanitiser", () => {
    const dashViolations: string[] = [];

    for (const file of allSrcFiles) {
      const relPath = path.relative(rootDir, file).replace(/\\/g, "/");
      let code = stripComments(fs.readFileSync(file, "utf8"), file);

      if (relPath === "src/components/PennyMarkdown.tsx") {
        // Allow the sanitiser regex in PennyMarkdown.tsx
        code = code.replace(/\.replace\(\/[—–]\/g,\s*["'][^"']*["']\)/g, "");
      }

      const lines = code.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/[\u2013\u2014]/.test(line)) {
          dashViolations.push(
            `${relPath}:${i + 1} contains dash: ${line.trim()}`,
          );
        }
      }
    }

    expect(
      dashViolations,
      `Found ${dashViolations.length} disallowed dash(es):\n${dashViolations.join("\n")}`,
    ).toEqual([]);
  });

  it("asserts no banned space-theme words remain in visible UI copy", () => {
    const spaceViolations: string[] = [];
    const bannedRegex = new RegExp(`\\b(${BANNED_SPACE_WORDS.join("|")})\\b`, "i");

    for (const file of allSrcFiles) {
      const relPath = path.relative(rootDir, file).replace(/\\/g, "/");

      // Exclude generated Supabase types and app-icon.tsx icon mappings
      if (
        relPath === "src/integrations/supabase/types.ts" ||
        relPath === "src/components/ui/app-icon.tsx"
      ) {
        continue;
      }

      const code = stripComments(fs.readFileSync(file, "utf8"), file);
      const lines = code.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = bannedRegex.exec(line);
        if (match) {
          spaceViolations.push(
            `${relPath}:${i + 1} contains banned word "${match[1]}": ${line.trim()}`,
          );
        }
      }
    }

    expect(
      spaceViolations,
      `Found ${spaceViolations.length} banned space-theme word(s):\n${spaceViolations.join("\n")}`,
    ).toEqual([]);
  });
});
