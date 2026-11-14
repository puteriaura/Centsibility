import {
  malaysiaDay, validAmount, validAvatar, validChildBirthday, validChildName,
  validDueDays, validHibahDate, validSignature,
} from "./final-check-input.ts";

function check(condition: boolean) {
  if (!condition) throw new Error("Validation did not match the expected result");
}

Deno.test("money accepts finite, positive amounts with at most two decimals", () => {
  for (const amount of [-5, 0, 0.001, 999999999, Infinity, "5", null]) check(!validAmount(amount));
  check(validAmount(0.01));
  check(validAmount(50.29));
  check(!validAmount(0.5, 1));
});

Deno.test("dates follow Malaysia day boundaries and birthdays must be real and age 6–17", () => {
  check(malaysiaDay(new Date("2026-11-13T16:00:00Z")) === "2026-11-14");
  check(validChildBirthday("2020-11-14", "2026-11-14"));
  check(!validChildBirthday("2020-11-15", "2026-11-14"));
  check(!validChildBirthday("2008-11-14", "2026-11-14"));
  check(!validChildBirthday("2016-02-30", "2026-11-14"));
  check(validHibahDate("2026-11-14T00:00:00.000Z"));
  check(!validHibahDate("2026-02-30T00:00:00.000Z"));
});

Deno.test("child names, avatars, loan due days and signatures enforce their input contract", () => {
  check(validChildName("Nur Amina"));
  check(!validChildName("  "));
  check(validAvatar("phosphor:User"));
  check(!validAvatar("<script>"));
  check(validDueDays(14));
  check(!validDueDays("14"));
  check(!validDueDays(365));
  check(validSignature("data:image/png;base64,YQ=="));
  check(!validSignature("data:image/png;base64," + "A".repeat(250001)));
});
