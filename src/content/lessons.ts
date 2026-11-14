export const SADAQAH_HADITH = {
  text: "Charity extinguishes sins just as water extinguishes fire.",
  source: "Jamiʿ at-Tirmidhi 2616",
} as const;

export const DAILY_LESSONS = [
  { text: "Allah destroys interest and gives increase for charity.", source: "Qur’an 2:276" },
  { text: "Eat and drink, but be not excessive.", source: "Qur’an 7:31" },
  { text: "And give full measure and weight in justice.", source: "Qur’an 6:152" },
  SADAQAH_HADITH,
] as const;
