import { LandingPhone } from "./LandingPhone";

export function LandingShowcase() {
  return (
    <section
      id="app"
      className="landing-section landing-showcase"
      aria-labelledby="showcase-title"
    >
      <div className="landing-wrap">
        <div className="landing-section-intro">
          <span className="landing-kicker">Inside the app</span>
          <h2 id="showcase-title">What your child sees.</h2>
          <p>
            Big buttons, very few words and a screen that feels like theirs.
            These are real screens with made-up amounts.
          </p>
        </div>
        <div className="landing-phones">
          {["Home", "Insights", "Practice card"].map((title, i) => (
            <figure key={title}>
              <div className="landing-phone-scale">
                <LandingPhone
                  variant={i === 0 ? "home" : i === 1 ? "insights" : "practice"}
                />
              </div>
              <figcaption>{title}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
