import type { AppLanguage } from "@/lib/theme";

export type GlossaryKey =
  | "hibah"
  | "qard_hasan"
  | "sadaqah"
  | "zakat"
  | "tabung"
  | "riba"
  | "amanah";

export interface GlossaryEntry {
  key: GlossaryKey;
  term: string;
  en: string;
  ms: string;
}

export const GLOSSARY_TERMS: Record<GlossaryKey, GlossaryEntry> = {
  hibah: {
    key: "hibah",
    term: "Hibah",
    en: "A gift given willingly without expecting anything back, like weekly pocket money.",
    ms: "Pemberian ikhlas tanpa mengharapkan balasan, seperti duit poket mingguan.",
  },
  qard_hasan: {
    key: "qard_hasan",
    term: "Qard Hasan",
    en: "An interest-free loan where you return only the exact amount you borrowed.",
    ms: "Pinjaman tanpa faedah di mana kamu hanya memulangkan jumlah yang dipinjam.",
  },
  sadaqah: {
    key: "sadaqah",
    term: "Sadaqah",
    en: "Voluntary charity given to help others and share kindness.",
    ms: "Sedekah sukarela untuk membantu orang lain dan berkongsi kebaikan.",
  },
  zakat: {
    key: "zakat",
    term: "Zakat",
    en: "An annual share of savings (2.5% above nisab) set aside to support those in need.",
    ms: "Bahagian tahunan daripada simpanan (2.5% melebihi nisab) untuk membantu golongan memerlukan.",
  },
  tabung: {
    key: "tabung",
    term: "Tabung",
    en: "A dedicated savings pot for a goal you are working towards.",
    ms: "Tabung simpanan khas untuk matlamat yang sedang kamu usahakan.",
  },
  riba: {
    key: "riba",
    term: "Riba",
    en: "Extra money charged on a loan or guaranteed as interest, which Islam forbids.",
    ms: "Bayaran tambahan atau faedah atas pinjaman yang dilarang dalam Islam.",
  },
  amanah: {
    key: "amanah",
    term: "Amanah",
    en: "Trustworthiness and keeping your promise with money and responsibilities.",
    ms: "Sifat amanah dan menunaikan janji dalam mengurus wang dan tanggungjawab.",
  },
};

export interface KidCopySet {
  home: string;
  wallet: string;
  goals: string;
  more: string;
  missions: string;
  sadaqah: string;
  send: string;
  askForMoney: string;
  loans: string;
  outstandingBorrowing: string;
  history: string;
  insights: string;
  notifications: string;
  myBalance: string;
  saveForGoal: string;
  tapSpeakerHint: string;
  spendLabel: string;
  tabungLabel: string;
  pennyIdle: string;
  pennyMoneyIn: string;
  pennyGoalReached: string;
  pennyThinking: string;
  pennyDeclined: string;
  pennyStreakAtRisk: string;
  choresTitle: string;
  markDone: string;
  waitingParent: string;
  approved: string;
  declined: string;
  open: string;
  agesPrefix: string;
  toSpend: string;
  daySingular: string;
  dayPlural: string;
  streakLabel: string;
  sadaqahHeroLabel: string;
  giveAnytime: string;
  sadaqahBannerTitle: string;
  sadaqahBannerBody: string;
}

const EN_COPY: KidCopySet = {
  home: "Home",
  wallet: "Wallet",
  goals: "Tabung",
  more: "More",
  missions: "Missions",
  sadaqah: "Sadaqah",
  send: "Send",
  askForMoney: "Ask for money",
  loans: "Loans",
  outstandingBorrowing: "Outstanding borrowing",
  history: "History",
  insights: "Insights",
  notifications: "Notifications",
  myBalance: "My balance",
  saveForGoal: "Save for a goal",
  tapSpeakerHint: "Tap the speaker on any card to hear it read aloud.",
  spendLabel: "Spend",
  tabungLabel: "Tabung",
  pennyIdle: "Ready when you are.",
  pennyMoneyIn: "Money arrived! Nice steady progress.",
  pennyGoalReached: "Goal reached! You watered your sprout to full bloom.",
  pennyThinking: "Thinking carefully...",
  pennyDeclined: "Not approved this time. You can try again later.",
  pennyStreakAtRisk: "Evening check-in: keep your streak alive today.",
  choresTitle: "Chores",
  markDone: "Mark done",
  waitingParent: "Waiting for parent",
  approved: "Approved",
  declined: "Not approved",
  open: "To do",
  agesPrefix: "Ages",
  toSpend: "to spend",
  daySingular: "day",
  dayPlural: "days",
  streakLabel: "Streak",
  sadaqahHeroLabel: "Pledged this year",
  giveAnytime: "Give anytime",
  sadaqahBannerTitle: "Make a practice Sadaqah pledge from RM1",
  sadaqahBannerBody: "This is practice money. The cause receives a donation only if your parent passes it on.",
};

const MS_COPY: KidCopySet = {
  home: "Utama",
  wallet: "Dompet",
  goals: "Tabung",
  more: "Lagi",
  missions: "Misi",
  sadaqah: "Sadaqah",
  send: "Hantar",
  askForMoney: "Minta duit",
  loans: "Pinjaman",
  outstandingBorrowing: "Pinjaman belum selesai",
  history: "Sejarah",
  insights: "Ringkasan",
  notifications: "Pemberitahuan",
  myBalance: "Baki saya",
  saveForGoal: "Simpan untuk matlamat",
  tapSpeakerHint: "Tekan ikon pembesar suara untuk mendengar bacaan.",
  spendLabel: "Belanja",
  tabungLabel: "Tabung",
  pennyIdle: "Sedia bila-bila masa.",
  pennyMoneyIn: "Duit masuk! Teruskan usaha yang baik.",
  pennyGoalReached: "Matlamat tercapai! Tunas kamu sudah berkembang.",
  pennyThinking: "Sedang berfikir...",
  pennyDeclined: "Belum diluluskan kali ini. Cuba lagi nanti.",
  pennyStreakAtRisk: "Peringatan petang: kekalkan rentetan hari ini.",
  choresTitle: "Tugas rumah",
  markDone: "Tandakan siap",
  waitingParent: "Menunggu ibu bapa",
  approved: "Diluluskan",
  declined: "Tidak diluluskan",
  open: "Perlu dibuat",
  agesPrefix: "Umur",
  toSpend: "untuk belanja",
  daySingular: "hari",
  dayPlural: "hari",
  streakLabel: "Rentetan",
  sadaqahHeroLabel: "Janji derma tahun ini",
  giveAnytime: "Beri bila-bila masa",
  sadaqahBannerTitle: "Buat janji Sadaqah latihan dari RM1",
  sadaqahBannerBody: "Ini duit latihan. Badan amal hanya menerima sumbangan jika ibu bapa meneruskannya.",
};

export function getKidCopy(
  lang: AppLanguage,
  ageGroup?: "6-9" | "10-12" | "13-17" | string,
): KidCopySet {
  const base = lang === "ms" ? MS_COPY : EN_COPY;
  if (ageGroup === "6-9") {
    return {
      ...base,
      outstandingBorrowing: lang === "ms" ? "Duit yang saya pinjam" : "Money I owe",
      insights: lang === "ms" ? "Cerita saya" : "My summary",
    };
  }
  return base;
}
