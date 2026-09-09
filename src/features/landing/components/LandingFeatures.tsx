export function LandingFeatures() {
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
