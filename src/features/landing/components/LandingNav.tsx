import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="wireframe-box">
      <div className="wireframe-space-between">
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <strong>[icon: planet] Centsibility</strong>
        </a>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <a href="#features">Features</a>
          <a href="#pillars">Shariah</a>
          <a href="#showcase">Mission Control</a>
        </nav>
        <div className="wireframe-row">
          <Link to="/login">
            Launch →
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
          >
            [icon: menu]
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="wireframe-col" style={{ marginTop: "0.5rem" }}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#pillars" onClick={() => setMenuOpen(false)}>Shariah</a>
          <a href="#showcase" onClick={() => setMenuOpen(false)}>Mission Control</a>
        </nav>
      )}
    </header>
  );
}
