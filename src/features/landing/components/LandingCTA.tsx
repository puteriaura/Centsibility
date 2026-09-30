import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/ui/app-icon";

export function LandingCTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section
      id="cta"
      style={{
        padding: "5rem clamp(1rem, 3vw, 1.5rem)",
        background: "var(--surface-pink)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 800, color: "var(--ink)", margin: "0 0 1rem", letterSpacing: "-0.02em" }}>
          Raise a generation that thrives — halal-y.
        </h2>
        <p style={{ fontSize: "1.05rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 2rem" }}>
          Get started and give your children an authentic financial head-start that is deeply faithful, mathematically sound, and fun.
        </p>

        {submitted ? (
          <div
            style={{
              padding: "1.5rem",
              background: "var(--success-soft)",
              borderRadius: "1rem",
              border: "1px solid rgba(23, 166, 115, 0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <div style={{ color: "var(--success-text)" }}>
              <AppIcon name="check" size={28} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              Jazakallah khair!
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
              We&apos;ll transmit an invite to <strong>{email}</strong> when public registrations open.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              style={{ maxWidth: "340px", height: "48px" }}
            />
            <Button type="submit" variant="primary" style={{ height: "48px", padding: "0 1.5rem" }}>
              Join Centsibility
            </Button>
          </form>
        )}

        <small style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
          Zero spam · Strict Halal data privacy practices · Unsubscribe anytime
        </small>
      </div>
    </section>
  );
}

