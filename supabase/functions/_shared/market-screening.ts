// Additional dated evidence reviewed 9 October 2026; public provider reference coverage verified.
export const SELECTED_STOCK_ADDITIONS = [
  { symbol: "SNDK", name: "Sandisk Corp." }, { symbol: "IBM", name: "International Business Machines Corporation" },
  { symbol: "ORCL", name: "Oracle Corporation" }, { symbol: "LIN", name: "Linde plc" },
  { symbol: "QCOM", name: "QUALCOMM Incorporated" }, { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "TXN", name: "Texas Instruments Inc." }, { symbol: "ISRG", name: "Intuitive Surgical Inc." },
];
// Evidence reviewed 8 October 2026. Holdings are evidence, not a permanent certification.
export const VERIFIED_STOCK_ADDITIONS = [
  { symbol: "AVGO", name: "Broadcom Inc." }, { symbol: "MU", name: "Micron Technology Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices Inc." }, { symbol: "LLY", name: "Eli Lilly and Company" },
  { symbol: "XOM", name: "Exxon Mobil Corporation" }, { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "ABBV", name: "AbbVie Inc." }, { symbol: "CSCO", name: "Cisco Systems Inc." },
  { symbol: "AMAT", name: "Applied Materials Inc." }, { symbol: "LRCX", name: "Lam Research Corporation" },
  { symbol: "MRK", name: "Merck & Co. Inc." }, { symbol: "PG", name: "Procter & Gamble Company" },
  { symbol: "PANW", name: "Palo Alto Networks Inc." }, { symbol: "HD", name: "The Home Depot Inc." },
  { symbol: "CRWD", name: "CrowdStrike Holdings Inc." },
  ...SELECTED_STOCK_ADDITIONS,
];
export const SCREENING: Record<string, { source: string; url: string; checked: string }> = {
  HLAL: { source: "Wahed HLAL: FTSE Shariah USA Index, screened by Yasaar", url: "https://www.wahed.com/hlal", checked: "2026-10-08" },
  UMMA: { source: "Wahed UMMA fund Shariah documentation", url: "https://www.wahed.com/umma", checked: "2026-10-08" },
  ...Object.fromEntries(["SPUS", "SPWO", "SPTE", "SPRE", "SPSK"].map(symbol => [symbol, { source: `SP Funds ${symbol} official Shariah fund documentation`, url: `https://www.sp-funds.com/${symbol.toLowerCase()}/`, checked: "2026-10-08" }])),
  ...Object.fromEntries(["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", ...VERIFIED_STOCK_ADDITIONS.map(s => s.symbol)].map(symbol => [symbol, { source: `${symbol} included in SPUS holdings dated 7 October 2026; holdings can change`, url: "https://www.sp-funds.com/SPUS/", checked: "2026-10-07" }])),
  ...Object.fromEntries(SELECTED_STOCK_ADDITIONS.map(({ symbol }) => [symbol, { source: `${symbol} included in SPUS holdings dated 9 October 2026; holdings can change`, url: "https://www.sp-funds.com/spus/", checked: "2026-10-09" }])),
};
