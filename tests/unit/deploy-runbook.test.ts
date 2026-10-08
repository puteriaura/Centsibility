import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("deployment runbook validation", () => {
  const text = fs.readFileSync("analysis/DEPLOY-RUNBOOK.md", "utf8");
  it("references real immutable migration versions and the explicit release order", () => {
    for (const version of ["20261005120000", "20261008010000", "20261008020000", "20261008030000"]) {
      expect(fs.readdirSync("supabase/migrations").some(name => name.startsWith(version + "_"))).toBe(true);
      expect(text).toContain("'" + version + "'");
    }
    expect(text).toContain("migrations, then functions, then frontend");
  });
  it("provides only read-only SQL and separates function management metadata", () => {
    const sql = [...text.matchAll(/```sql\n([\s\S]*?)```/g)].map(match => match[1]).join("\n");
    expect(sql).toContain("supabase_migrations.schema_migrations");
    expect(sql).toContain("count(*) filter (where active)");
    expect(sql).toContain("where symbol = 'NVDA'");
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|create|grant|truncate)\b/i);
    expect(text).toContain("management-plane metadata");
    expect(text).toContain("account/organization-role mismatch");
  });
});
