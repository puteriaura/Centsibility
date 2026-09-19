import { AppIcon } from "@/components/ui/app-icon";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function PhoneMockup() {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "2.5rem",
        border: "8px solid #2D3142",
        boxShadow: "0 24px 60px rgba(22, 26, 80, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Phone Notch Bar */}
      <div
        style={{
          height: "24px",
          background: "#2D3142",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "48px", height: "4px", background: "#4E546A", borderRadius: "999px" }} />
      </div>

      {/* Screen Content */}
      <div style={{ padding: "1.5rem", background: "var(--surface-soft)" }}>
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Astronaut</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--ink)" }}>Aiman</div>
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--primary-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
              fontWeight: 800,
              fontSize: "0.875rem",
            }}
          >
            A
          </div>
        </div>

        {/* Hyperdrive Balance Card */}
        <div
          style={{
            background: "var(--primary)",
            color: "#fff",
            padding: "1.25rem",
            borderRadius: "1.25rem",
            boxShadow: "0 6px 16px rgba(230, 0, 18, 0.25)",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Total Savings
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 800, marginTop: "0.25rem", fontVariantNumeric: "tabular-nums" }}>
            RM 142.50
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>+RM 5.00 Hibah Gift</span>
            <Badge variant="soft" style={{ background: "rgba(255,255,255,0.9)", color: "var(--primary)", fontSize: "0.6875rem" }}>
              Halal Certified
            </Badge>
          </div>
        </div>

        {/* 4 Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {[
            { icon: "deposit", label: "Deposit" },
            { icon: "target", label: "Goals" },
            { icon: "quest", label: "Quests" },
            { icon: "sadaqah", label: "Sadaqah" },
          ].map((a) => (
            <div
              key={a.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.875rem",
                padding: "0.625rem 0.25rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <div style={{ color: "var(--primary)" }}>
                <AppIcon name={a.icon} size={18} />
              </div>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--ink)" }}>{a.label}</span>
            </div>
          ))}
        </div>

        {/* Goal Card */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "1rem",
            padding: "1rem",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AppIcon name="bicycle" size={18} color="var(--primary)" />
              <strong style={{ fontSize: "0.875rem", color: "var(--ink)" }}>Cosmic Bicycle</strong>
            </div>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--primary)" }}>87%</span>
          </div>
          <Progress value={87} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem", fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            <span>RM 261 saved</span>
            <span>RM 300 target</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingShowcase() {
  return (
    <section id="showcase" style={{ padding: "5rem 1.5rem", background: "var(--surface-soft)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <Badge variant="brand">Interactive Experience</Badge>
        </div>
        <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.02em" }}>
          A peek at the young saver interface.
        </h2>
        <p style={{ margin: "0.75rem auto 3rem", maxWidth: "560px", fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Tailored with large touch targets, joyful feedback, and clean Shariah-compliant math that makes financial literacy exciting.
        </p>

        <div style={{ maxWidth: "380px", margin: "0 auto" }}>
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

