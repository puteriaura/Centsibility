import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanPennyQuestion, getPennyKnownNames, minimizePennyQuestion } from "./penny-minimization.ts";
import { buildPennyRequest, kidSystemPrompt } from "./penny-ai.ts";
const noReads = { from() { throw new Error("Unexpected data read"); } } as any;
const now = new Date("2026-10-25T12:00:00Z");
const reference = ["AB", "2", "CD", "3"].join("");
const pin = "6".repeat(6);

Deno.test("penny-cleaned: normalizes width and whitespace, replaces quotes, and preserves a plain chip", () => {
  assertEquals(cleanPennyQuestion('  Ｓａｖｅ   "RM10"\n each week  ', []), { text: "Save 'RM10' each week", removed: 0 });
  const chip = "Teach me one money idea for my age, with a tiny example.";
  assertEquals(cleanPennyQuestion(chip, []), { text: chip, removed: 0 });
});
Deno.test("penny-cleaned: known family names match case, punctuation and full-name words without splitting longer words", () => {
  const result = cleanPennyQuestion("(AMIR BIN ALI), Amir, ali and Mama help Amirah bin binti bte bt save.", ["Amir bin Ali", "Mama"]);
  assertEquals(result.text, "([name]), [name], [name] and [name] help Amirah bin binti bte bt save.");
  assertEquals(result.removed, 4);
  assertEquals(cleanPennyQuestion("李明 and Siti can help me save.", ["李明", "Siti Nur Aina"]).text, "[name] and [name] can help me save.");
});
Deno.test("penny-cleaned: escapes regular expressions and uses letter-aware boundaries", () => {
  assertEquals(cleanPennyQuestion("Jo.+ helps JoX while Jo.+ saves.", ["Jo.+"]).text, "[name] helps JoX while [name] saves.");
  assertEquals(cleanPennyQuestion("Li helps Little and Ali helps Alice.", ["Li", "Ali"]).text, "[name] helps Little and [name] helps Alice.");
});
Deno.test("penny-cleaned: removes emails and links in English and Malay", () => {
  for (const message of ["Ask sample@example.invalid or https://example.invalid/help about saving.", "Tanya sample@example.invalid dan www.example.invalid untuk simpan."]) {
    const result = cleanPennyQuestion(message, []);
    assert(!result.text.includes("@") && !result.text.includes("example.invalid"));assertEquals(result.removed, 2);
  }
});
Deno.test("penny-cleaned: removes spaced and dashed long numbers, short PINs and mixed access-code shapes", () => {
  for (const value of ["+60 " + "9".repeat(9), ["9".repeat(6), "99", "9".repeat(4)].join("-"), "9 9 9 9 9 9 9 9", pin, reference]) {
    const result = cleanPennyQuestion(`How can I save with reference ${value}?`, []);
    assert(!result.text.includes(value));assertEquals(result.removed, 1);assert(result.text.includes("[removed]"));
  }
  assertEquals(cleanPennyQuestion("Saving with ABCDEF is fine.", []).removed, 0);
});
Deno.test("penny-cleaned: removes every specified street-address prefix through punctuation", () => {
  for (const prefix of ["Jalan", "jln", "Lorong", "lrg", "Taman", "tmn", "blok", "block", "apartment", "kondo", "condo", "No. 4"]) {
    const result = cleanPennyQuestion(`Can I save near ${prefix} Example 12, each week?`, []);
    assertEquals(result.text, "Can I save near [removed], each week?");assertEquals(result.removed, 1);
  }
});
Deno.test("penny-cleaned: everyday street words stay and actual addresses are removed", () => {
  for (const question of [
    "Why did my parent block my card?", "Kad saya tak jalan, kenapa?",
    "Boleh saya simpan duit untuk pergi taman tema?", "Is street food cheaper than the canteen?",
    "Jalan-jalan ke Melaka perlu RM50, macam mana nak simpan?", "How much should I save for the road trip?",
    "Can I buy a lego block set for RM60?", "What is a condo?",
    "Jalan kaki ke sekolah jimat duit?", "Taman permainan baru ada RM5 tiket",
  ]) assertEquals(cleanPennyQuestion(question, []).text, question);
  for (const [question, expected] of [
    ["Saya tinggal di Jalan Mawar 5, Taman Desa.", "Saya tinggal di [removed], [removed]."],
    ["my house is at no. 12 jalan mawar 3, 47500 Subang Jaya", "my house is at [removed], [removed] Subang Jaya"],
    ["I live at Lorong 3 near the shop", "I live at [removed]"],
    ["rumah saya jln ss2/24 petaling jaya", "rumah saya [removed]"],
    ["We live on Baker Street, near the park.", "We live on [removed], near the park."],
    ["alamat saya Blok C 12, Pangsapuri Seri 3", "alamat saya [removed], [removed]"],
    ["Can I save near Example Street 12, each week?", "Can I save near [removed], each week?"],
    ["Can I save near Example Road 12, each week?", "Can I save near [removed], each week?"],
  ]) assertEquals(cleanPennyQuestion(question, []).text, expected);
});
Deno.test("penny-cleaned: removes labelled and capital-place postcodes while preserving small money questions", () => {
  for (const label of ["poskod", "postcode", "postal code"]) {
    assertEquals(cleanPennyQuestion(`Can I save near ${label}: 50000?`, []).text, "Can I save near [removed]?");
  }
  assertEquals(cleanPennyQuestion("Can I save in 50000 Kuala Lumpur?", []).text, "Can I save in [removed] Kuala Lumpur?");
  for (const question of ["How can I save RM10000?", "How can I save RM1234?", "save 10000 for a bike", "How can I save RM12345.67?", "Save 10000 Ringgit for school", "Save 10000 RM for school", "Save 10000 Sen for school"]) {
    assertEquals(cleanPennyQuestion(question, []).text, question);
  }
});
Deno.test("penny-cleaned: caps cleaned text at 280 characters", () => {
  const result = cleanPennyQuestion("How can I save? ".repeat(40), []);
  assertEquals(result.text.length, 280);
});
Deno.test("penny-cleaned: both chips and form questions reach Penny with the correct asker", async () => {
  for (const message of ["Teach me one money idea for my age, with a tiny example.", "How can I improve?", "Please explain this form for saving."]) {
    const child = await minimizePennyQuestion(noReads, {}, message, {}, now);
    assertEquals(child.question, `Child asks: "${message}"`);
    const parent = await minimizePennyQuestion(noReads, {}, message, {}, now, { asker: "parent", knownNames: [] });
    assertEquals(parent.question, `Parent asks: "${message}"`);
  }
});
Deno.test("penny-cleaned: includes own identity and family names but keeps aggregate prompts and safe audit", async () => {
  const kid = { name: "Private Child", comfort_name: "Secret Name", username: "saverfriend", balance: 10 };
  const plan = await minimizePennyQuestion(noReads, kid, "Help me plan my budget with Private Child, Secret Name, saverfriend, Mama and Sibling.", {}, now, { asker: "child", knownNames: ["Mama", "Sibling"] });
  assert(plan.question.startsWith("Help me plan a budget using these figures;"));assert(plan.question.includes('Child asks: "'));
  for (const name of [kid.name, kid.comfort_name, kid.username, "Mama", "Sibling"]) assert(!plan.question.includes(name));
  assert(plan.question.includes("[name]"));assertEquals(Object.keys(plan.audit), ["intent", "fields"]);
  assert(!JSON.stringify(plan.audit).includes("Child asks"));
});
Deno.test("penny-cleaned: too little text stays local, alongside existing safety and email replies", async () => {
  for (const message of ["Private Child", pin, `${reference} save`, "[name] [removed]"]) {
    const plan = await minimizePennyQuestion(noReads, { name: "Private Child" }, message, {}, now);
    assertEquals(plan.localReply, "Ask again without names or numbers.");assertEquals(plan.question, "");
  }
  for (const message of [`My PIN is ${pin}`, "My name is Private Child", "Email sample@example.invalid about saving", "Summarise my spending last month"]) {
    const plan = await minimizePennyQuestion(noReads, {}, message, {}, now);
    assert(Boolean(plan.localReply));assertEquals(plan.question, "");
  }
});
Deno.test("penny-cleaned: Malay direction reads the original question after cleaning", async () => {
  const plan = await minimizePennyQuestion(noReads, { name: "Amir" }, "Bagaimana saya boleh simpan RM10 bersama Amir?", {}, now);
  assert(plan.question.includes("[name]"));assert(!plan.question.includes("Amir"));assert(plan.question.endsWith(" Reply in Malay."));
});
Deno.test("penny-cleaned: outgoing payload keeps the question and amount but no known name or private reference", async () => {
  const fullName = "Farah Aman";const phone = "+60 " + "9".repeat(9);const ic = ["9".repeat(6), "99", "9".repeat(4)].join("-");
  const message = `How can ${fullName} save RM12345.67 using references ${phone}, ${ic}, ${pin} and ${reference}?`;
  const plan = await minimizePennyQuestion(noReads, {}, message, {}, now, { asker: "child", knownNames: [fullName] });
  assert(!plan.localReply);
  const request = buildPennyRequest({ message: plan.question, systemPrompt: kidSystemPrompt("6-9"), previousIntent: "education" });
  const payload = JSON.stringify(request);
  for (const privateValue of [fullName, "Farah", "Aman", phone, ic, pin, reference]) assert(!payload.includes(privateValue), "A removed value crossed the boundary");
  assert(payload.includes("RM12345.67") && payload.includes("How can") && payload.includes("[removed]"));
  assertEquals(request.messages[0].content, plan.question);assertEquals(request.messages.length, 1);assert(request.system.includes("very simple words"));
});

function familyAdmin(failure?: "family" | "parent" | "throw") {
  const calls: string[] = [];let authCalls = 0;
  const admin = {
    from(table: string) { calls.push(table);return { select(columns: string) { calls.push(columns);return { eq(key: string, id: string) {
      calls.push(key, id);return Promise.resolve({ data: [{ name: "Sibling", username: "siblinguser", comfort_name: "Buddy" }], error: failure === "family" ? { message: "fixture" } : null });
    } }; } }; },
    auth: { admin: { getUserById(id: string) { calls.push("parent", id);authCalls++;
      if (failure === "throw") return Promise.reject(new Error("fixture"));
      return Promise.resolve({ data: { user: { user_metadata: { full_name: "Parent Full", name: "Parent", comfort_name: "Mama" } } }, error: failure === "parent" ? { message: "fixture" } : null });
    } } },
  };
  return { admin: admin as any, calls, authCalls: () => authCalls };
}
Deno.test("penny-cleaned: family lookup reads only names, usernames and comfort names for one parent", async () => {
  const fixture = familyAdmin();const names = await getPennyKnownNames(fixture.admin, "fixture-parent");
  assertEquals(names, ["Sibling", "siblinguser", "Buddy", "Parent Full", "Parent", "Mama"]);
  assertEquals(fixture.calls, ["kids", "name, username, comfort_name", "parent_id", "fixture-parent", "parent", "fixture-parent"]);
});
Deno.test("penny-cleaned: parent uses the signed-in metadata without another auth lookup", async () => {
  const fixture = familyAdmin();const names = await getPennyKnownNames(fixture.admin, "fixture-parent", { user_metadata: { full_name: "Other Parent", comfort_name: "Papa" } });
  assertEquals(names, ["Sibling", "siblinguser", "Buddy", "Other Parent", "Papa"]);assertEquals(fixture.authCalls(), 0);
});
Deno.test("penny-cleaned: family lookup errors fail closed with the generic context error", async () => {
  for (const failure of ["family", "parent", "throw"] as const) {
    await assertRejects(() => getPennyKnownNames(familyAdmin(failure).admin, "fixture-parent"), Error, "Penny context unavailable");
  }
});
Deno.test("penny-cleaned: handler wiring sends age only through the system prompt and identifies the asker", async () => {
  const child = await Deno.readTextFile(new URL("../kid-finance/index.ts", import.meta.url));
  const parent = await Deno.readTextFile(new URL("../parent-finance/index.ts", import.meta.url));
  assert(child.includes('getPennyKnownNames(admin, kid.parent_id)'));
  assert(child.includes('admin.rpc("kid_age_group", { p_kid_id: kid.id })'));
  assert(child.includes('kidSystemPrompt(ageGroup || "10-12")'));
  assert(parent.includes('getPennyKnownNames(admin, parentId, user)'));
  assert(parent.includes('asker: "parent", knownNames'));
});
