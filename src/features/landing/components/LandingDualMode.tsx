export function LandingDualMode() {
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
