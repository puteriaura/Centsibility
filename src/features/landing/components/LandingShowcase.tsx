import { AppIcon } from "@/components/ui/app-icon";

export function PhoneMockup() {
  return (
    <div
      className="landing-phone"
      aria-label="Illustrative young saver home screen"
    >
      <div className="landing-phone-speaker" aria-hidden="true" />
      <div className="landing-phone-top">
        <div>
          <span>Young saver</span>
          <strong>Hi, Aiman.</strong>
        </div>
        <span className="landing-avatar">A</span>
      </div>
      <div className="landing-phone-balance">
        <span>Wallet balance</span>
        <strong>RM142.50</strong>
        <p>A little saved is a good start.</p>
      </div>
      <div className="landing-phone-actions">
        {[
          { icon: "deposit", label: "Deposit" },
          { icon: "target", label: "Tabung" },
          { icon: "quest", label: "Quests" },
          { icon: "sadaqah", label: "Sadaqah" },
        ].map((item) => (
          <div key={item.label}>
            <AppIcon name={item.icon} size={21} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="landing-phone-goal">
        <span>My tabung</span>
        <div>
          <AppIcon name="bicycle" size={22} />
          <strong>New bicycle</strong>
          <span>87%</span>
        </div>
        <div className="landing-mini-track">
          <span />
        </div>
        <p>RM261 saved of RM300</p>
      </div>
      <div className="landing-phone-lesson">
        <AppIcon name="book" size={25} />
        <div>
          <strong>Today’s money lesson</strong>
          <span>What makes a gift different from a loan?</span>
        </div>
      </div>
      <div className="landing-phone-dock">
        <span>Home</span>
        <span>Wallet</span>
        <strong>Tabung</strong>
        <span>Loans</span>
        <span>Card</span>
      </div>
    </div>
  );
}

export function LandingShowcase() {
  return (
    <section
      id="showcase"
      className="landing-wrap landing-showcase"
      aria-labelledby="showcase-title"
    >
      <div className="landing-showcase-copy">
        <p className="landing-kicker">Inside the young saver view</p>
        <h2 id="showcase-title">
          Their money.
          <br />
          In their hands.
        </h2>
        <p>
          A balance they can understand. A goal they chose. A lesson they can
          use today.
        </p>
        <p>
          The young saver home brings those pieces together, while you keep
          track from your own parent view.
        </p>
        <div className="landing-showcase-note">
          <strong>Tabung</strong>
          <span>
            A place to put money aside for something worth waiting for.
          </span>
        </div>
      </div>
      <figure className="landing-phone-stage">
        <PhoneMockup />
        <figcaption>
          Illustrative screen. Balances and goals are examples.
        </figcaption>
      </figure>
    </section>
  );
}
