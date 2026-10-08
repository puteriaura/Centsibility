const pillars = [
  {
    name: "Qard al-Hasan",
    meaning: "Borrow without interest",
    text: "A family loan with agreed terms and a digital signature. Repay what was borrowed, with no interest or penalty fees.",
  },
  {
    name: "Hibah",
    meaning: "Give without a guarantee",
    text: "Parents can choose to give a gift to encourage saving. It is voluntary, rather than a promised return.",
  },
  {
    name: "Sadaqah",
    meaning: "Share what you can",
    text: "Make charitable giving part of everyday money habits, and learn why a little generosity matters.",
  },
  {
    name: "Zakat",
    meaning: "Understand the obligation",
    text: "Explore Nisab, the qualifying period, and the amount due with the app’s Zakat calculator.",
  },
];

export function LandingShariahPillars() {
  return (
    <section
      id="pillars"
      className="landing-principles"
      aria-labelledby="pillars-title"
    >
      <div className="landing-wrap landing-principles-inner">
        <div>
          <p className="landing-kicker">Rooted in Islamic finance</p>
          <h2 id="pillars-title">
            Values they can
            <br />
            put into practice.
          </h2>
          <p>
            Not just words to remember. Principles to use when saving,
            borrowing, and sharing.
          </p>
        </div>
        <dl>
          {pillars.map((pillar) => (
            <div key={pillar.name}>
              <dt>
                {pillar.name}
                <span>{pillar.meaning}</span>
              </dt>
              <dd>{pillar.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
