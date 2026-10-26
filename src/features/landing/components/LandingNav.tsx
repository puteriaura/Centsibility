import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { LandingThemeToggle } from "./LandingThemeToggle";

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="landing-header">
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <div className="landing-wrap landing-nav">
        <Link to="/" className="landing-brand" aria-label="Centsibility home">
          <img
            className="landing-app-icon"
            src="/icons/centsibility-app.svg"
            alt=""
            width={38}
            height={38}
          />
          <span>Centsibility</span>
        </Link>
        <nav className="landing-desktop-nav" aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#app">Inside the app</a>
          <a href="#principles">Our principles</a>
        </nav>
        <div className="landing-nav-actions">
          <LandingThemeToggle />
          <Link className="landing-link" to="/kid-login">
            Young saver sign in
          </Link>
          <Link className="landing-button landing-sun" to="/login">
            Parent sign in
          </Link>
        </div>
        <div className="landing-mobile-actions">
          <LandingThemeToggle />
          <button
            type="button"
            className="landing-menu-toggle"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <AppIcon name={menuOpen ? "close" : "menu"} size={24} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="landing-mobile-menu"
          className="landing-mobile-menu landing-wrap"
          aria-label="Mobile navigation"
        >
          <a href="#how" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#app" onClick={() => setMenuOpen(false)}>
            Inside the app
          </a>
          <a href="#principles" onClick={() => setMenuOpen(false)}>
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
