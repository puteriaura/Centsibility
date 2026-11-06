import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SCAN_DIRS = ["src/routes", "src/features", "src/components"];
const ALLOWED_DIR = path.normalize("src/features/privacy");

const ALLOWED_REASONS = new Set(["typing", "limit", "toast", "penny", "explicit pdf export"]);

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Privacy Guard (T37 item 1)", () => {
  it("enforces every formatRM call in UI screens/features is masked or annotated with an allowed reason", () => {
    const rootDir = process.cwd();
    const violations: string[] = [];

    const allFiles = SCAN_DIRS.flatMap((d) => getFiles(path.join(rootDir, d)));

    for (const file of allFiles) {
      const relPath = path.relative(rootDir, file).replace(/\\/g, "/");

      // Allowed folder
      if (relPath.startsWith("src/features/privacy/")) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("formatRM(")) {
          // Check for privacy-ok annotation
          const match = /(?:\/\/|\{\/\*|\/\*)\s*privacy-ok:\s*(.+?)(?:\s*\*\/\}|\s*\*\/|$)/.exec(line);
          if (!match) {
            violations.push(
              `${relPath}:${i + 1} - Missing privacy-ok annotation: ${line.trim()}`,
            );
            continue;
          }

          const reason = match[1].trim().toLowerCase();
          const isAllowedReason = ALLOWED_REASONS.has(reason);
          if (!isAllowedReason) {
            violations.push(
              `${relPath}:${i + 1} - Disallowed privacy-ok reason "${reason}": ${line.trim()}`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} unapproved formatRM call(s):\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
