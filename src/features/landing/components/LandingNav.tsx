import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="landing-header">
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <div className="landing-wrap landing-nav">
        <Link to="/" className="landing-brand" aria-label="Centsibility home">
          <span className="landing-brand-mark" aria-hidden="true">
            c.
          </span>
          Centsibility
        </Link>
        <nav className="landing-desktop-nav" aria-label="Main navigation">
          <a href="#features">How it helps</a>
          <a href="#showcase">Inside the app</a>
          <a href="#pillars">Our principles</a>
        </nav>
        <Link to="/login" className="landing-nav-login">
          Parent sign in
        </Link>
        <button
          type="button"
          className="landing-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
        >
          <AppIcon name={menuOpen ? "close" : "menu"} size={23} />
        </button>
      </div>
      {menuOpen && (
        <nav
          id="landing-mobile-menu"
          className="landing-mobile-menu landing-wrap"
          aria-label="Mobile navigation"
        >
          <a href="#features" onClick={() => setMenuOpen(false)}>
            How it helps
          </a>
          <a href="#showcase" onClick={() => setMenuOpen(false)}>
            Inside the app
          </a>
          <a href="#pillars" onClick={() => setMenuOpen(false)}>
            Our principles
          </a>
          <Link to="/kid-login" onClick={() => setMenuOpen(false)}>
            Young saver sign in
          </Link>
          <Link to="/login" onClick={() => setMenuOpen(false)}>
            Parent sign in
          </Link>
        </nav>
      )}
    </header>
  );
}
