import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div>
      <Nav />
      <Hero />
      <TrustStrip />
      <Features />
      <DualMode />
      <Showcase />
      <ShariahPillars />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="wireframe-box">
      <div className="wireframe-space-between">
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <strong>[icon: planet] Centsibility</strong>
        </a>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <a href="#features">Features</a>
          <a href="#pillars">Shariah</a>
          <a href="#showcase">Mission Control</a>
        </nav>
        <div className="wireframe-row">
          <Link to="/login">
            Launch →
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
          >
            [icon: menu]
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="wireframe-col" style={{ marginTop: "0.5rem" }}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#pillars" onClick={() => setMenuOpen(false)}>Shariah</a>
          <a href="#showcase" onClick={() => setMenuOpen(false)}>Mission Control</a>
        </nav>
      )}
    </header>
  );
}

function Hero() {
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

function TrustStrip() {
  const items = [
    { k: "0%", v: "Riba (Interest)" },
    { k: "2.5%", v: "Zakat Calculator" },
    { k: "6–17", v: "Ages Supported" },
    { k: "AAOIFI", v: "Standards Aligned" },
  ];
  return (
    <section className="wireframe-box">
      <div className="wireframe-grid-4" style={{ textAlign: "center" }}>
        {items.map((it) => (
          <div key={it.v}>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{it.k}</div>
            <small>{it.v}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      iconLabel: "[icon: vault]",
      title: "Hyperdrive Savings",
      text: "Fund your missions with liquid-fill goals and earn Halal Hibah to boost your speed.",
    },
    {
      iconLabel: "[icon: handshake]",
      title: "Qard Loans",
      text: "Interest-free digital agreements between commander (parent) and astronaut (kid).",
    },
    {
      iconLabel: "[icon: heart]",
      title: "Cosmic Charity",
      text: "Automated 2.5% Zakat calculator and Sadaqah missions to help other galaxies.",
    },
    {
      iconLabel: "[icon: game]",
      title: "Star Quests",
      text: "Daily financial quizzes turn complex lessons into Stardust points and badges.",
    },
    {
      iconLabel: "[icon: users]",
      title: "Command Center",
      text: "Approve missions, review flight logs, and configure spending limits safely.",
    },
    {
      iconLabel: "[icon: book]",
      title: "Stellar Wisdom",
      text: "Daily quotes and Hadith to guide your journey through the financial cosmos.",
    },
  ];
  return (
    <section id="features" className="wireframe-card">
      <div>
        <small>[icon: planet] Constellation of Features</small>
        <h2>An entire Halal economy, mapped out.</h2>
      </div>
      <div className="wireframe-grid-3" style={{ marginTop: "1rem" }}>
        {items.map((it) => (
          <article key={it.title} className="wireframe-box">
            <div className="wireframe-icon">{it.iconLabel}</div>
            <h3>{it.title}</h3>
            <p><small>{it.text}</small></p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DualMode() {
  return (
    <section className="wireframe-card">
      <div className="wireframe-grid-2">
        {/* KID */}
        <div className="wireframe-box">
          <small>[Astronaut Mode]</small>
          <h3>Missions, Stardust, and Real Discovery.</h3>
          <ul>
            <li>[icon: rocket] Liquid-fill fuel (goals)</li>
            <li>[icon: game] Quests, badges & streaks</li>
            <li>[icon: smiley] Penny celebrates every deposit</li>
          </ul>
          <div className="wireframe-row" style={{ marginTop: "0.5rem" }}>
            <strong>RM 87.50</strong>
            <small>+RM 2 Hibah</small>
          </div>
        </div>

        {/* PARENT */}
        <div className="wireframe-box">
          <small>[Command Center]</small>
          <h3>Calm, clear, fully in your hands.</h3>
          <ul>
            <li>[✓] Approve every launch & reward</li>
            <li>[✓] Flight logs (reports) per child</li>
            <li>[✓] Configure Hibah rate & limits</li>
          </ul>
          <div className="wireframe-grid-3" style={{ marginTop: "0.5rem" }}>
            {[
              ["Aiman", "RM 142"],
              ["Nur", "RM 89"],
              ["Zayd", "RM 215"],
            ].map(([n, a]) => (
              <div key={n} className="wireframe-box" style={{ textAlign: "center" }}>
                <small>{n}</small>
                <div><strong>{a}</strong></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="showcase" className="wireframe-card">
      <div style={{ textAlign: "center" }}>
        <small>Inside the Ship</small>
        <h2>A peek at the dashboard.</h2>
      </div>
      <div style={{ maxWidth: "450px", margin: "1rem auto" }}>
        <PhoneMockup />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="wireframe-box">
      <div className="wireframe-space-between">
        <div>
          <small>Commander,</small>
          <h3>Aiman</h3>
        </div>
        <div className="wireframe-img-placeholder" style={{ padding: "0.25rem 0.5rem" }}>
          [image placeholder: Penny]
        </div>
      </div>

      <div className="wireframe-box" style={{ marginTop: "1rem" }}>
        <small>Hyperdrive Core</small>
        <div style={{ fontSize: "1.75rem", fontWeight: "bold" }}>RM 142.50</div>
        <div className="wireframe-row">
          <small>+RM 5 Hibah</small>
          <small>100% Halal [✓]</small>
        </div>
      </div>

      <div className="wireframe-grid-4" style={{ marginTop: "1rem" }}>
        <div className="wireframe-box" style={{ textAlign: "center" }}>
          <div>[icon: money]</div>
          <small>Deposit</small>
        </div>
        <div className="wireframe-box" style={{ textAlign: "center" }}>
          <div>[icon: target]</div>
          <small>Mission</small>
        </div>
        <div className="wireframe-box" style={{ textAlign: "center" }}>
          <div>[icon: quest]</div>
          <small>Quest</small>
        </div>
        <div className="wireframe-box" style={{ textAlign: "center" }}>
          <div>[icon: sadaqah]</div>
          <small>Sadaqah</small>
        </div>
      </div>

      <div className="wireframe-box" style={{ marginTop: "1rem" }}>
        <div className="wireframe-space-between">
          <small>Cosmic Bicycle</small>
          <small>87%</small>
        </div>
        <progress value={87} max={100} style={{ width: "100%" }} />
      </div>
    </div>
  );
}

function ShariahPillars() {
  const pillars = [
    { ar: "قَرْض", en: "Qard", text: "Interest-free loans modeled between parent & child." },
    { ar: "هِبَة", en: "Hibah", text: "Voluntary gifts on savings — never guaranteed interest." },
    { ar: "صَدَقَة", en: "Sadaqah", text: "Charitable giving with real impact, tracked monthly." },
    { ar: "زَكَاة", en: "Zakat", text: "Auto-calculated 2.5% on eligible balances above Nisab." },
  ];
  return (
    <section id="pillars" className="wireframe-card">
      <div>
        <p>بِسْمِ اللَّهِ</p>
        <h2>Built on ancient pillars, ready for the future.</h2>
        <p>
          Every flow is completely free of Riba and aligned with classical fiqh principles —
          designed in a way that resonates with the explorers of tomorrow.
        </p>
      </div>
      <div className="wireframe-grid-4" style={{ marginTop: "1rem" }}>
        {pillars.map((p) => (
          <div key={p.en} className="wireframe-box">
            <div style={{ fontSize: "1.5rem" }}>{p.ar}</div>
            <strong>{p.en}</strong>
            <p><small>{p.text}</small></p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section id="cta" className="wireframe-card" style={{ textAlign: "center" }}>
      <h2>Raise a generation that thrives — halal-y.</h2>
      <p>
        Join the mission and be first to give your kids a financial start that's both
        out-of-this-world and deeply faithful.
      </p>
      {submitted ? (
        <div className="wireframe-box" style={{ maxWidth: "400px", margin: "1rem auto" }}>
          <div>[✓]</div>
          <h3>Jazakallah khair!</h3>
          <p>
            We'll transmit a signal to <strong>{email}</strong> when Centsibility launches.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="wireframe-row" style={{ maxWidth: "450px", margin: "1rem auto" }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="commander@space.com"
          />
          <button type="submit">
            Join Crew
          </button>
        </form>
      )}
      <small>No spam. Halal data practices. Unsubscribe anytime.</small>
    </section>
  );
}

function Footer() {
  return (
    <footer className="wireframe-box">
      <div className="wireframe-space-between">
        <strong>[icon: planet] Centsibility</strong>
        <small>© 2026 Centsibility. Let's make cents of your savings.</small>
      </div>
    </footer>
  );
}
