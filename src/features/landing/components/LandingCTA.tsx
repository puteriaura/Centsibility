import { Link } from "@tanstack/react-router";
import pennyWelcome from "@/assets/penny/welcome.svg";

export function LandingCTA() {
  return (
    <section className="landing-cta landing-wrap" aria-labelledby="cta-title">
      <div className="landing-cta-box landing-brand-card">
        <div>
          <h2 id="cta-title">What are they saving for?</h2>
          <p>Sign in, then set up their first tabung together.</p>
          <div className="landing-actions">
            <Link className="landing-button landing-sun" to="/login">
              Parent sign in
            </Link>
            <Link className="landing-button landing-white" to="/kid-login">
              Young saver sign in
            </Link>
          </div>
        </div>
        <img
          className="landing-cta-penny"
          src={pennyWelcome}
          alt=""
          width={190}
          height={190}
        />
      </div>
    </section>
  );
}
