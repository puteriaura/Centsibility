import { createFileRoute } from "@tanstack/react-router";
import {
  LandingNav,
  LandingHero,
  LandingTrustStrip,
  LandingFeatures,
  LandingDualMode,
  LandingShowcase,
  LandingShariahPillars,
  LandingCTA,
  LandingFooter,
} from "@/features/landing/components";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div>
      <LandingNav />
      <LandingHero />
      <LandingTrustStrip />
      <LandingFeatures />
      <LandingDualMode />
      <LandingShowcase />
      <LandingShariahPillars />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}
