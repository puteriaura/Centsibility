import { AppIcon } from "@/components/ui/app-icon";
import pennyGuide from "@/assets/penny/guide.svg";

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="landing-wrap landing-features"
      aria-labelledby="features-title"
    >
      <div className="landing-section-intro">
        <p className="landing-kicker">Save, borrow, give</p>
        <h2 id="features-title">
          A little money.
          <br />A lot to learn.
        </h2>
        <p>Real choices today. Good habits for tomorrow.</p>
      </div>

      <article className="landing-product-row">
        <div className="landing-product-copy">
          <p className="landing-kicker">Their own tabung</p>
          <h3>
            Give their next
            <br />
            big idea a home.
          </h3>
          <p>
            New books, a bicycle, a gift for someone special. Put money aside
            for a goal they choose and watch each deposit bring it closer.
          </p>
          <details className="landing-product-details">
            <summary>How saving works</summary>
            <p>
              Create a tabung, set a target, and track deposits. Parents can
              choose to encourage progress with a voluntary Hibah gift.
            </p>
          </details>
        </div>
        <figure className="landing-product-art landing-saving-art">
          <div className="landing-saving-note">
            <AppIcon name="book" size={26} />
            <span>Something worth saving for</span>
          </div>
          <div className="landing-saving-demo">
            <span>My book fund</span>
            <div className="landing-saving-ring">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="86" />
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  pathLength="100"
                  strokeDasharray="60 100"
                />
              </svg>
              <div>
                <span>Saved so far</span>
                <strong>RM60</strong>
                <span>of RM100</span>
              </div>
            </div>
            <div className="landing-demo-bottom">
              <span>A little closer.</span>
              <strong>60% saved</strong>
            </div>
          </div>
          <figcaption>Illustrative savings goal</figcaption>
        </figure>
      </article>

      <article className="landing-product-row landing-product-row-reverse">
        <div className="landing-product-copy">
          <p className="landing-kicker">Qard al-Hasan</p>
          <h3>
            A small loan.
            <br />A real promise.
          </h3>
          <p>
            Borrowing starts with a conversation. Request an interest-free
            family loan, agree on the terms, and sign a digital agreement with a
            parent.
          </p>
          <details className="landing-product-details">
            <summary>What goes into an agreement</summary>
            <p>
              The amount borrowed, the repayment terms, and both digital
              signatures. There is no interest or penalty fee.
            </p>
          </details>
        </div>
        <figure className="landing-product-art landing-loan-art">
          <div className="landing-agreement-demo">
            <div className="landing-demo-heading">
              <AppIcon name="loan" size={28} />
              <span>Our loan agreement</span>
            </div>
            <dl>
              <div>
                <dt>Borrow</dt>
                <dd>RM20</dd>
              </div>
              <div>
                <dt>Repay</dt>
                <dd>RM20</dd>
              </div>
              <div>
                <dt>Interest</dt>
                <dd>RM0</dd>
              </div>
            </dl>
            <div className="landing-demo-signatures">
              <span>
                Young saver
                <br />
                <strong>Aiman</strong>
              </span>
              <span>
                Parent
                <br />
                <strong>Agreed together</strong>
              </span>
            </div>
          </div>
          <div className="landing-loan-note">
            <AppIcon name="check" size={20} />
            <span>Clear terms. No interest.</span>
          </div>
          <figcaption>Illustrative family agreement</figcaption>
        </figure>
      </article>

      <article className="landing-product-row">
        <div className="landing-product-copy">
          <p className="landing-kicker">Sadaqah & Zakat</p>
          <h3>
            Some for me.
            <br />
            Some to share.
          </h3>
          <p>
            Make giving part of their money habits. Set aside Sadaqah, then
            explore how Zakat works with a calculator that explains the amount
            due.
          </p>
          <details className="landing-product-details">
            <summary>Two ways to understand giving</summary>
            <p>
              Sadaqah is a voluntary gift. Zakat is an obligation when its
              conditions are met. The app helps explain Nisab, the qualifying
              period, and the calculation.
            </p>
          </details>
        </div>
        <figure className="landing-product-art landing-giving-art">
          <div className="landing-giving-symbol">
            <AppIcon name="heart" size={62} />
          </div>
          <div className="landing-giving-demo">
            <span>Set aside for Sadaqah</span>
            <strong>RM5</strong>
            <p>A small amount can be a thoughtful choice.</p>
          </div>
          <div className="landing-zakat-note">
            <AppIcon name="calculator" size={25} />
            <div>
              <strong>Understand your Zakat</strong>
              <span>Learn what counts and how it is calculated.</span>
            </div>
          </div>
          <figcaption>Illustrative giving amount</figcaption>
        </figure>
      </article>

      <div className="landing-learning">
        <img src={pennyGuide} alt="" width={110} height={110} />
        <div>
          <h3>A little learning, every day.</h3>
          <p>
            Short finance quests turn lessons into reward points. Daily Quranic
            verses and Hadith put those money choices in context.
          </p>
          <span>Quests, rewards & daily reflections</span>
        </div>
      </div>
    </section>
  );
}
