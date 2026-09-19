import { AppIcon } from "@/components/ui/app-icon";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LandingDualMode() {
  return (
    <section style={{ padding: "3rem 1.5rem 5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "2rem",
        }}
      >
        {/* KID MODE CARD */}
        <Card
          variant="soft"
          style={{
            padding: "2.25rem",
            borderRadius: "1.5rem",
            background: "var(--surface-pink)",
            borderColor: "var(--primary-soft)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <Badge variant="brand">Young Saver Mode</Badge>
              <AppIcon name="rocket" size={24} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", margin: "0 0 0.75rem", letterSpacing: "-0.01em" }}>
              Missions, Stardust, and Real Discovery.
            </h3>
            <p style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
              An interactive interface where kids learn real financial discipline through fun quests, savings goals, and daily trivia.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "var(--ink)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                  <AppIcon name="target" size={14} />
                </div>
                <span>Visual goal progression with real deposit tracking</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "var(--ink)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                  <AppIcon name="game" size={14} />
                </div>
                <span>Quests, achievement badges & Islamic finance streaks</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "var(--ink)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                  <AppIcon name="sparkles" size={14} />
                </div>
                <span>Penny mascot celebrates every Halal milestone</span>
              </li>
            </ul>
          </div>

          <div
            style={{
              marginTop: "2rem",
              padding: "1rem 1.25rem",
              background: "var(--surface)",
              borderRadius: "1rem",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Saved</div>
              <strong style={{ fontSize: "1.25rem", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>RM 87.50</strong>
            </div>
            <Badge variant="success">+RM 2.00 Hibah Earned</Badge>
          </div>
        </Card>

        {/* PARENT COMMAND CENTER */}
        <Card
          variant="default"
          style={{
            padding: "2.25rem",
            borderRadius: "1.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <Badge variant="soft">Parent Command Center</Badge>
              <AppIcon name="users" size={24} color="var(--ink)" />
            </div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", margin: "0 0 0.75rem", letterSpacing: "-0.01em" }}>
              Calm, clear, and fully in your hands.
            </h3>
            <p style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
              Comprehensive parental oversight without micromanagement. Approve loans, disburse allowances, and track Shariah habits.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "var(--ink)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                  <AppIcon name="check" size={14} />
                </div>
                <span>One-tap approval for withdrawals, loans, and rewards</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "var(--ink)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                  <AppIcon name="check" size={14} />
                </div>
                <span>Monthly financial analytics and spending reports per child</span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "var(--ink)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                  <AppIcon name="check" size={14} />
                </div>
                <span>Configure custom voluntary Hibah rates & device PIN locks</span>
              </li>
            </ul>
          </div>

          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.5rem",
            }}
          >
            {[
              ["Aiman", "RM 142"],
              ["Nur", "RM 89"],
              ["Zayd", "RM 215"],
            ].map(([n, a]) => (
              <div
                key={n}
                style={{
                  padding: "0.75rem 0.5rem",
                  borderRadius: "0.75rem",
                  background: "var(--surface-soft)",
                  border: "1px solid var(--border)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{n}</div>
                <strong style={{ fontSize: "0.9375rem", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{a}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

