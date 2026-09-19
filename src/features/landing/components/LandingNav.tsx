import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0.75rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            textDecoration: "none",
            color: "var(--ink)",
            fontWeight: 800,
            fontSize: "1.25rem",
            letterSpacing: "-0.02em",
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 2px 6px rgba(230, 0, 18, 0.2)",
            }}
          >
            <AppIcon name="penny" size={18} color="#fff" />
          </span>
          <span>Centsibility</span>
        </Link>

        {/* Desktop Navigation */}
        <nav style={{ display: "none", gap: "2rem", alignItems: "center" }} className="desktop-nav">
          <a
            href="#features"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            Features
          </a>
          <a
            href="#pillars"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            Shariah Principles
          </a>
          <a
            href="#showcase"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            Experience
          </a>
        </nav>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/kid-login" style={{ textDecoration: "none" }}>
            <Button size="sm" variant="outline" style={{ display: "none" }} className="desktop-nav">
              Young Saver
            </Button>
          </Link>
          <Link to="/login" style={{ textDecoration: "none" }}>
            <Button size="sm" variant="primary">
              Launch App →
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
            style={{ padding: "0.5rem" }}
            className="mobile-nav-toggle"
          >
            <AppIcon name="menu" size={20} />
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <nav
          style={{
            marginTop: "0.75rem",
            padding: "1rem",
            background: "var(--surface-soft)",
            borderRadius: "1rem",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <a
            href="#features"
            onClick={() => setMenuOpen(false)}
            style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", textDecoration: "none", padding: "0.4rem" }}
          >
            Features
          </a>
          <a
            href="#pillars"
            onClick={() => setMenuOpen(false)}
            style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", textDecoration: "none", padding: "0.4rem" }}
          >
            Shariah Principles
          </a>
          <a
            href="#showcase"
            onClick={() => setMenuOpen(false)}
            style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", textDecoration: "none", padding: "0.4rem" }}
          >
            Experience
          </a>
          <Link to="/kid-login" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
            <Button size="sm" variant="outline" style={{ width: "100%", justifyContent: "center" }}>
              Young Saver Sign In
            </Button>
          </Link>
        </nav>
      )}
    </header>
  );
}

