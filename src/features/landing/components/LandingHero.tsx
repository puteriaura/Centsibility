import { Link } from "@tanstack/react-router";

export function LandingHero() {
  return (
    <section className="wireframe-card">
      <div className="wireframe-grid-2">
        <div>
          <div>
            <small><strong>[100% Halal Cosmic Journey]</strong></small>
          </div>
          <h1 style={{ margin: "0.75rem 0" }}>
            Let's make cents of your savings!
          </h1>
          <p>
            Embark on a galactic adventure! A Shariah-compliant finance app where kids learn through
            Qard, Hibah, Sadaqah and Zakat — and parents command the mission from a high-tech
            dashboard.
          </p>
          <div className="wireframe-row" style={{ marginTop: "1rem" }}>
            <Link to="/kid-login">
              [icon: rocket] Astronaut Login
            </Link>
            <Link to="/login">
              [icon: user] Command Center
            </Link>
          </div>
        </div>

        <div className="wireframe-col" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="wireframe-img-placeholder" style={{ width: "100%", minHeight: "200px" }}>
            [image placeholder: Penny the Astronaut Platypus]
          </div>
          <div className="wireframe-grid-3" style={{ width: "100%" }}>
            <div className="wireframe-box">
              <small><strong>Transmission</strong></small>
              <div>+RM 5.00 Hibah</div>
            </div>
            <div className="wireframe-box">
              <small><strong>Quest Complete</strong></small>
              <div>+50 Stardust</div>
            </div>
            <div className="wireframe-box">
              <small><strong>Orbit Achieved</strong></small>
              <div>Goal 87%</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
