import { Link } from "@tanstack/react-router";

export function LandingCTA() {
  return (
    <section
      id="cta"
      className="landing-wrap landing-cta"
      aria-labelledby="cta-title"
    >
      <div>
        <p className="landing-kicker">Start with the next small step</p>
        <h2 id="cta-title">
          What are they
          <br />
          saving for?
        </h2>
        <p>Open your family’s app and make a plan together.</p>
      </div>
      <div className="landing-actions">
        <Link to="/login" className="landing-button">
          Parent sign in
        </Link>
        <Link to="/kid-login" className="landing-text-link">
          Young saver sign in
        </Link>
      </div>
    </section>
  );
}
