import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LandingShariahPillars() {
  const pillars = [
    {
      en: "Qard al-Hasan",
      meaning: "Benevolent Loan",
      text: "Interest-free loans between parent and child, complete with formal digital signatures and zero penalty fees.",
    },
    {
      en: "Hibah",
      meaning: "Voluntary Gift",
      text: "Parents reward saving habits with voluntary percentage gifts, never fixed or guaranteed riba.",
    },
    {
      en: "Sadaqah",
      meaning: "Voluntary Charity",
      text: "Hands-on charitable giving to verified community causes, teaching empathy, gratitude, and social impact.",
    },
    {
      en: "Zakat",
      meaning: "Obligatory Alms",
      text: "Automated 2.5% calculation on savings exceeding the lunar Nisab threshold, teaching sacred obligations.",
    },
  ];

  return (
    <section id="pillars" style={{ padding: "5rem 1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
          Built on sacred pillars, designed for the next generation.
        </h2>
        <p style={{ margin: "0.75rem auto 0", maxWidth: "620px", fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Every financial action in Centsibility is strictly vetted for Shariah authenticity, completely free of Riba (interest), Gharar (excessive uncertainty), and Maysir (gambling).
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {pillars.map((p) => (
          <Card
            key={p.en}
            variant="default"
            style={{
              padding: "1.75rem",
              borderRadius: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: "1.15rem", color: "var(--ink)" }}>{p.en}</strong>
              <Badge variant="soft">{p.meaning}</Badge>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              {p.text}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

