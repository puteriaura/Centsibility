import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
        <div>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </AppShell>
    );

  const presets = [0.0, 0.025, 0.05, 0.1, 0.15];

  return (
    <AppShell mode="parent">
      <h1>Settings</h1>

      <h2>Your avatar</h2>
      <section>
        <AvatarPicker value={selfAvatar} onChange={updateSelfAvatar} kind="parent" />
      </section>

      <h2>Children avatars</h2>
      <div>
        {kids.map((k) => (
          <section key={`av-${k.id}`}>
            <div><strong>{k.name}</strong></div>
            <AvatarPicker
              value={k.avatar ?? "phosphor:Smiley"}
              onChange={(a) => updateKidAvatar(k.id, a)}
              kind="kid"
            />
          </section>
        ))}
      </div>

      <h2>Quick PIN login</h2>
      <section>
        <p>Set a 4-6 digit PIN to skip typing your password on this device.</p>
        {hasQuick ? (
          <div>
            <span>[✓] PIN active on this device</span>
            <button onClick={removePin}>Remove</button>
          </div>
        ) : (
          <form onSubmit={savePin}>
            <div>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Choose PIN (4-6 digits)"
                inputMode="numeric"
                maxLength={6}
              />
            </div>
            <div>
              <input
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                type="password"
                placeholder="Confirm your password"
              />
            </div>
            <button type="submit">
              {hasPin ? "Update PIN" : "Set PIN"}
            </button>
          </form>
        )}
      </section>

      <h2>Hibah rate per child (gift, not interest)</h2>
      <div>
        {kids.map((k) => (
          <section key={k.id}>
            <div>
              <div>
                <strong>{k.name}</strong>
                <div>
                  Code: <code>{k.login_code}</code>
                </div>
              </div>
              <div>
                <strong>{(Number(k.hibah_rate) * 100).toFixed(1)}%</strong>
              </div>
            </div>
            <div>
              {presets.map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(k.id, r)}
                >
                  {Math.abs(Number(k.hibah_rate) - r) < 0.001
                    ? `[ ${(r * 100).toFixed(1)}% ]`
                    : `${(r * 100).toFixed(1)}%`}
                </button>
              ))}
              <button
                onClick={() => setEditing(editing === k.id ? null : k.id)}
              >
                Custom
              </button>
            </div>
            {editing === k.id && (
              <div>
                <div>{custom.toFixed(1)}%</div>
                <div>
                  {[0.5, 1, 2, 5].map((step) => (
                    <button
                      key={`-${step}`}
                      type="button"
                      onClick={() => setCustom((v) => Math.max(0, +(v - step).toFixed(1)))}
                    >
                      −{step}
                    </button>
                  ))}
                  {[0.5, 1, 2, 5].map((step) => (
                    <button
                      key={`+${step}`}
                      type="button"
                      onClick={() => setCustom((v) => Math.min(20, +(v + step).toFixed(1)))}
                    >
                      +{step}
                    </button>
                  ))}
                </div>
                <p>Range: 0% – 20%</p>
                <button onClick={() => setRate(k.id, custom / 100)}>
                  Set {custom.toFixed(1)}%
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      <h2>Shariah compliance</h2>
      <section>
        <div>
          <span>[✓]</span>
          <div>
            <div><strong>Reviewed by Shariah scholars</strong></div>
            <p>
              Free of riba. Qard loans carry no interest or penalty fees. Hibah is a voluntary gift.
              Zakat auto-calculated at 2.5% above Nisab.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
