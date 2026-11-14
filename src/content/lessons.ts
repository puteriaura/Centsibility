export const SADAQAH_HADITH = {
  text: "Charity extinguishes sins just as water extinguishes fire.",
  source: "Jamiʿ at-Tirmidhi 2616",
} as const;

export const MUSLIM_CHARITY_HADITH = {
  text: "Charity does not decrease wealth.",
  source: "Sahih Muslim 2588",
} as const;

export const SADAQAH_PLEDGE =
  "This is practice money. Ask your parent to pass it on." as const;

export const DAILY_LESSONS = [
  { text: "Allah destroys interest and gives increase for charity.", source: "Qur’an 2:276" },
  { text: "Eat and drink, but be not excessive.", source: "Qur’an 7:31" },
  { text: "And give full measure and weight in justice.", source: "Qur’an 6:152" },
  SADAQAH_HADITH,
] as const;

export type LessonKind = "sadaqah" | "tabung" | "qard";

export interface LessonCardContent {
  kind: LessonKind;
  title: string;
  text: string;
  source: string;
  pledge?: string;
}

export const LESSON_CARDS: Record<LessonKind, LessonCardContent> = {
  sadaqah: {
    kind: "sadaqah",
    title: "Why we give",
    text: MUSLIM_CHARITY_HADITH.text,
    source: MUSLIM_CHARITY_HADITH.source,
    pledge: SADAQAH_PLEDGE,
  },
  tabung: {
    kind: "tabung",
    title: "Steady saving",
    text: "Eat and drink, but be not excessive.",
    source: "Qur’an 7:31",
  },
  qard: {
    kind: "qard",
    title: "Keeping your promise",
    text: "And give full measure and weight in justice.",
    source: "Qur’an 6:152",
  },
};
