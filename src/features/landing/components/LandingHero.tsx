import { Link } from "@tanstack/react-router";

export function LandingHero() {
  return (
    <div className="landing-hero-scene">
      <img
        className="landing-hero-background"
        src="/images/bicycle-park.webp"
        alt=""
        fetchPriority="high"
        width={1774}
        height={887}
      />
      <section
        className="landing-hero landing-wrap"
        aria-labelledby="landing-title"
      >
        <div className="landing-hero-copy">
          <p className="landing-kicker">Money lessons for the whole family</p>
          <h1 id="landing-title">
            Small savings.
            <br />
            Big life lessons.
          </h1>
          <p className="landing-lead">
            The first bicycle. A gift for someone else. A little set aside each
            week. Help your child learn to save, borrow, and give with Islamic
            values at the heart.
          </p>
          <div className="landing-actions">
            <Link to="/login" className="landing-button">
              Parent sign in
            </Link>
            <Link to="/kid-login" className="landing-text-link">
              Young saver sign in
            </Link>
          </div>
          <p className="landing-hero-note">
            Their own goals. Your guidance. One family app.
          </p>
        </div>
        <figure className="landing-goal">
          <div className="landing-goal-heading">
            <span>Aiman’s tabung</span>
            <span className="landing-goal-tag">Saving for a bicycle</span>
          </div>
          <div className="landing-goal-total">
            <strong>
              RM261<span> / RM300</span>
            </strong>
            <span>87% saved</span>
          </div>
          <div
            className="landing-goal-track"
            role="progressbar"
            aria-label="Bicycle savings goal"
            aria-valuenow={87}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span />
          </div>
          <div className="landing-goal-bottom">
            <span>Just RM39 to go.</span>
            <span>A little closer, every deposit.</span>
          </div>
          <figcaption>Illustrative goal and amounts</figcaption>
        </figure>
      </section>
    </div>
  );
}
