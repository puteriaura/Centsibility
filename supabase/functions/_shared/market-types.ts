export interface MarketUsage {
  minuteCalls: number | null;
  dailyCalls: number | null;
  minuteLimit: number;
  dailyLimit: number;
  quotaHit: boolean;
  monitoringAvailable: boolean;
}
