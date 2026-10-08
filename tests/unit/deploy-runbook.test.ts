import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("deployment runbook validation", () => {
  const text = fs.readFileSync("analysis/DEPLOY-RUNBOOK.md", "utf8").replace(/\r\n/g, "\n");
  it("references real immutable migration versions and the explicit release order", () => {
    for (const version of ["20261005120000", "20261006100000", "20261008010000", "20261008020000", "20261008030000"]) {
      expect(fs.readdirSync("supabase/migrations").some(name => name.startsWith(version + "_"))).toBe(true);
      expect(text).toContain("'" + version + "'");
    }
    expect(text).toContain("migrations, then functions, then frontend");
  });
  it("documents the confirmed baseline, backup and Vercel release trap", () => {
    expect(text).toContain("kid-finance version 11"); expect(text).toContain("parent-finance version 7");
    expect(text).toContain("12 market_symbols rows, including NVDA");
    expect(text).toContain("supabase db dump --linked"); expect(text).toContain("Dashboard CSV exports");
    expect(text).toContain("codex/local-upgrade-rehearsal"); expect(text).toContain("Vercel auto-deploy trap");
    expect(text).toContain("cleared after logging into the account that owns the project");
    expect(fs.readFileSync(".gitignore", "utf8")).toContain("analysis/private/");
  });
  it("records a qualified function rollback without reversing the database", () => {
    expect(text).toContain("forward-fix only"); expect(text).toContain("pre-push backup is mandatory");
    expect(text).toContain("40f8c94ae0ec51b7a3aee2ee1ea3f1c72967a283"); expect(text).toContain("SUSPECTED rollback source");
    expect(text).toContain("08:59:44 UTC"); expect(text).toContain("parent-finance is **v7**, not v11");
    expect(text).toContain("--project-ref uoghvqciodboxhfopuip --workdir $rollbackFolder --use-api");
    expect(text).toContain("predates current account-wide PIN handling and AI data minimization");
    expect(text).toContain("does not revert database functions");
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
