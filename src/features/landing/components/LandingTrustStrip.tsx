export function LandingTrustStrip() {
  const items = [
    { k: "0%", v: "Riba (Interest-Free)" },
    { k: "2.5%", v: "Auto Zakat Calculation" },
    { k: "6–17", v: "Ages Supported" },
    { k: "AAOIFI", v: "Shariah Standards Aligned" },
  ];
  return (
    <section
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-soft)",
        padding: "2rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          textAlign: "center",
        }}
      >
        {items.map((it) => (
          <div key={it.v} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {it.k}
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              {it.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

