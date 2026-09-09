import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import penny from "@/assets/penny-mascot.png";
import {
  Smiley,
  User,
  CheckCircle,
  Vault,
  Handshake,
  Heart,
  GameController,
  Users,
  BookOpen,
  Money,
  Target,
  RocketLaunch,
  Check,
  Planet,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-gradient-hero overflow-hidden text-starlight">
      {/* Starry background elements */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-stars"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 3 + 2}s`,
            }}
          />
        ))}
      </div>
      <Nav />
      <Hero />
      <TrustStrip />
      <Features />
      <DualMode />
      <Showcase />
      <ShariahPillars />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="relative z-20 mx-auto max-w-7xl px-6 py-6">
      <div className="glass-panel flex items-center justify-between px-6 py-4 rounded-full">
        <a href="/" className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full bg-gradient-halal shadow-neon flex items-center justify-center">
            <Planet weight="fill" className="w-6 h-6 text-void" />
          </div>
          <span className="font-display text-2xl font-bold text-starlight tracking-wide">
            Centsibility
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex font-kid font-semibold text-starlight/70">
          <a
            href="#features"
            className="hover:text-neon-mint transition hover:drop-shadow-[0_0_8px_var(--neon-mint)]"
          >
            Features
          </a>
          <a
            href="#pillars"
            className="hover:text-neon-mint transition hover:drop-shadow-[0_0_8px_var(--neon-mint)]"
          >
            Shariah
          </a>
          <a
            href="#showcase"
            className="hover:text-neon-mint transition hover:drop-shadow-[0_0_8px_var(--neon-mint)]"
          >
            Mission Control
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-full bg-starlight px-6 py-2.5 font-kid font-bold text-sm text-void hover:bg-neon-mint transition shadow-glow-gold"
          >
            Launch →
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Toggle navigation menu"
          >
            <span
              className={`block h-0.5 w-6 bg-starlight transition-transform ${menuOpen ? "rotate-45 translate-y-[8px]" : ""}`}
            />
            <span
              className={`block h-0.5 w-6 bg-starlight transition-opacity ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-0.5 w-6 bg-starlight transition-transform ${menuOpen ? "-rotate-45 -translate-y-[8px]" : ""}`}
            />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="mt-4 flex flex-col gap-3 rounded-3xl glass-panel p-6 md:hidden font-kid font-semibold text-starlight animate-in fade-in slide-in-from-top-4">
          <a
            href="#features"
            onClick={() => setMenuOpen(false)}
            className="hover:text-neon-mint transition py-2"
          >
            Features
          </a>
          <a
            href="#pillars"
            onClick={() => setMenuOpen(false)}
            className="hover:text-neon-mint transition py-2"
          >
            Shariah
          </a>
          <a
            href="#showcase"
            onClick={() => setMenuOpen(false)}
            className="hover:text-neon-mint transition py-2"
          >
            Mission Control
          </a>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-2 md:py-24 md:gap-6 items-center">
      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-neon-mint/40 glass-panel px-4 py-1.5 font-kid text-xs font-bold uppercase tracking-widest text-neon-mint shadow-neon">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-mint animate-pulse" />
          100% Halal Cosmic Journey
        </span>
        <h1 className="mt-8 font-display text-5xl font-bold leading-[1.1] text-starlight md:text-7xl">
          Let's make <span className="text-gradient-brand">cents</span> of your savings!
        </h1>
        <p className="mt-6 max-w-lg font-body text-lg text-starlight/80 leading-relaxed">
          Embark on a galactic adventure! A Shariah-compliant finance app where kids learn through
          Qard, Hibah, Sadaqah and Zakat — and parents command the mission from a high-tech
          dashboard.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/kid-login"
            className="btn-press flex items-center justify-center gap-2 rounded-full bg-neon-mint px-8 py-4 font-kid text-lg font-bold text-void shadow-neon hover:scale-105 transition-transform"
          >
            <RocketLaunch weight="bold" className="w-6 h-6" /> Astronaut Login
          </Link>
          <Link
            to="/login"
            className="btn-press flex items-center justify-center gap-2 rounded-full border-2 border-starlight/20 glass-panel px-8 py-4 font-kid text-lg font-bold text-starlight hover:border-neon-mint hover:text-neon-mint transition"
          >
            <User weight="bold" className="w-6 h-6" /> Command Center
          </Link>
        </div>
      </div>

      <div className="relative flex items-center justify-center h-[500px]">
        {/* Nebulas */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-cosmic-blue/30 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-nebula-pink/20 blur-[60px]" />

        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <img
            src={penny}
            alt="Penny the Astronaut Platypus"
            className="absolute w-[320px] md:w-[450px] animate-float drop-shadow-[0_0_30px_rgba(133,255,200,0.3)] object-contain"
          />
          {/* Floating cosmic cards */}
          <FloatCard
            className="-left-4 top-20 md:-left-12 [animation-delay:0.5s]"
            color="bg-neon-mint text-void"
            title="Transmission"
            subtitle="+RM 5.00 Hibah"
          />
          <FloatCard
            className="-right-2 top-10 md:-right-4 [animation-delay:1.5s]"
            color="bg-starlight text-void"
            title="Quest Complete"
            subtitle="+50 Stardust"
          />
          <FloatCard
            className="bottom-10 left-10 md:bottom-20 md:left-4 [animation-delay:2.5s]"
            color="bg-cosmic-blue text-white"
            title="Orbit Achieved"
            subtitle="Goal 87%"
          />
        </div>
      </div>
    </section>
  );
}

function FloatCard({
  className,
  color,
  title,
  subtitle,
}: {
  className: string;
  color: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className={`absolute z-20 animate-float rounded-2xl glass-panel p-3 pr-6 shadow-neon flex items-center gap-4 ${className}`}
    >
      <div
        className={`h-10 w-10 rounded-xl ${color} grid place-items-center font-display font-bold text-lg`}
      >
        ¢
      </div>
      <div>
        <div className="font-kid text-sm font-bold text-starlight">{title}</div>
        <div className="font-body text-[11px] text-neon-mint">{subtitle}</div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const items = [
    { k: "0%", v: "Riba (Interest)" },
    { k: "2.5%", v: "Zakat Calculator" },
    { k: "6–17", v: "Ages Supported" },
    { k: "AAOIFI", v: "Standards Aligned" },
  ];
  return (
    <section className="border-y border-starlight/10 glass-panel">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.v} className="text-center">
            <div className="font-display text-4xl font-bold text-gradient-brand">{it.k}</div>
            <div className="mt-2 font-kid text-sm tracking-widest uppercase text-starlight/70">
              {it.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: <Vault weight="duotone" className="w-8 h-8" />,
      color: "text-starlight border-starlight/30 bg-starlight/10",
      title: "Hyperdrive Savings",
      text: "Fund your missions with liquid-fill goals and earn Halal Hibah to boost your speed.",
    },
    {
      icon: <Handshake weight="duotone" className="w-8 h-8" />,
      color: "text-cosmic-blue border-cosmic-blue/30 bg-cosmic-blue/10",
      title: "Qard Loans",
      text: "Interest-free digital agreements between commander (parent) and astronaut (kid).",
    },
    {
      icon: <Heart weight="duotone" className="w-8 h-8" />,
      color: "text-neon-mint border-neon-mint/30 bg-neon-mint/10",
      title: "Cosmic Charity",
      text: "Automated 2.5% Zakat calculator and Sadaqah missions to help other galaxies.",
    },
    {
      icon: <GameController weight="duotone" className="w-8 h-8" />,
      color: "text-nebula-pink border-nebula-pink/30 bg-nebula-pink/10",
      title: "Star Quests",
      text: "Daily financial quizzes turn complex lessons into Stardust points and badges.",
    },
    {
      icon: <Users weight="duotone" className="w-8 h-8" />,
      color: "text-nova-red border-nova-red/30 bg-nova-red/10",
      title: "Command Center",
      text: "Approve missions, review flight logs, and configure spending limits safely.",
    },
    {
      icon: <BookOpen weight="duotone" className="w-8 h-8" />,
      color: "text-teal-amanah border-teal-amanah/30 bg-teal-amanah/10",
      title: "Stellar Wisdom",
      text: "Daily quotes and Hadith to guide your journey through the financial cosmos.",
    },
  ];
  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <p className="font-kid text-sm font-bold uppercase tracking-widest text-neon-mint flex items-center gap-2">
          <Planet weight="fill" /> Constellation of Features
        </p>
        <h2 className="mt-4 font-display text-4xl font-bold text-starlight md:text-5xl">
          An entire Halal economy, mapped out.
        </h2>
      </div>
      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <article
            key={it.title}
            className="group relative overflow-hidden rounded-[2rem] glass-panel p-8 transition-all hover:-translate-y-2 hover:shadow-neon"
          >
            <div
              className={`mb-6 inline-flex h-16 w-16 place-items-center justify-center rounded-2xl border ${it.color}`}
            >
              {it.icon}
            </div>
            <h3 className="font-kid text-2xl font-bold text-starlight">{it.title}</h3>
            <p className="mt-3 font-body text-sm leading-relaxed text-starlight/70">{it.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DualMode() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid gap-8 md:grid-cols-2">
        {/* KID */}
        <div className="relative overflow-hidden rounded-[3rem] bg-gradient-kid p-10 text-white shadow-neon">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-[80px]" />
          <span className="rounded-full bg-void/30 backdrop-blur px-4 py-1.5 font-kid text-xs font-bold uppercase tracking-widest border border-white/20">
            Astronaut Mode
          </span>
          <h3 className="mt-8 font-display text-4xl font-bold leading-tight">
            Missions, Stardust, and Real Discovery.
          </h3>
          <ul className="mt-8 space-y-4 font-kid font-semibold text-lg text-white/90">
            <li className="flex items-center gap-3">
              <RocketLaunch weight="fill" className="text-starlight w-6 h-6" /> Liquid-fill fuel
              (goals)
            </li>
            <li className="flex items-center gap-3">
              <GameController weight="fill" className="text-starlight w-6 h-6" /> Quests, badges &
              streaks
            </li>
            <li className="flex items-center gap-3">
              <Smiley weight="fill" className="text-starlight w-6 h-6" /> Penny celebrates every
              deposit
            </li>
          </ul>
          <div className="mt-10 inline-flex items-center gap-4 rounded-3xl bg-void/40 px-6 py-4 backdrop-blur border border-white/10 shadow-inner">
            <span className="font-mono text-3xl font-bold">RM 87.50</span>
            <span className="rounded-full bg-neon-mint/20 text-neon-mint border border-neon-mint/30 px-3 py-1 font-kid text-sm font-bold">
              +RM 2 Hibah
            </span>
          </div>
        </div>

        {/* PARENT */}
        <div className="relative overflow-hidden rounded-[3rem] glass-panel p-10 border border-neon-mint/30 shadow-soft">
          <span className="rounded-full bg-neon-mint/10 border border-neon-mint/30 px-4 py-1.5 font-kid text-xs font-bold uppercase tracking-widest text-neon-mint">
            Command Center
          </span>
          <h3 className="mt-8 font-display text-4xl font-bold text-starlight leading-tight">
            Calm, clear, fully in your hands.
          </h3>
          <ul className="mt-8 space-y-4 font-body text-lg text-starlight/80">
            <li className="flex gap-4">
              <CheckCircle weight="fill" className="w-7 h-7 text-neon-mint shrink-0" /> Approve
              every launch & reward
            </li>
            <li className="flex gap-4">
              <CheckCircle weight="fill" className="w-7 h-7 text-neon-mint shrink-0" /> Flight logs
              (reports) per child
            </li>
            <li className="flex gap-4">
              <CheckCircle weight="fill" className="w-7 h-7 text-neon-mint shrink-0" /> Configure
              Hibah rate & limits
            </li>
          </ul>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              ["Aiman", "RM 142"],
              ["Nur", "RM 89"],
              ["Zayd", "RM 215"],
            ].map(([n, a]) => (
              <div
                key={n}
                className="rounded-[1.5rem] bg-void/50 border border-starlight/10 p-4 text-center"
              >
                <div className="font-kid text-xs font-bold text-starlight/60 uppercase tracking-wider">
                  {n}
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-neon-mint">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="showcase" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="font-kid text-sm font-bold uppercase tracking-widest text-neon-mint">
          Inside the Ship
        </p>
        <h2 className="mt-4 font-display text-4xl font-bold text-starlight md:text-5xl">
          A peek at the dashboard.
        </h2>
      </div>
      <div className="mt-16 mx-auto max-w-md">
        <PhoneMockup />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto rounded-[3.5rem] bg-void p-4 shadow-neon border border-neon-mint/20">
      <div className="rounded-[2.5rem] bg-gradient-to-b from-deep-space to-void p-6 min-h-[600px] border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-cosmic-blue/20 to-transparent" />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="font-kid text-[10px] uppercase tracking-widest text-starlight/60">
              Commander,
            </div>
            <div className="font-display text-2xl font-bold text-starlight">Aiman</div>
          </div>
          <div className="h-12 w-12 rounded-full bg-void border-2 border-neon-mint overflow-hidden p-1 shadow-neon">
            <img src={penny} alt="" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="relative z-10 mt-8 rounded-[2rem] glass-panel p-6 border-neon-mint/30 text-starlight shadow-soft">
          <div className="font-kid text-[10px] font-bold uppercase tracking-widest text-neon-mint">
            Hyperdrive Core
          </div>
          <div className="mt-2 font-mono text-4xl font-bold">RM 142.50</div>
          <div className="mt-4 flex gap-2">
            <span className="rounded-full bg-neon-mint/20 border border-neon-mint/30 px-3 py-1 font-kid text-[10px] font-bold text-neon-mint tracking-wider">
              +RM 5 Hibah
            </span>
            <span className="rounded-full bg-starlight/10 border border-starlight/20 px-3 py-1 font-kid text-[10px] font-bold flex items-center gap-1 tracking-wider">
              100% Halal <Check weight="bold" className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-[1.5rem] glass-panel p-5 text-center flex flex-col items-center hover:bg-white/5 transition">
            <Money weight="duotone" className="w-8 h-8 text-neon-mint" />
            <div className="mt-3 font-kid font-bold text-sm">Deposit</div>
          </div>
          <div className="rounded-[1.5rem] glass-panel p-5 text-center flex flex-col items-center hover:bg-white/5 transition">
            <Target weight="duotone" className="w-8 h-8 text-nebula-pink" />
            <div className="mt-3 font-kid font-bold text-sm">Mission</div>
          </div>
          <div className="rounded-[1.5rem] glass-panel p-5 text-center flex flex-col items-center hover:bg-white/5 transition border-starlight/30">
            <RocketLaunch weight="duotone" className="w-8 h-8 text-starlight" />
            <div className="mt-3 font-kid font-bold text-sm">Quest</div>
          </div>
          <div className="rounded-[1.5rem] glass-panel p-5 text-center flex flex-col items-center hover:bg-white/5 transition">
            <Heart weight="duotone" className="w-8 h-8 text-nova-red" />
            <div className="mt-3 font-kid font-bold text-sm">Sadaqah</div>
          </div>
        </div>

        <div className="relative z-10 mt-6 rounded-[2rem] glass-panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-kid font-bold text-sm text-starlight">Cosmic Bicycle</div>
            <div className="font-mono text-xs font-bold text-neon-mint">87%</div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-void shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-cosmic-blue to-neon-mint shadow-neon rounded-full"
              style={{ width: "87%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShariahPillars() {
  const pillars = [
    { ar: "قَرْض", en: "Qard", text: "Interest-free loans modeled between parent & child." },
    { ar: "هِبَة", en: "Hibah", text: "Voluntary gifts on savings — never guaranteed interest." },
    { ar: "صَدَقَة", en: "Sadaqah", text: "Charitable giving with real impact, tracked monthly." },
    { ar: "زَكَاة", en: "Zakat", text: "Auto-calculated 2.5% on eligible balances above Nisab." },
  ];
  return (
    <section
      id="pillars"
      className="relative border-y border-starlight/10 bg-void py-24 text-starlight overflow-hidden"
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0yMCAwTDIwIDQwTTAgMjBMMDAgMjAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-50" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="font-arabic text-xl text-neon-mint drop-shadow-[0_0_8px_var(--neon-mint)]">
            بِسْمِ اللَّهِ
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
            Built on ancient pillars, ready for the future.
          </h2>
          <p className="mt-6 font-body text-lg text-starlight/70 leading-relaxed">
            Every flow is completely free of Riba and aligned with classical fiqh principles —
            designed in a way that resonates with the explorers of tomorrow.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <div
              key={p.en}
              className="group rounded-[2rem] glass-panel p-8 transition-transform hover:-translate-y-2 hover:border-neon-mint/50"
            >
              <div className="font-arabic text-4xl text-neon-mint group-hover:drop-shadow-[0_0_12px_var(--neon-mint)] transition-all">
                {p.ar}
              </div>
              <div className="mt-4 font-display text-2xl font-bold">{p.en}</div>
              <p className="mt-3 font-body text-sm text-starlight/60 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section id="cta" className="mx-auto max-w-5xl px-6 py-24">
      <div className="relative overflow-hidden rounded-[3rem] bg-gradient-halal p-12 md:p-20 text-center text-void shadow-neon">
        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, black 2px, transparent 2px), radial-gradient(circle at 80% 60%, black 2px, transparent 2px)",
            backgroundSize: "40px 40px, 60px 60px",
          }}
        />
        <div className="relative z-10">
          <h2 className="font-display text-4xl font-bold md:text-6xl tracking-tight">
            Raise a generation that thrives — halal-y.
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-body text-lg text-void/80 font-medium">
            Join the mission and be first to give your kids a financial start that's both
            out-of-this-world and deeply faithful.
          </p>
          {submitted ? (
            <div className="mx-auto mt-10 max-w-md rounded-[2rem] bg-void/10 p-8 backdrop-blur-md border border-void/20">
              <div className="flex justify-center mb-4">
                <CheckCircle weight="fill" className="w-12 h-12 text-void" />
              </div>
              <p className="font-display font-bold text-2xl">Jazakallah khair!</p>
              <p className="font-body text-sm text-void/80 mt-2 font-medium">
                We'll transmit a signal to <span className="font-bold">{email}</span> when
                Centsibility launches.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-10 flex max-w-lg flex-col gap-4 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="commander@space.com"
                className="flex-1 rounded-full bg-void/90 px-6 py-5 font-mono text-starlight placeholder:text-starlight/40 focus:outline-none focus:ring-4 focus:ring-starlight/30 shadow-inner"
              />
              <button
                type="submit"
                className="btn-press rounded-full bg-void px-8 py-5 font-kid text-lg font-bold text-neon-mint shadow-xl hover:bg-void/90 hover:text-white transition"
              >
                Join Crew
              </button>
            </form>
          )}
          <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-void/50 font-bold">
            No spam. Halal data practices. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-void">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-halal shadow-neon">
            <Planet weight="fill" className="w-5 h-5 text-void" />
          </div>
          <span className="font-display text-xl font-bold text-starlight">Centsibility</span>
        </div>
        <p className="font-mono text-xs font-bold text-starlight/40 uppercase tracking-widest">
          © 2026 Centsibility. Let's make cents of your savings.
        </p>
      </div>
    </footer>
  );
}
