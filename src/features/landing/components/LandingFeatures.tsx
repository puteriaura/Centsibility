import { AppIcon } from "@/components/ui/app-icon";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LandingFeatures() {
  const items = [
    {
      icon: "vault",
      title: "Hyperdrive Savings",
      text: "Fund goals with visual progress bars and earn voluntary parental Hibah to boost your savings rate.",
    },
    {
      icon: "loan",
      title: "Qard Benevolent Loans",
      text: "Interest-free digital agreements between parent and child, complete with formal digital signatures.",
    },
    {
      icon: "heart",
      title: "Cosmic Sadaqah & Zakat",
      text: "Automated 2.5% Zakat calculator above Nisab and meaningful charity contributions to verified causes.",
    },
    {
      icon: "game",
      title: "Daily Financial Quests",
      text: "Turn Islamic finance lessons into Stardust reward points with gamified daily learning quizzes.",
    },
    {
      icon: "users",
      title: "Parent Commander Center",
      text: "Approve loans and money requests, monitor transactions, and set custom Hibah rates per child.",
    },
    {
      icon: "book",
      title: "Prophetic Money Wisdom",
      text: "Daily Hadith and Quranic financial verses to instill lifelong stewardship, gratitude, and ethics.",
    },
  ];

  return (
    <section id="features" style={{ padding: "5rem 1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <Badge variant="soft">Features & Architecture</Badge>
        </div>
        <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
          An entire Halal family economy, mapped out.
        </h2>
        <p style={{ margin: "0.75rem auto 0", maxWidth: "600px", fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Every feature is architected from the ground up to follow genuine Islamic jurisprudence while keeping young minds engaged.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {items.map((it) => (
          <Card
            key={it.title}
            variant="default"
            style={{
              padding: "1.75rem",
              borderRadius: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "1rem",
                background: "var(--primary-soft)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppIcon name={it.icon} size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 0.5rem" }}>
                {it.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {it.text}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

