import { Link } from "@tanstack/react-router";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-wrap landing-footer-inner">
        <Link to="/" className="landing-brand">
          <img
            className="landing-app-icon"
            src="/icons/centsibility-app.svg"
            alt=""
            width={38}
            height={38}
          />
          <span>Centsibility</span>
        </Link>
        <p>A family money app for kids in Malaysia.</p>
        <small>© 2026 Centsibility</small>
      </div>
    </footer>
  );
}
