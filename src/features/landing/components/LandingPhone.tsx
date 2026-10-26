import { AppIcon } from "@/components/ui/app-icon";
import { PennyFace } from "@/components/PennyFace";

export function LandingPhone({
  variant,
}: {
  variant: "home" | "insights" | "practice";
}) {
  return (
    <div className="landing-phone" aria-hidden="true">
      <div className="landing-phone-status">
        <b>4:12</b>
        <i />
      </div>
      {variant === "home" ? (
        <>
          <div className="landing-phone-top">
            <span className="landing-phone-icon">
              <AppIcon name="star" size={20} />
            </span>
            <img
              className="landing-app-icon"
              src="/icons/centsibility-app.svg"
              alt=""
              width={42}
              height={42}
            />
            <span className="landing-phone-icon">
              <AppIcon name="bell" size={20} />
            </span>
          </div>
          <div className="landing-brand-card landing-phone-balance">
            <small>My balance</small>
            <b>RM381.20</b>
            <small>
              <strong>RM142.50</strong> to spend
            </small>
            <span className="landing-pill">+RM30.00 this week</span>
          </div>
          <div className="landing-phone-actions">
            {[
              { icon: "send", label: "Send" },
              { icon: "sprout", label: "Tabung" },
              { icon: "ask", label: "Ask" },
              { icon: "more", label: "More" },
            ].map((item) => (
              <div key={item.label}>
                <span>
                  <AppIcon name={item.icon} size={26} />
                </span>
                {item.label}
              </div>
            ))}
          </div>
          <div className="landing-phone-tiles">
            <div className="landing-phone-card">
              <small>STREAK</small>
              <b>5 days</b>
              <span className="landing-phone-flame">
                <AppIcon name="flame" size={24} />
              </span>
            </div>
            <div className="landing-phone-card">
              <small>NEW BICYCLE</small>
              <b>
                RM174.00 /<br />
                RM200.00
              </b>
              <svg className="landing-phone-goal-ring" viewBox="0 0 66 66">
                <circle
                  className="landing-phone-ring-track"
                  cx={33}
                  cy={33}
                  r={27}
                />
                <circle
                  className="landing-phone-ring-fill"
                  cx={33}
                  cy={33}
                  r={27}
                  pathLength={100}
                  strokeDasharray="87 100"
                  transform="rotate(-90 33 33)"
                />
                <text x={33} y={37} textAnchor="middle">
                  87%
                </text>
              </svg>
            </div>
          </div>
        </>
      ) : variant === "insights" ? (
        <>
          <div className="landing-phone-title">
            <strong>Insights</strong>
            <span className="landing-phone-face">
              <PennyFace size={38} />
            </span>
          </div>
          <div className="landing-phone-segment">
            <span className="landing-selected">Spending</span>
            <span>Income</span>
          </div>
          <div className="landing-brand-card landing-phone-summary">
            <small>Spent this month</small>
            <b>RM17.00</b>
            <span className="landing-pill">RM8 less than Sep</span>
          </div>
          <div className="landing-phone-card landing-phone-week">
            <p className="landing-phone-heading">This week</p>
            <div className="landing-phone-bars">
              {[30, 62, 18, 78, 40, 100, 0].map((height, i) => (
                <i
                  key={i}
                  className={i === 5 ? "landing-today" : undefined}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="landing-phone-days">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <span key={i} className={i === 5 ? "landing-today" : undefined}>
                  {day}
                </span>
              ))}
            </div>
          </div>
          <div className="landing-phone-card landing-phone-categories">
            <p className="landing-phone-heading">Where it went</p>
            {[
              { name: "Loan repayment", pct: 59, amount: "RM10.00" },
              { name: "Sadaqah", pct: 29, amount: "RM5.00" },
              { name: "Transfer sent", pct: 12, amount: "RM2.00" },
            ].map((item, i) => (
              <div className="landing-phone-category" key={item.name}>
                <div className="landing-category-row">
                  <span>
                    {item.name} <small>{item.pct}%</small>
                  </span>
                  <span>{item.amount}</span>
                </div>
                <div className="landing-category-track">
                  <span
                    style={{
                      width: `${item.pct}%`,
                      background: `var(--chart-${i + 1})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="landing-phone-title landing-phone-title-centered">
            <strong>Practice card</strong>
          </div>
          <div className="landing-practice-card">
            <div className="landing-practice-top">
              <b>CENTSIBILITY</b>
              <small>CVV ••• &nbsp; EXP ••/••</small>
            </div>
            <div className="landing-practice-body">
              <span className="landing-phone-face">
                <PennyFace size={38} />
              </span>
              •••• •••• •••• 6553
            </div>
            <div className="landing-practice-bottom">
              <span>
                <small>CARDHOLDER</small>
                <b>Aiman</b>
              </span>
              <span className="landing-practice-label">Practice card</span>
            </div>
          </div>
          <p className="landing-practice-note">
            Practice only. It can't pay anywhere.
          </p>
          <div className="landing-practice-steps">
            {["Set a limit", "Lock it", "Try a tap"].map((text, i) => (
              <div key={text}>
                <span>{i + 1}</span>
                {text}
              </div>
            ))}
          </div>
          <div className="landing-phone-card landing-phone-tap">
            <p className="landing-phone-heading">Try a pretend tap</p>
            <div className="landing-practice-items">
              {[
                { icon: "icecream", amount: "RM3" },
                { icon: "bookclosed", amount: "RM12" },
                { icon: "robot", amount: "RM60" },
              ].map((item, i) => (
                <div
                  className={i === 0 ? "landing-selected-item" : undefined}
                  key={item.icon}
                >
                  <AppIcon name={item.icon} size={22} />
                  <span>{item.amount}</span>
                </div>
              ))}
            </div>
            <div className="landing-practice-result">
              <AppIcon name="check" size={18} />
              Paid! Under your RM50 limit.
            </div>
            <small>Pretend only. No money moves.</small>
          </div>
        </>
      )}
      <div className="landing-phone-dock">
        {[
          { icon: "home", label: "Home", active: variant === "home" },
          { icon: "wallet", label: "Wallet" },
          { icon: "send", label: "Send" },
          { icon: "chart", label: "Insights", active: variant === "insights" },
          { icon: "more", label: "More", active: variant === "practice" },
        ].map((item) => (
          <div
            key={item.label}
            className={
              item.label === "Send"
                ? "landing-phone-send"
                : item.active
                  ? "landing-selected"
                  : undefined
            }
          >
            {item.label === "Send" ? (
              <span>
                <AppIcon name={item.icon} size={26} />
              </span>
            ) : (
              <i>
                <AppIcon name={item.icon} size={24} />
              </i>
            )}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
