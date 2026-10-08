import { createFileRoute } from "@tanstack/react-router";
import "@/features/landing/landing.css";
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
    <div className="landing-page">
      <LandingNav />
      <main id="landing-main" tabIndex={-1}>
        <LandingHero />
        <LandingTrustStrip />
        <LandingFeatures />
        <LandingDualMode />
        <LandingShowcase />
        <LandingShariahPillars />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
