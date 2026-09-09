export function LandingTrustStrip() {
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
