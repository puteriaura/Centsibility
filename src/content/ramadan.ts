export interface HijriSeasonWindow {
  hijriYear: string;
  ramadanStart: string;
  ramadanEnd: string;
  syawalStart: string;
  syawalEnd: string;
}

export const JAKIM_ESOLAT_SOURCE_URL = "https://www.e-solat.gov.my/";
export const JAKIM_SIGHTING_NOTE =
  "Dates follow JAKIM e-Solat (https://www.e-solat.gov.my/) and remain subject to official moon-sighting announcement.";

export const HIJRI_SEASONS_2026_2027: readonly HijriSeasonWindow[] = [
  {
    hijriYear: "1447H",
    ramadanStart: "2026-02-19",
    ramadanEnd: "2026-03-20",
    syawalStart: "2026-03-21",
    syawalEnd: "2026-03-23",
  },
  {
    hijriYear: "1448H",
    ramadanStart: "2027-02-08",
    ramadanEnd: "2027-03-09",
    syawalStart: "2027-03-10",
    syawalEnd: "2027-03-12",
  },
];

export type SeasonPreviewMode = "auto" | "ramadan" | "raya";

export function malaysiaDateIso(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayDiff(startIso: string, endIso: string): number {
  const a = new Date(startIso + "T00:00:00Z").getTime();
  const b = new Date(endIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface SeasonState {
  mode: "none" | "ramadan" | "raya";
  ramadanDay: number;
  syawalDay: number;
  hijriYear: string;
  sourceUrl: string;
  sightingNote: string;
}

export function getMalaysiaSeason(
  now: Date = new Date(),
  preview: SeasonPreviewMode = "auto",
): SeasonState {
  if (preview === "ramadan") {
    return {
      mode: "ramadan",
      ramadanDay: 12,
      syawalDay: 0,
      hijriYear: "1447H",
      sourceUrl: JAKIM_ESOLAT_SOURCE_URL,
      sightingNote: JAKIM_SIGHTING_NOTE,
    };
  }
  if (preview === "raya") {
    return {
      mode: "raya",
      ramadanDay: 30,
      syawalDay: 1,
      hijriYear: "1447H",
      sourceUrl: JAKIM_ESOLAT_SOURCE_URL,
      sightingNote: JAKIM_SIGHTING_NOTE,
    };
  }

  const today = malaysiaDateIso(now);
  for (const w of HIJRI_SEASONS_2026_2027) {
    if (today >= w.ramadanStart && today <= w.ramadanEnd) {
      return {
        mode: "ramadan",
        ramadanDay: Math.min(30, Math.max(1, dayDiff(w.ramadanStart, today) + 1)),
        syawalDay: 0,
        hijriYear: w.hijriYear,
        sourceUrl: JAKIM_ESOLAT_SOURCE_URL,
        sightingNote: JAKIM_SIGHTING_NOTE,
      };
    }
    if (today >= w.syawalStart && today <= w.syawalEnd) {
      return {
        mode: "raya",
        ramadanDay: 30,
        syawalDay: Math.min(3, Math.max(1, dayDiff(w.syawalStart, today) + 1)),
        hijriYear: w.hijriYear,
        sourceUrl: JAKIM_ESOLAT_SOURCE_URL,
        sightingNote: JAKIM_SIGHTING_NOTE,
      };
    }
  }

  return {
    mode: "none",
    ramadanDay: 0,
    syawalDay: 0,
    hijriYear: "",
    sourceUrl: JAKIM_ESOLAT_SOURCE_URL,
    sightingNote: JAKIM_SIGHTING_NOTE,
  };
}
