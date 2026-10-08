import { Link } from "@tanstack/react-router";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-wrap">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark" aria-hidden="true">
            c.
          </span>
          Centsibility
        </Link>
        <p>Money habits, learned together.</p>
        <small>© 2026 Centsibility</small>
      </div>
    </footer>
  );
}
