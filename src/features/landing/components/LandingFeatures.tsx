import { AppIcon } from "@/components/ui/app-icon";
import pennyGuide from "@/assets/penny/guide.svg";

export function LandingFeatures() {
  return (
    <section
      id="how"
      className="landing-section landing-wrap"
      aria-labelledby="features-title"
    >
      <div className="landing-section-intro">
        <span className="landing-kicker">How it works</span>
        <h2 id="features-title">Save, borrow, give.</h2>
        <p>All three happen in one wallet that you can see.</p>
      </div>
      <article className="landing-product-row">
        <div className="landing-product-copy">
          <span className="landing-product-label">Tabung</span>
          <h3>A tabung for the thing they actually want.</h3>
          <p>
            They name the goal, set the price and watch the ring fill up with
            each deposit. You can top it up with a Hibah gift. It's a gift,
            never a promised return.
          </p>
        </div>
        <div className="landing-product-art">
          <div className="landing-example-card landing-goal-card">
            <div className="landing-example-heading">
              <span className="landing-example-icon">
                <AppIcon name="sprout" size={22} />
              </span>
              <div>
                <small>Tabung</small>
                <b>New bicycle</b>
              </div>
            </div>
            <div className="landing-ring-wrap">
              <svg
                className="landing-ring"
                viewBox="0 0 120 120"
                aria-hidden="true"
              >
                <circle className="landing-ring-track" cx={60} cy={60} r={50} />
                <circle
                  className="landing-ring-fill"
                  cx={60}
                  cy={60}
                  r={50}
                  pathLength={100}
                  strokeDasharray="87 100"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="landing-ring-label">
                <b>87%</b>
                <small>saved</small>
              </div>
            </div>
            <p className="landing-example-line">RM174 of RM200</p>
            <span className="landing-pill">+RM5 Hibah gift</span>
          </div>
        </div>
      </article>
      <article className="landing-product-row landing-product-reverse">
        <div className="landing-product-copy">
          <span className="landing-product-label">Qard al-Hasan</span>
          <h3>Borrowing from family, done properly.</h3>
          <p>
            Your child asks for a small loan. You agree on when it gets paid
            back, then you both sign. No interest, no late fees.
          </p>
        </div>
        <div className="landing-product-art">
          <div className="landing-example-card landing-agreement">
            <div className="landing-example-heading">
              <span className="landing-example-icon">
                <AppIcon name="loan" size={22} />
              </span>
              <b>Loan agreement</b>
            </div>
            <dl>
              <div>
                <dt>Borrow</dt>
                <dd>RM20</dd>
              </div>
              <div>
                <dt>Pay back by</dt>
                <dd>30 Nov</dd>
              </div>
              <div>
                <dt>Interest</dt>
                <dd>RM0</dd>
              </div>
            </dl>
            <div className="landing-signatures">
              <span>
                <AppIcon name="check" size={18} />
                Aiman signed
              </span>
              <span>
                <AppIcon name="check" size={18} />
                Parent signed
              </span>
            </div>
          </div>
        </div>
      </article>
      <article className="landing-product-row">
        <div className="landing-product-copy">
          <span className="landing-product-label">Sadaqah and Zakat</span>
          <h3>Some of it goes to others.</h3>
          <p>
            Kids give Sadaqah to causes like local masjids and clean water
            projects. The Zakat calculator walks through Nisab and the 2.5%
            rate, one step at a time.
          </p>
        </div>
        <div className="landing-product-art">
          <div className="landing-example-card landing-giving">
            <div className="landing-example-heading">
              <span className="landing-example-icon">
                <AppIcon name="heart" size={22} />
              </span>
              <div>
                <small>Sadaqah</small>
                <b>Clean water</b>
              </div>
            </div>
            <p className="landing-example-amount">RM5</p>
            <p className="landing-example-line">From Aiman's wallet</p>
            <div className="landing-zakat-note">
              <AppIcon name="scale" size={20} />
              <span>Zakat: 2.5% above Nisab</span>
            </div>
          </div>
        </div>
      </article>
      <div className="landing-learning landing-brand-card">
        <img
          className="landing-learning-penny"
          src={pennyGuide}
          alt=""
          width={150}
          height={150}
        />
        <div>
          <h3>Penny explains the tricky bits.</h3>
          <p>
            Missions and quick quizzes earn reward points. Penny answers money
            questions in plain words. Short verses and Hadith give the choices
            some context.
          </p>
          <div className="landing-learning-chips">
            {[
              { icon: "missions", label: "Missions" },
              { icon: "gift", label: "Rewards" },
              { icon: "chat", label: "Ask Penny" },
            ].map((item) => (
              <span key={item.label}>
                <AppIcon name={item.icon} size={18} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
