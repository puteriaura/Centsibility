import { useTheme } from "@/lib/theme";
import { useMoney } from "@/features/privacy";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { Legend, LegendItem, LegendLabel, LegendMarker, LegendValue } from "./legend";

export function MoneyDonut({ label, data, showLegend = true }: {
  label: string;
  showLegend?: boolean;
  data: { label: string; value: number }[];
}) {
  const { reduced } = useTheme();
  const { isMasked, format } = useMoney();
  const slices = data.filter((item) => item.value > 0).map((item, index) => ({
    ...item, color: `var(--chart-${index % 5 + 1})`,
  }));
  if (!slices.length) return null;

  return (
    <div className="money-donut">
      <div role="img" aria-label={isMasked ? `${label}, amounts hidden` : label} className="mx-auto w-fit">
        <PieChart data={slices} size={160} innerRadius={49} padAngle={0.035}>
          {slices.map((slice, index) => <PieSlice key={slice.label} index={index} animate={!reduced} hoverEffect={reduced ? "none" : "translate"} />)}
        </PieChart>
      </div>
      {showLegend && <Legend items={slices}>
        <LegendItem className="flex items-center gap-2">
          <LegendMarker />
          <LegendLabel className="flex-1 text-[var(--ink)]" />
          <LegendValue className="text-[var(--text-2)]" formatValue={(value) => isMasked ? "•••" : format(value)} />
        </LegendItem>
      </Legend>}
    </div>
  );
}
