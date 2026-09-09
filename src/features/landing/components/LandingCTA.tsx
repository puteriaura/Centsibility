import { useState } from "react";

export function LandingCTA() {
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
