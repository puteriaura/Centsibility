import { AppIcon } from "@/components/ui/app-icon";
const features = {
  transfer: "transfer",
  request: "plus",
  tabung: "save",
  more: "more",
  investment: "trend",
  sadaqah: "sadaqah",
  missions: "missions",
  history: "history",
  insights: "reports",
} as const;
export function FeatureIcon({
  feature,
  size = 24,
}: {
  feature: keyof typeof features;
  size?: number;
}) {
  return (
    <AppIcon
      name={features[feature]}
      size={size}
      strokeWidth={1.75}
      color="var(--action-text)"
    />
  );
}
