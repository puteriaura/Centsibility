import { AppIcon } from "@/components/ui/app-icon";

export function LandingFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--white)",
        padding: "2.5rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <AppIcon name="penny" size={16} color="#fff" />
          </span>
          <strong style={{ fontSize: "1.1rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
            Centsibility
          </strong>
        </div>

        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          © 2026 Centsibility. Shariah-Compliant Kids & Youth Digital Finance.
        </div>
      </div>
    </footer>
  );
}

