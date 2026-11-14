import { StreakLevelCard } from "@/components/StreakLevelCard";
import { useTheme } from "@/lib/theme";
import { getKidCopy } from "@/lib/i18n";
import { InstallHint } from "@/components/InstallHint";
import { Skeleton } from "@/components/ui/skeleton";
import { kidLevel, levelNameFor } from "@/lib/kid-level";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { usePenny } from "@/features/penny";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import { useKidData } from "@/hooks/use-kid-data";
import { getKidSession } from "@/lib/kid-session";
import { edgeKidClaimCoins } from "@/lib/edge";
import { useMoneyAction } from "@/hooks/use-money-action";
import { isMuted, toggleMute } from "@/lib/sounds";
import { signOutKid } from "@/components/AppShell";
import { toast } from "sonner";

export const Route = createFileRoute("/kid/more")({
  head: () => ({ meta: [{ title: "More | Centsibility" }] }),
  component: KidMore,
});

const groups = [
  {
    title: "Money",
    items: [
      { to: "/kid/goals", label: "Tabung", icon: "sprout" },
      { to: "/kid/loans", label: "Qard", icon: "loan" },
      { to: "/kid/card", label: "Card", icon: "card" },
      { to: "/kid/invest", label: "Invest", icon: "trend" },
      { to: "/kid/sadaqah", label: "Sadaqah", icon: "sadaqah" },
      { to: "/kid/zakat", label: "Zakat", icon: "scale" },
    ],
  },
  {
    title: "Play and learn",
    items: [
      { to: "/kid/missions", label: "Missions", icon: "missions" },
      { to: "/kid/rewards", label: "Rewards", icon: "gift" },
    ],
  },
  {
    title: "Help and activity",
    items: [
      { to: "/kid/history", label: "History", icon: "history" },
      { to: "/kid/chat", label: "Ask Penny", icon: "chat" },
      { to: "/kid/notifications", label: "Notifications", icon: "bell" },
    ],
  },
] as const;

function KidMore() {
  const { lang } = useTheme();
  const { data, refresh } = useKidData();
  const { openPenny } = usePenny();
  const { level, progress } = kidLevel(data?.kid);
  const name = levelNameFor(level);
  const copy = getKidCopy(lang, data?.ageGroup);
  const { busy, run } = useMoneyAction();
  const [muted, setMuted] = useState(isMuted());
  const [preferences, setPreferences] = useState(false);
  const unclaimed = Math.round(Number(data?.kid.unclaimed_coins) || 0);
  const claim = () => {
    const code = getKidSession()?.code;
    if (code)
      void run(() => edgeKidClaimCoins({ code }), {
        success: "Points collected",
        refresh,
      });
  };
  return (
    <div className="settings-groups">
      <InstallHint />
      {data ? (
        <>
          <Card variant="brand" className="more-level balance-hero">
            <p>Level {level} · {name}</p><strong>{Number(data?.kid.coins) || 0} points</strong>
            {progress !== null && <><Progress value={progress} indicatorColor="var(--on-brand-card)" /><small>{100 - progress} XP to Level {level + 1}</small></>}
          </Card>
          <StreakLevelCard
            streak={Number(data.kid.streak ?? 0)}
            xp={Number(data.kid.xp ?? 0)}
            level={data.kid.level}
            hasFreeze={Number(data.questsCompleted ?? 0) > 0}
          />
          {lang === "ms" && (
            <p className="text-xs font-semibold text-[var(--text-2)]">
              {copy.tapSpeakerHint}
            </p>
          )}
        </>
      ) : <Skeleton style={{ height: 120, borderRadius: 26 }} />}
      {unclaimed > 0 && (
        <Button
          onClick={claim}
          disabled={busy}
          className="w-full justify-center"
        >
          <AppIcon name="gift" size={20} />
          Collect {unclaimed} points
        </Button>
      )}
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="settings-group-title">{group.title}</h2>
          <div className="more-grid">
            {group.items.map(item => item.to === "/kid/chat" ?
              <button key={item.to} type="button" className="more-tile" onClick={() => openPenny()}><span className="more-tile__icon"><AppIcon name={item.icon} size={24} /></span><span>{item.label}</span></button> :
              <Link key={item.to} to={item.to} className="more-tile"><span className="more-tile__icon"><AppIcon name={item.icon} size={24} /></span><span>{item.label}</span></Link>)}
          </div>
        </section>
      ))}
      <section>
        <h2 className="settings-group-title">App preferences</h2>
        <div className="settings-list">
          <button
            className="settings-list__item"
            type="button"
            onClick={() => setMuted(toggleMute())}
          >
            <span className="settings-list__icon">
              <AppIcon name={muted ? "soundoff" : "soundon"} size={24} />
            </span>
            Sounds
            <span className="settings-list__chevron">
              {muted ? "Off" : "On"}
            </span>
          </button>
          <button
            className="settings-list__item"
            type="button"
            aria-expanded={preferences}
            onClick={() => setPreferences((value) => !value)}
          >
            <span className="settings-list__icon">
              <AppIcon name="settings" size={24} />
            </span>
            Appearance
            <span className="settings-list__chevron">
              <AppIcon name="chevron" size={20} />
            </span>
          </button>
          {preferences && (
            <div className="p-4">
              <AppearanceSettings />
            </div>
          )}
        </div>
      </section>
      <Button
        variant="outline"
        className="w-full justify-center"
        onClick={async () => {
          try {
            await signOutKid();
            window.location.replace("/kid-login");
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      >
        <AppIcon name="exit" size={20} />
        Sign out
      </Button>
    </div>
  );
}
