import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function LandingHero() {
  return (
    <section
      style={{
        padding: "4rem clamp(1rem, 3vw, 1.5rem) 3rem",
        background: "var(--white)",
      }}
    >
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Left Column: Value Prop */}
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <Badge variant="brand">
              <AppIcon name="sparkles" size={14} />
              <span>100% Shariah-Compliant Kids Banking</span>
            </Badge>
          </div>

          <h1
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              fontWeight: 800,
              color: "var(--ink)",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: "0 0 1.25rem",
            }}
          >
            Let&apos;s make cents of your savings!
          </h1>

          <p
            style={{
              fontSize: "1.125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              margin: "0 0 2rem",
              maxWidth: "520px",
            }}
          >
            A friendly Islamic finance app where young savers learn through interest-free Qard, voluntary Hibah, purposeful Sadaqah, and automated Zakat — while parents guide their journey with clarity and trust.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
            <Link to="/kid-login" style={{ textDecoration: "none" }}>
              <Button size="lg" variant="primary" style={{ height: "52px", padding: "0 1.75rem", fontSize: "1rem" }}>
                <AppIcon name="penny" size={20} />
                <span>Young Saver Access</span>
              </Button>
            </Link>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <Button size="lg" variant="outline" style={{ height: "52px", padding: "0 1.75rem", fontSize: "1rem" }}>
                <AppIcon name="user" size={20} />
                <span>Parent Sign In</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: Hero Banking Card Showcase */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "480px", margin: "0 auto", width: "100%" }}>
          <Card
            variant="brand"
            style={{
              padding: "1.75rem",
              borderRadius: "1.5rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <small style={{ fontSize: "0.8125rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Aiman&apos;s Space Savings
                </small>
                <div style={{ fontSize: "2.25rem", fontWeight: 800, marginTop: "0.25rem", fontVariantNumeric: "tabular-nums" }}>
                  RM 142.50
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  WebkitBackdropFilter: "blur(4px)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <AppIcon name="penny" size={24} color="#fff" />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                background: "rgba(255, 255, 255, 0.15)",
                borderRadius: "0.875rem",
                WebkitBackdropFilter: "blur(8px)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AppIcon name="gift" size={16} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>+RM 5.00 Monthly Hibah Gift</span>
              </div>
              <Badge variant="soft" style={{ background: "rgba(255,255,255,0.9)", color: "var(--primary-text)" }}>
                Active
              </Badge>
            </div>
          </Card>

          {/* Quick Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <Card variant="default" style={{ padding: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Hibah Rate</div>
              <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--primary-text)", marginTop: "0.2rem" }}>5.0%</div>
            </Card>
            <Card variant="default" style={{ padding: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Points</div>
              <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--accent-amber-text)", marginTop: "0.2rem" }}>+50 pts</div>
            </Card>
            <Card variant="default" style={{ padding: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Goal Target</div>
              <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--success-text)", marginTop: "0.2rem" }}>87%</div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

