// Evidence reviewed 8 October 2026. Holdings are evidence, not a permanent certification.
export const SCREENING: Record<string, { source: string; url: string; checked: string }> = {
  HLAL: { source: "Wahed HLAL: FTSE Shariah USA Index, screened by Yasaar", url: "https://www.wahed.com/hlal", checked: "2026-10-08" },
  UMMA: { source: "Wahed UMMA fund Shariah documentation", url: "https://www.wahed.com/umma", checked: "2026-10-08" },
  ...Object.fromEntries(["SPUS", "SPWO", "SPTE", "SPRE", "SPSK"].map(symbol => [symbol, { source: `SP Funds ${symbol} official Shariah fund documentation`, url: `https://www.sp-funds.com/${symbol.toLowerCase()}/`, checked: "2026-10-08" }])),
  ...Object.fromEntries(["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"].map(symbol => [symbol, { source: `${symbol} included in SPUS holdings dated 7 October 2026; holdings can change`, url: "https://www.sp-funds.com/SPUS/", checked: "2026-10-08" }])),
};
