export function LandingShariahPillars() {
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
