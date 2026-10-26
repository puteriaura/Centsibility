import { AppIcon } from "@/components/ui/app-icon";

const pillars = [
  {
    icon: "loan",
    name: "Qard al-Hasan",
    meaning: "Loans without interest",
    text: "Repay exactly what you borrowed. No interest, no penalty fees.",
  },
  {
    icon: "gift",
    name: "Hibah",
    meaning: "Gifts, not returns",
    text: "Parents can reward saving with a gift. It's voluntary, so no profit is promised.",
  },
  {
    icon: "heart",
    name: "Sadaqah",
    meaning: "Give what you can",
    text: "Small amounts count. Kids choose a cause and give from their own wallet.",
  },
  {
    icon: "scale",
    name: "Zakat",
    meaning: "Know what's due",
    text: "The calculator explains Nisab, the lunar year and the 2.5% rate.",
  },
];
export function LandingShariahPillars() {
  return (
    <section
      id="principles"
      className="landing-section landing-wrap"
      aria-labelledby="pillars-title"
    >
      <div className="landing-section-intro">
        <span className="landing-kicker">Our principles</span>
        <h2 id="pillars-title">The rules money follows here.</h2>
        <p>
          Four ideas from Islamic finance decide how money moves in
          Centsibility.
        </p>
      </div>
      <div className="landing-principles-grid">
        {pillars.map((p) => (
          <article className="landing-principle" key={p.name}>
            <span className="landing-principle-icon">
              <AppIcon name={p.icon} size={24} />
            </span>
            <h3>{p.name}</h3>
            <span className="landing-principle-meaning">{p.meaning}</span>
            <p>{p.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
