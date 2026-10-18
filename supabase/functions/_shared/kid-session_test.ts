import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { nextExpiry, hashSessionToken, issueKidSession, resolveKidSession, revokeKidSession, revokeAllKidSessions } from "./kid-session.ts";
Deno.test("session expiry slides thirty days but never beyond ninety days from creation", () => {
  assertEquals(nextExpiry("2026-01-01T00:00:00Z", Date.parse("2026-01-10T00:00:00Z")),"2026-02-09T00:00:00.000Z");
  assertEquals(nextExpiry("2026-01-01T00:00:00Z", Date.parse("2026-03-20T00:00:00Z")),"2026-04-01T00:00:00.000Z");
});
Deno.test("token hashing uses SHA-256 and issuance never stores plaintext", async () => {
  assertEquals(await hashSessionToken("abc"),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  let stored: Record<string, unknown> = {};
  const admin = {from:()=>{throw new Error("unexpected")},rpc:(_n:string,args:Record<string,unknown>)=>{stored=args;return Promise.resolve({error:null});}};
  const token = await issueKidSession(admin,"synthetic-kid","synthetic-hash");
  assert(/^[0-9a-f]{64}$/.test(token));
  assertEquals(stored.p_token_hash,await hashSessionToken(token));
  assert(stored.p_token_hash!==token);
  assertEquals(await resolveKidSession(admin,"invalid"),null);
});

Deno.test("two device sessions survive login; logout, expiry and reset revoke the right sessions", async () => {
  const kid = { id: "synthetic-kid", hashed_pin: "synthetic-hash" };
  const sessions: Record<string, unknown>[] = [];
  const admin = {
    rpc: (_name: string, args: Record<string, unknown>) => {
      sessions.push({ id: String(sessions.length), kid_id: kid.id, token_hash: args.p_token_hash,
        created_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
        expires_at: nextExpiry(new Date().toISOString()), revoked_at: null });
      return Promise.resolve({ error: null });
    },
    from(table: string) {
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      let changes: Record<string, unknown> | undefined;
      const result = () => {
        const rows: Record<string, unknown>[] = table === "kids" ? [kid] : sessions;
        const selected = rows.filter(row => filters.every(filter => filter(row)));
        if (changes) selected.forEach(row => Object.assign(row, changes));
        return { data: selected, error: null };
      };
      const query = {
        select: (_columns: string) => query,
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
        is: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
        gt: (key: string, value: string) => { filters.push(row => String(row[key]) > value); return query; },
        update: (values: Record<string, unknown>) => { changes = values; return query; },
        maybeSingle: () => Promise.resolve({ data: result().data[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  };
  const first = await issueKidSession(admin, kid.id, kid.hashed_pin);
  const second = await issueKidSession(admin, kid.id, kid.hashed_pin);
  assertEquals((await resolveKidSession(admin, first))?.id, kid.id);
  assertEquals((await resolveKidSession(admin, second))?.id, kid.id);
  await revokeKidSession(admin, first);
  assertEquals(await resolveKidSession(admin, first), null);
  assertEquals((await resolveKidSession(admin, second))?.id, kid.id);
  await revokeAllKidSessions(admin, kid.id);
  assertEquals(await resolveKidSession(admin, second), null);
  const third = await issueKidSession(admin, kid.id, kid.hashed_pin);
  sessions.at(-1)!.expires_at = "2020-01-01T00:00:00Z";
  assertEquals(await resolveKidSession(admin, third), null);
});
