import { LineSparkline } from "@/components/charts/sparkline";
import { useTheme } from "@/lib/theme";
import type { InvestmentItem } from "@/lib/edge";

export default function InvestmentSparkline({ investment }: { investment: InvestmentItem }) {
  const { reduced } = useTheme();
  const data = investment.mode === "market"
    ? investment.chartPoints?.map(({ price }) => ({ value: price }))
    : investment.path?.map(({ value }) => ({ value }));
  if (!data || data.length < 2) return null;
  return <LineSparkline data={data} dataKey="value" height={28} animate={!reduced}
    interactive={false} aria-label="Investment value trend"
    color={(investment.profitRm ?? 0) < 0 ? "var(--chart-4)" : "var(--chart-3)"} />;
}
