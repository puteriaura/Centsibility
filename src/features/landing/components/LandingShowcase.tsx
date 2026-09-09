export function PhoneMockup() {
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

export function LandingShowcase() {
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
