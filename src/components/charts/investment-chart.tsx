/* Bklit chart primitives are MIT licensed. See LICENSE-BKLIT. */
import { useChartStable, useYScale } from "./chart-context";
import { useTheme } from "@/lib/theme";
import { useMoney } from "@/features/privacy";
import { AreaChart } from "./area-chart";
import { Area } from "./area";
import { LineChart } from "./line-chart";
import { Line } from "./line";
import { ProfitLossLine } from "./profit-loss-line";
import { ChartTooltip } from "./tooltip/chart-tooltip";

type PricePoint = { date: Date; value: number; note?: string };

function ChartAnnotation({ date, label, value }: { date: Date; label: string; value?: number }) {
  const { xScale, innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale();
  const x = xScale(date);
  if (x === undefined || x < 0 || x > innerWidth) return null;
  const y = value === undefined ? innerHeight : yScale(value);
  const anchor = x > innerWidth / 2 ? "end" : "start";
  return <g aria-hidden="true">
    <line x1={x} x2={x} y1={16} y2={y} stroke="var(--text-2)" strokeDasharray="3 3" />
    {value !== undefined && <circle cx={x} cy={y} r={4} fill="var(--chart-1)" />}
    <text x={anchor === "end" ? x - 5 : x + 5} y={12} textAnchor={anchor}
      fill="var(--ink)" fontSize={11}>{label}</text>
  </g>;
}
ChartAnnotation.__isPostOverlay = true;

export function InvestmentChart({ data, label, dollars, entry, deadline }: {
  data: PricePoint[];
  label: string;
  dollars?: boolean;
  entry?: number;
  deadline?: string | null;
}) {
  const { reduced } = useTheme();
  const { isMasked, format } = useMoney();
  const points = data.filter(({ date, value }) => Number.isFinite(+date) && Number.isFinite(value));
  if (points.length < 2) return null;
  const formatValue = (value: number) => isMasked ? "•••" : dollars ? `US$${value.toFixed(2)}` : format(value);
  const rows = points.map((point) => ({ ...point, change: point.value - (entry ?? 0), baseline: 0 }));
  const props = {
    data: rows,
    animationDuration: reduced ? 0 : 450,
    margin: { top: 8, right: 8, bottom: 8, left: 8 },
    style: { touchAction: "pan-y" as const },
  };
  const tooltip = <ChartTooltip showDatePill={false} damping={reduced ? 0 : undefined}
    content={({ point }) => <span>{point.note ? `${point.note} · ` : ""}{formatValue(Number(point.value))}</span>} />;
  const last = points[points.length - 1];
  const deadlineDate = deadline ? new Date(deadline) : null;
  const end = deadlineDate && Number.isFinite(+deadlineDate) ? deadlineDate : null;
  return (
    <figure className="m-0">
      <div role="img" aria-label={`${label}: ${formatValue(last.value)}`}>
        {entry === undefined ? <AreaChart {...props} xDomain={end && +end > +last.date ? [points[0].date, end] : undefined}>
          <Area dataKey="value" animate={!reduced} />
          {end && <ChartAnnotation date={end} label="Deadline" />}
          {tooltip}
        </AreaChart> : <LineChart {...props} yDomainTween={!reduced}>
          <Line dataKey="baseline" stroke="var(--line)" animate={false} />
          <Line dataKey="change" stroke="transparent" animate={false} />
          <ProfitLossLine dataKey="change" positiveColor="var(--chart-3)" negativeColor="var(--chart-4)" />
          <ChartAnnotation date={points[0].date} label="Bought" value={points[0].value - entry} />
          {tooltip}
        </LineChart>}
      </div>
      <figcaption className="text-sm text-[var(--text-2)]">
        {label} · {formatValue(last.value)}
        {entry !== undefined && !isMasked && <> · {last.value >= entry ? "↑ +" : "↓ −"}{formatValue(Math.abs(last.value - entry))}</>}
      </figcaption>
    </figure>
  );
}
