import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { hasIcon } from "@/components/ui/app-icon";

function getAllTsxFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      getAllTsxFiles(fullPath, fileList);
    } else if (file.endsWith(".tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("AppIcon coverage", () => {
  it("resolves all static icon names used across src TSX components", () => {
    const srcDir = join(process.cwd(), "src");
    const tsxFiles = getAllTsxFiles(srcDir);
    const missingIcons: Array<{ file: string; icon: string }> = [];

    // Match <AppIcon ... name="..." ... />
    // Also handles name="..." before or after other props
    const iconRegex = /<AppIcon[^>]*\bname="([^"]+)"/g;
    const iconRegexAlt = /<AppIcon[^>]*\bname={'([^']+)'}/g;

    for (const filePath of tsxFiles) {
      const content = readFileSync(filePath, "utf-8");
      let match: RegExpExecArray | null;

      while ((match = iconRegex.exec(content)) !== null) {
        const iconName = match[1];
        if (!hasIcon(iconName)) {
          missingIcons.push({ file: filePath, icon: iconName });
        }
      }

      while ((match = iconRegexAlt.exec(content)) !== null) {
        const iconName = match[1];
        if (!hasIcon(iconName)) {
          missingIcons.push({ file: filePath, icon: iconName });
        }
      }
    }

    expect(missingIcons).toEqual([]);
  });

  it("hasIcon returns true for standard known icons", () => {
    expect(hasIcon("transfer")).toBe(true);
    expect(hasIcon("chevron-down")).toBe(true);
    expect(hasIcon("chevron-up")).toBe(true);
    expect(hasIcon("timer")).toBe(true);
    expect(hasIcon("missions")).toBe(true);
    expect(hasIcon("wallet")).toBe(true);
    expect(hasIcon("home")).toBe(true);
  });

  it("resolves all quest icons used in quest bank migration", () => {
    const migrationPath = join(process.cwd(), "supabase", "migrations", "20260930140000_quest_bank_v1.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    const iconRegex = /'\s*,\s*'([a-z0-9_-]+)'\s*,\s*\d+\s*,\s*true\s*\)/g;
    const icons: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = iconRegex.exec(sql)) !== null) {
      icons.push(match[1]);
    }
    expect(icons.length).toBe(24);
    for (const icon of icons) {
      expect(hasIcon(icon), `Quest icon '${icon}' should be recognized`).toBe(true);
    }
  });
});
