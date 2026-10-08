import { Link } from "@tanstack/react-router";

export function LandingDualMode() {
  return (
    <section className="landing-family" aria-labelledby="family-title">
      <div className="landing-wrap landing-family-inner">
        <div className="landing-family-heading">
          <p className="landing-kicker">A shared journey, two perspectives</p>
          <h2 id="family-title">
            Room to grow.
            <br />A hand to hold.
          </h2>
        </div>
        <div className="landing-family-views">
          <article>
            <span className="landing-view-label">For young savers</span>
            <h3>“I’m saving for this.”</h3>
            <p>
              A view of their own money, goals, and progress. Quests and Penny’s
              encouragement make the next small step feel achievable.
            </p>
            <ul>
              <li>Track deposits and savings goals</li>
              <li>Learn through quizzes and earn reward points</li>
              <li>Build habits with achievement badges and streaks</li>
            </ul>
            <Link to="/kid-login" className="landing-text-link">
              Young saver sign in
            </Link>
          </article>
          <article>
            <span className="landing-view-label">For parents</span>
            <h3>“I’m here to help.”</h3>
            <p>
              Stay involved as they learn. Review money requests, send
              allowances, and understand each child’s spending and saving.
            </p>
            <ul>
              <li>Approve withdrawals, loans, and rewards</li>
              <li>See transactions and monthly reports</li>
              <li>Set voluntary Hibah gifts and device PIN locks</li>
            </ul>
            <Link to="/login" className="landing-text-link">
              Parent sign in
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
