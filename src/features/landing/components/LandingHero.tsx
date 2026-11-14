import { Link } from "@tanstack/react-router";
import pennySaved from "@/assets/penny/saved.svg";

export function LandingHero() {
  return (
    <section
      className="landing-hero landing-wrap"
      aria-labelledby="landing-title"
    >
      <div className="landing-hero-copy">
        <span className="landing-kicker">For kids aged 6 to 17</span>
        <h1 id="landing-title">Pocket money that teaches.</h1>
        <p className="landing-lead">
          Your child saves for something they want, gives a little to others and
          borrows from family without interest. You see every step and approve
          what leaves their wallet.
        </p>
        <div className="landing-actions">
          <Link className="landing-button landing-sun" to="/login">
            Parent sign in
          </Link>
          <Link className="landing-button landing-outline" to="/kid-login">
            Young saver sign in
          </Link>
        </div>
      </div>
      <figure className="landing-photo">
        <img
          src="/images/bicycle-park.webp"
          alt="A child's blue bicycle with a yellow helmet, parked by a lake"
          width={1200}
          height={600}
          fetchPriority="high"
        />
        <div className="landing-goal">
          <div className="landing-goal-heading">
            <img src={pennySaved} alt="" width={52} height={52} />
            <div>
              <small>Aiman's tabung</small>
              <b>New bicycle</b>
            </div>
          </div>
          <div
            className="landing-track"
            role="progressbar"
            aria-label="Bicycle savings goal"
            aria-valuenow={87}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span />
          </div>
          <div className="landing-goal-values">
            <strong>RM174 of RM200</strong>
            <span>RM26 to go</span>
          </div>
        </div>
        <figcaption className="landing-caption">
          Example goal. Amounts are made up.
        </figcaption>
      </figure>
    </section>
  );
}
