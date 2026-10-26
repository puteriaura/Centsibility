import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/ui/app-icon";

export function LandingDualMode() {
  return (
    <section
      id="views"
      className="landing-section landing-wrap"
      aria-labelledby="family-title"
    >
      <div className="landing-section-intro">
        <span className="landing-kicker">For the whole family</span>
        <h2 id="family-title">They save. You stay in the loop.</h2>
      </div>
      <div className="landing-family-views">
        <article className="landing-family-view">
          <span className="landing-view-label">For young savers</span>
          <h3>"I'm saving for this."</h3>
          <ul>
            {[
              "Goals, streaks and reward points",
              "A practice card with its own daily limit",
              "Penny, for when they're stuck",
            ].map((text) => (
              <li key={text}>
                <AppIcon name="check" size={20} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <Link className="landing-link" to="/kid-login">
            Young saver sign in
            <AppIcon name="chevron" size={18} />
          </Link>
        </article>
        <article className="landing-family-view">
          <span className="landing-view-label">For parents</span>
          <h3>"I'm here to help."</h3>
          <ul>
            {[
              "Send pocket money and Hibah gifts",
              "Approve withdrawals, loans and rewards",
              "See each child's spending, month by month",
              "Lock the app with a PIN on shared phones",
            ].map((text) => (
              <li key={text}>
                <AppIcon name="check" size={20} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <Link className="landing-link" to="/login">
            Parent sign in
            <AppIcon name="chevron" size={18} />
          </Link>
        </article>
      </div>
    </section>
  );
}
