import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";
import { Money, usePrivacy } from "@/features/privacy";
import { buildWeeklyDigest, type WeeklyDigestApproval, type WeeklyDigestKid, type WeeklyDigestTx } from "@/lib/weekly-digest";
import { useTheme } from "@/lib/theme";

interface WeeklyDigestCardProps {
  kids: WeeklyDigestKid[];
  txs: WeeklyDigestTx[];
  approvals: WeeklyDigestApproval[];
}

export function WeeklyDigestCard({ kids, txs, approvals }: WeeklyDigestCardProps) {
  const { locked } = usePrivacy();
  const { lang } = useTheme();
  const isBm = lang === "ms";

  const digest = useMemo(
    () => buildWeeklyDigest(kids, txs, approvals),
    [kids, txs, approvals],
  );

  return (
    <Card variant="default" className="m-0 p-4 space-y-3" aria-label={isBm ? "Ringkasan mingguan" : "Weekly digest"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--action-tint)] text-[var(--action)]">
            <AppIcon name="reports" size={16} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-sm font-bold text-[var(--ink)] truncate">
              {isBm ? "Ringkasan mingguan" : "Weekly digest"}
            </p>
            <p className="m-0 text-[11px] text-[var(--text-muted)]">
              {isBm ? "7 hari lepas" : "Last 7 days"}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-[var(--text-2)]">
          {digest.txCount} {isBm ? "aktiviti" : digest.txCount === 1 ? "activity" : "activities"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl bg-[var(--canvas)] p-2.5">
          <p className="m-0 text-[11px] text-[var(--text-muted)]">
            {isBm ? "Disimpan" : "Saved"}
          </p>
          <p className="m-0 mt-0.5 text-sm font-bold text-[var(--ink)] tabular-nums">
            {locked ? "•••" : <Money amount={digest.savedAmount} />}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--canvas)] p-2.5">
          <p className="m-0 text-[11px] text-[var(--text-muted)]">
            {isBm ? "Disedekahkan" : "Given"}
          </p>
          <p className="m-0 mt-0.5 text-sm font-bold text-[var(--ink)] tabular-nums">
            {locked ? "•••" : <Money amount={digest.givenAmount} />}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--canvas)] p-2.5">
          <p className="m-0 text-[11px] text-[var(--text-muted)]">
            {isBm ? "Menunggu" : "Requests"}
          </p>
          <p className="m-0 mt-0.5 text-sm font-bold text-[var(--ink)] tabular-nums">
            {digest.pendingRequests}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--canvas)] p-2.5">
          <p className="m-0 text-[11px] text-[var(--text-muted)]">
            {isBm ? "Rentetan terbaik" : "Top streak"}
          </p>
          <p className="m-0 mt-0.5 text-sm font-bold text-[var(--ink)] tabular-nums truncate">
            {digest.topStreak > 0 ? `${digest.topStreak}d` : (isBm ? "Tiada" : "None")}
          </p>
        </div>
      </div>

      <p className="m-0 rounded-xl bg-[var(--action-tint)] px-3 py-2 text-xs text-[var(--ink)] leading-relaxed">
        <strong>{isBm ? "Topik perbualan: " : "Talking point: "}</strong>
        {isBm ? digest.talkingPointMs : digest.talkingPointEn}
      </p>
    </Card>
  );
}
