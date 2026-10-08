import { assertEquals, assertNotEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  MAX_MESSAGE_CHARS,
  MAX_HISTORY_TURNS,
  resolveModel,
  clampMaxTokens,
  buildPennyRequest,
  extractReplyText,
  kidSystemPrompt,
  parentSystemPrompt,
  sanitizePennyReply,
  buildKidCoachContext,
  buildParentCoachContext,
  validateBirthdayUpdate,
  formatPageContext,
  typeLabel,
} from "./penny-ai.ts";

Deno.test("penny-ai: server model defaults and conservative limits", () => {
  assertEquals(resolveModel(), "deepseek-flash");
  assertEquals(resolveModel("deepseek-v4-pro"), "deepseek-v4-pro");
  assertThrows(() => resolveModel("other-provider"));
  assertEquals(clampMaxTokens(), 1024);
  assertEquals(clampMaxTokens(500_000), 8192);
});
Deno.test("penny-ai: only canonical intent, never raw history", () => {
  const request = buildPennyRequest({message:"Explain saving.", previousIntent:"budget", history:[{role:"user",content:"Secret child RM999"}]});
  assertEquals(request.messages.length, 1);
  assertEquals(request.messages[0].content, "Explain saving.");
  assertEquals(request.system.includes("Previous turn intent: budget."), true);
  assertEquals(JSON.stringify(request).includes("Secret child"), false);
  assertEquals((request as any).thinking, undefined);
});

Deno.test("penny-ai: buildPennyRequest rejects messages exceeding char limit", () => {
  const tooLong = "a".repeat(MAX_MESSAGE_CHARS + 1);
  assertThrows(() =>
    buildPennyRequest({
      message: tooLong,
    })
  );

  const historyWithTooLong = [{ role: "user" as const, content: tooLong }];
  assertEquals(buildPennyRequest({message: "Valid message", history: historyWithTooLong}).messages.length, 1);
});

Deno.test("penny-ai: extractReplyText extracts only text blocks and skips thinking blocks", () => {
  const mockResponse = {
    content: [
      {
        type: "thinking",
        text: "Let me think about how to explain sadaqah to a child...",
      },
      {
        type: "text",
        text: "Assalamu Alaikum! Sadaqah is giving charity from your heart.",
      },
      {
        type: "thinking",
        text: "Checking if I should add more...",
      },
      {
        type: "text",
        text: " Even a warm smile is considered Sadaqah in Islam!",
      },
    ],
  };

  const text = extractReplyText(mockResponse);
  assertEquals(
    text,
    "Assalamu Alaikum! Sadaqah is giving charity from your heart. Even a warm smile is considered Sadaqah in Islam!"
  );

  assertEquals(extractReplyText({ content: [] }), "");
  assertEquals(extractReplyText({} as any), "");
});

// ---------------------------------------------------------------------------
// T27 Tests
// ---------------------------------------------------------------------------

Deno.test("T27 Prompts: kidSystemPrompt differ in tone line and share grounding line", () => {
  const p69 = kidSystemPrompt("6-9");
  const p1317 = kidSystemPrompt("13-17");

  // Differ in tone
  assertNotEquals(p69, p1317);
  assertEquals(p69.includes("very simple words"), true);
  assertEquals(p1317.includes("respectful, clear teen-friendly language"), true);

  // Share grounding line
  const grounding = 'Grounding: use only numbers and names from "Child\'s data".';
  assertEquals(p69.includes(grounding), true);
  assertEquals(p1317.includes(grounding), true);
});

Deno.test("T27 Prompts: parentSystemPrompt contains the no rulings rule", () => {
  const pPrompt = parentSystemPrompt();
  assertEquals(pPrompt.includes("no investment, legal or religious rulings"), true);
});

Deno.test("T27 Sanitizer: sanitizePennyReply removes filler, dashes, and snake_case tokens", () => {
  // Test case 1 from spec
  const res1 = sanitizePennyReply("Got it! You saved RM5 — nice");
  assertEquals(res1, "You saved RM5, nice");

  // Test case 2 from spec
  const res2 = sanitizePennyReply("Your GOAL_IN is up");
  assertEquals(res2.includes("Tabung deposit"), true);
  assertEquals(res2.includes("_"), false);
});

Deno.test("T27 Context: buildKidCoachContext boundaries, missing data, and privacy", () => {
  // 1. Malaysia time week boundary: Sunday 23:30 MYT row counts in that week
  // Sunday 2026-09-27 23:30 MYT is 2026-09-27T15:30:00Z.
  // When tested on Sunday 2026-09-27 23:45 MYT (2026-09-27T15:45:00Z), it counts in "this week"
  const nowSun = new Date("2026-09-27T15:45:00Z");
  const ctxSun = buildKidCoachContext({
    ageGroup: "10-12",
    name: "Aiman",
    balance: 50,
    transactions: [
      {
        type: "WITHDRAWAL",
        amount: 15,
        label: "Snack",
        created_at: "2026-09-27T15:30:00Z",
      },
    ],
    now: nowSun,
  });
  assertEquals(ctxSun.some((l) => l.includes("This week: spent RM15.00")), true);

  // 2. Missing data gives "not available yet"
  const emptyCtx = buildKidCoachContext({});
  assertEquals(emptyCtx.some((l) => l.includes("Age group: not available yet")), true);
  assertEquals(emptyCtx.some((l) => l.includes("Tabung: not available yet")), true);
  assertEquals(emptyCtx.some((l) => l.includes("Next quest: not available yet")), true);

  // 3. Transfer rows never include their label (privacy)
  const transferCtx = buildKidCoachContext({
    ageGroup: "10-12",
    transactions: [
      {
        type: "TRANSFER_OUT",
        amount: 8,
        label: "Duit to Secret Family Member Uncle Bob",
        created_at: "2026-09-27T10:00:00Z",
      },
    ],
    now: nowSun,
  });
  assertEquals(transferCtx.some((l) => l.includes("Uncle Bob")), false);
  assertEquals(transferCtx.some((l) => l.includes("Secret Family Member")), false);

  // 4. No underscore anywhere in output
  for (const line of transferCtx) {
    assertEquals(line.includes("_"), false);
  }
  for (const line of emptyCtx) {
    assertEquals(line.includes("_"), false);
  }
});

Deno.test("T27 Context: buildParentCoachContext uses comfort names and hides real name", () => {
  const ctx = buildParentCoachContext({
    parentComfortName: "Mama",
    kids: [
      {
        comfortName: "Aiman",
        ageGroup: "10-12",
        spending: 142.5,
        tabung: 50,
        growth: 20,
        spentThisWeek: 15,
        spentLastWeek: 10,
        topCategoryThisWeek: "Food & beverage",
        savedThisWeek: 10,
        sadaqahThisMonth: 5,
        questsCompleted: 2,
        activeLoanCount: 1,
        overdueLoanCount: 0,
        pendingRequestsCount: 1,
      },
      {
        comfortName: null, // Should display as Child 2
        ageGroup: "6-9",
        spending: 30,
        tabung: 10,
        growth: 0,
        spentThisWeek: 5,
        spentLastWeek: 0,
        topCategoryThisWeek: null,
        savedThisWeek: 5,
        sadaqahThisMonth: 0,
        questsCompleted: 0,
        activeLoanCount: 0,
        overdueLoanCount: 0,
        pendingRequestsCount: 0,
      },
    ],
  });

  assertEquals(ctx.some((l) => l.includes("--- Aiman ---")), true);
  assertEquals(ctx.some((l) => l.includes("--- Child 2 ---")), true);
  assertEquals(ctx.some((l) => l.includes("Mama")), true);

  // Kid's real name never appears
  assertEquals(ctx.some((l) => l.includes("Muhammad Al-Aiman")), false);

  // No underscore anywhere
  for (const line of ctx) {
    assertEquals(line.includes("_"), false);
  }
});

Deno.test("T29 Penny Context: buildKidCoachContext includes Name: <comfort_name> as first line", () => {
  const withName = buildKidCoachContext({
    name: "Aliff",
    ageGroup: "10-12",
  });
  assertEquals(withName[0], "Name: Aliff");

  const withoutName = buildKidCoachContext({
    ageGroup: "10-12",
  });
  assertEquals(withoutName[0].startsWith("Name:"), false);
  assertEquals(withoutName[0], "Age group: 10-12");
});

Deno.test("T29 Profile: validateBirthdayUpdate allows same value, refuses different value when already set", () => {
  const existing = { birth_date: "2015-06-15", birth_year: 2015 };

  // Resending same value is allowed and generates no updates
  const same = validateBirthdayUpdate(existing, { birth_date: "2015-06-15", birth_year: "2015" });
  assertEquals(same.allowed, true);
  assertEquals(Object.keys(same.updates ?? {}).length, 0);

  // Sending different date is refused
  const diffDate = validateBirthdayUpdate(existing, { birth_date: "2014-01-01" });
  assertEquals(diffDate.allowed, false);
  assertEquals(diffDate.error, "Your birthday is already set. Ask your parent to change it.");

  // Sending different year is refused
  const diffYear = validateBirthdayUpdate(existing, { birth_year: 2014 });
  assertEquals(diffYear.allowed, false);
  assertEquals(diffYear.error, "Your birthday is already set. Ask your parent to change it.");

  // Setting birthday for the first time works
  const unset = { birth_date: null, birth_year: null };
  const firstSet = validateBirthdayUpdate(unset, { birth_date: "2015-06-15" }, new Date("2026-10-01"));
  assertEquals(firstSet.allowed, true);
  assertEquals(firstSet.updates?.birth_date, "2015-06-15");
  assertEquals(firstSet.updates?.birth_year, 2015);
});

Deno.test("T34: kidSystemPrompt includes quest hint rule", () => {
  const prompt = kidSystemPrompt("10-12");
  assertEquals(
    prompt.includes("If the child is in the middle of a quest question they have not answered yet, give a hint, never the answer."),
    true
  );
});

Deno.test("penny-ai: page context uses verified screen only and excludes free-form detail", () => {
  assertEquals(formatPageContext({page:"Insights",detail:"Private text"}), "Current screen: Insights (/kid/insights).");
  for (const value of [null, undefined, "not-an-object", {page:123}, {page:""}, {page:"Invented screen"}]) assertEquals(formatPageContext(value), null);
  const request = buildPennyRequest({message:"Explain this screen.",context:{page:"Card",detail:"Private text"}});
  assertEquals(request.system.includes("Current screen: Card (/kid/card)."), true);
  assertEquals(request.system.includes("Private text"), false);
});
Deno.test("penny-ai: child safety configuration slot has no default", () => {
  const original = Deno.env.get;
  try {
    Deno.env.get = () => undefined;
    assertEquals(kidSystemPrompt().includes("APPROVED_TEST_POLICY"), false);
    Deno.env.get = key => key === "PENNY_CHILD_SAFETY_SYSTEM_PROMPT" ? "APPROVED_TEST_POLICY" : undefined;
    assertEquals(kidSystemPrompt().includes("APPROVED_TEST_POLICY"), true);
    assertEquals(parentSystemPrompt().includes("APPROVED_TEST_POLICY"), false);
  } finally { Deno.env.get = original; }
});

Deno.test("T35: typeLabel maps investment transaction types", () => {
  assertEquals(typeLabel("INVEST_IN"), "Moved to Investment");
  assertEquals(typeLabel("INVEST_OUT"), "Back from Investment");
  assertEquals(typeLabel("INVEST_GAIN"), "Investment profit");
  assertEquals(typeLabel("INVEST_LOSS"), "Investment loss");
});

Deno.test("T39: kidSystemPrompt includes Centsibility Funds up-and-down rule and removes Growth Tabung", () => {
  const prompt = kidSystemPrompt("10-12");
  assertEquals(prompt.includes("Centsibility Funds move up and down at random each update, like a real market; nobody can predict them"), true);
  assertEquals(prompt.includes("Growth Tabung"), false);
});

Deno.test("T35: buildKidCoachContext and buildParentCoachContext list open investments and use Investment balance", () => {
  const kidCtx = buildKidCoachContext({
    ageGroup: "10-12",
    name: "Aiman",
    balance: 20,
    investmentsValue: 15,
    investments: [
      {
        mode: "fund",
        tier: "Low",
        principal: 10,
        currentValue: 10.42,
        profitPct: 4.2,
        endsAt: "2026-10-08T15:15:00Z",
      },
    ],
  });
  assertEquals(kidCtx.some((l) => l.includes("Investment: RM15.00")), true);
  assertEquals(kidCtx.some((l) => l.includes("Growth Tabung")), false);
  assertEquals(kidCtx.some((l) => l.includes("Investment Centsibility Fund (Low): put in RM10.00, value now RM10.42 (+4.20%)")), true);

  const parentCtx = buildParentCoachContext({
    parentComfortName: "Ayah",
    kids: [
      {
        comfortName: "Aiman",
        ageGroup: "10-12",
        spending: 20,
        tabung: 5,
        investments: 15,
        investmentsList: [
          {
            mode: "fund",
            tier: "Low",
            principal: 10,
            currentValue: 10.42,
            profitPct: 4.2,
            endsAt: "2026-10-08T15:15:00Z",
          },
        ],
        spentThisWeek: 0,
        spentLastWeek: 0,
        savedThisWeek: 0,
        sadaqahThisMonth: 0,
        questsCompleted: 0,
        activeLoanCount: 0,
        overdueLoanCount: 0,
        pendingRequestsCount: 0,
      },
    ],
  });
  assertEquals(parentCtx.some((l) => l.includes("Investment: RM15.00")), true);
  assertEquals(parentCtx.some((l) => l.includes("Growth Tabung")), false);
  assertEquals(parentCtx.some((l) => l.includes("Investment Centsibility Fund (Low): put in RM10.00, value now RM10.42 (+4.20%)")), true);
});

Deno.test("T36: kidSystemPrompt includes Market Tracker rule", () => {
  const prompt = kidSystemPrompt();
  assertEquals(prompt.includes("Market Tracker follows real prices. Explain price moves in simple words. Never give buy or sell advice, never predict prices, never say an investment is a good or bad choice."), true);
});


