import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useParentData } from "@/hooks/use-parent-data";
import { useAuth } from "@/providers/auth";
import {
  edgeParentSetHibah,
  edgeParentSetPin,
  edgeParentGetPin,
  edgeParentSetAvatar,
  edgeParentSetSelfAvatar,
  edgeParentGetSelfAvatar,
} from "@/lib/edge";
import { saveQuickLogin, getQuickLogin, clearQuickLogin } from "@/lib/quick-login";
import { toast } from "sonner";
import { AvatarPicker } from "@/components/AvatarBubble";
import { sfx } from "@/lib/sounds";
import { CheckCircle } from "@phosphor-icons/react";

export const Route = createFileRoute("/parent/settings")({
  head: () => ({ meta: [{ title: "Settings — Centsibility" }] }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const { kids, loading, refresh } = useParentData();
  const [editing, setEditing] = useState<string | null>(null);
  const [custom, setCustom] = useState(5);
  const [pin, setPin] = useState("");
  const [pwd, setPwd] = useState("");
  const [hasQuick, setHasQuick] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [selfAvatar, setSelfAvatar] = useState("phosphor:User");

  useEffect(() => {
    setHasQuick(!!getQuickLogin());
    edgeParentGetPin().then((res) => setHasPin(!!res.pin_hash));
    edgeParentGetSelfAvatar().then((res) => res.avatar && setSelfAvatar(res.avatar));
  }, []);

  const updateSelfAvatar = async (a: string) => {
    setSelfAvatar(a);
    sfx.pop();
    try {
      await edgeParentSetSelfAvatar({ avatar: a });
      toast.success("Avatar updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };
  const updateKidAvatar = async (kidId: string, a: string) => {
    sfx.pop();
    try {
      await edgeParentSetAvatar({ kidId, avatar: a });
      toast.success("Avatar updated");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const setRate = async (kidId: string, rate: number) => {
    try {
      await edgeParentSetHibah({ kidId, rate });
      toast.success("Hibah rate updated");
      refresh();
      setEditing(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }
    if (!pwd) {
      toast.error("Confirm your password to enable PIN login");
      return;
    }
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
      const hashed = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      await edgeParentSetPin({ pin_hash: hashed });
      saveQuickLogin({ email: user!.email!, password: pwd, pin });
      setHasQuick(true);
      setHasPin(true);
      setPin("");
      setPwd("");
      toast.success("PIN set! Use it on next login.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const removePin = () => {
    clearQuickLogin();
    setHasQuick(false);
    toast.success("Quick login removed");
  };

  if (loading)
    return (
      <AppShell mode="parent">
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </AppShell>
    );

  const presets = [0.0, 0.025, 0.05, 0.1, 0.15];

  return (
    <AppShell mode="parent">
      <h1 className="font-parent text-2xl font-bold text-charcoal">Settings</h1>

      <SectionTitle>Your avatar</SectionTitle>
      <Card>
        <AvatarPicker value={selfAvatar} onChange={updateSelfAvatar} kind="parent" />
      </Card>

      <SectionTitle>Children avatars</SectionTitle>
      <div className="space-y-3">
        {kids.map((k) => (
          <Card key={`av-${k.id}`} className="shadow-sm">
            <div className="font-parent font-semibold text-charcoal mb-2">{k.name}</div>
            <AvatarPicker
              value={k.avatar ?? "phosphor:Smiley"}
              onChange={(a) => updateKidAvatar(k.id, a)}
              kind="kid"
            />
          </Card>
        ))}
      </div>

      <SectionTitle>Quick PIN login</SectionTitle>
      <Card>
        <p className="font-body text-xs text-pewter">
          Set a 4-6 digit PIN to skip typing your password on this device.
        </p>
        {hasQuick ? (
          <div className="mt-3 flex items-center justify-between bg-emerald-halal/5 p-3 rounded-2xl border border-emerald-halal/20">
            <span className="font-kid text-sm text-emerald-halal flex items-center gap-1.5">
              <CheckCircle weight="fill" className="w-4 h-4" /> PIN active on this device
            </span>
            <button
              onClick={removePin}
              className="btn-press rounded-[1.25rem] border border-border bg-card px-4 py-2 font-parent text-xs font-semibold text-coral shadow-sm"
            >
              Remove
            </button>
          </div>
        ) : (
          <form onSubmit={savePin} className="mt-3 space-y-2">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Choose PIN (4-6 digits)"
              inputMode="numeric"
              maxLength={6}
              className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 font-mono tracking-widest"
            />
            <input
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              type="password"
              placeholder="Confirm your password"
              className="w-full rounded-[1.25rem] border border-border bg-card px-4 py-3 font-body text-sm focus:border-emerald-halal focus:outline-none"
            />
            <button className="btn-press w-full rounded-[1.25rem] bg-emerald-halal py-3.5 font-parent text-sm font-bold text-white shadow-soft">
              {hasPin ? "Update PIN" : "Set PIN"}
            </button>
          </form>
        )}
      </Card>

      <SectionTitle>Hibah rate per child (gift, not interest)</SectionTitle>
      <div className="space-y-3">
        {kids.map((k) => (
          <Card key={k.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-parent font-semibold text-charcoal">{k.name}</div>
                <div className="font-body text-[11px] text-pewter">
                  Code: <span className="font-mono font-bold">{k.login_code}</span>
                </div>
              </div>
              <div className="font-mono text-2xl font-bold text-emerald-halal">
                {(Number(k.hibah_rate) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(k.id, r)}
                  className={`rounded-2xl px-3 py-1.5 font-parent text-xs font-semibold transition ${
                    Math.abs(Number(k.hibah_rate) - r) < 0.001
                      ? "bg-emerald-halal text-white"
                      : "bg-cream text-slate-parent"
                  }`}
                >
                  {(r * 100).toFixed(1)}%
                </button>
              ))}
              <button
                onClick={() => setEditing(editing === k.id ? null : k.id)}
                className="rounded-2xl bg-charcoal px-3 py-1.5 font-parent text-xs font-semibold text-white"
              >
                Custom
              </button>
            </div>
            {editing === k.id && (
              <div className="mt-3 rounded-2xl bg-cream p-3">
                <div className="mb-3 text-center font-mono text-3xl font-bold text-charcoal">
                  {custom.toFixed(1)}%
                </div>
                {/* Step buttons for custom rate — no slider */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {[0.5, 1, 2, 5].map((step) => (
                    <button
                      key={`-${step}`}
                      type="button"
                      onClick={() => setCustom((v) => Math.max(0, +(v - step).toFixed(1)))}
                      className="rounded-xl bg-card border border-border py-1.5 font-mono text-xs font-bold text-coral active:scale-95 transition"
                    >
                      −{step}
                    </button>
                  ))}
                  {[0.5, 1, 2, 5].map((step) => (
                    <button
                      key={`+${step}`}
                      type="button"
                      onClick={() => setCustom((v) => Math.min(20, +(v + step).toFixed(1)))}
                      className="rounded-xl bg-card border border-border py-1.5 font-mono text-xs font-bold text-emerald-halal active:scale-95 transition"
                    >
                      +{step}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-center font-body text-[10px] text-pewter">
                  Range: 0% – 20%
                </p>
                <button
                  onClick={() => setRate(k.id, custom / 100)}
                  className="btn-press w-full rounded-[1.25rem] bg-emerald-halal py-3 font-parent text-sm font-bold text-white shadow-soft mt-1"
                >
                  Set {custom.toFixed(1)}%
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <SectionTitle>Shariah compliance</SectionTitle>
      <Card className="bg-emerald-halal/5 border border-emerald-halal/30 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <CheckCircle weight="fill" className="w-6 h-6 text-emerald-halal shrink-0" />
          </div>
          <div>
            <div className="font-parent font-semibold text-emerald-halal">
              Reviewed by Shariah scholars
            </div>
            <div className="mt-1 font-body text-xs text-slate-parent">
              Free of riba. Qard loans carry no interest or penalty fees. Hibah is a voluntary gift.
              Zakat auto-calculated at 2.5% above Nisab.
            </div>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
