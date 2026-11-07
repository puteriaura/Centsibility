import { InstallHint } from "@/components/InstallHint";
import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useParentData } from "@/hooks/use-parent-data";
import { useAuth } from "@/providers/auth";
import {
  edgeParentSetHibah,
  edgeParentSetPin,
  edgeParentGetPin,
  edgeParentClearPin,
  edgeParentSetAvatar,
  edgeParentSetSelfAvatar,
  edgeParentGetSelfAvatar,
  clearParentPinSession,
} from "@/lib/edge";
import { setParentBypassed } from "@/lib/admin-bypass";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AvatarBubble, AvatarPicker } from "@/components/AvatarBubble";
import { DEFAULT_PARENT_AVATAR, resolveAvatar } from "@/lib/avatar";
import { sfx, isMuted, toggleMute } from "@/lib/sounds";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/ui/app-icon";
import { ParentLoadError } from "@/features/parent/components/ParentLoadError";
import { parentDisplayName } from "@/lib/display-name";

export const Route = createFileRoute("/parent/settings")({
  head: () => ({ meta: [{ title: "Settings | Centsibility" }] }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const { kids, loading, error, hasLoaded, lastLoadedAt, refresh } =
    useParentData();
  const [editing, setEditing] = useState<string | null>(null);
  const [custom, setCustom] = useState(5);
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [selfAvatar, setSelfAvatar] = useState(DEFAULT_PARENT_AVATAR);
  const [kidAvatarQuery, setKidAvatarQuery] = useState("");
  const [muted, setMuted] = useState(isMuted());
  const [comfortName, setComfortName] = useState(
    (user?.user_metadata as { comfort_name?: string })?.comfort_name ?? "",
  );
  const [savingName, setSavingName] = useState(false);
  const [panel, setPanel] = useState<
    null | "profile" | "kids" | "pin" | "prefs" | "hibah"
  >(null);

  useEffect(() => {
    if ((user?.user_metadata as { comfort_name?: string })?.comfort_name) {
      setComfortName(
        (user?.user_metadata as { comfort_name: string }).comfort_name,
      );
    }
  }, [user]);

  const updateComfortName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = comfortName.trim();
    if (!trimmed) {
      toast.error("Please enter a comfort name");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { comfort_name: trimmed },
      });
      if (error) throw error;
      sfx.success();
      toast.success(`Comfort name updated to "${trimmed}"`);
    } catch (err: unknown) {
      sfx.error();
      toast.error(
        err instanceof Error ? err.message : "Failed to update comfort name",
      );
    } finally {
      setSavingName(false);
    }
  };

  useEffect(() => {
    let active = true;
    void edgeParentGetPin()
      .then((res) => {
        if (active) setHasPin(res.hasPin);
      })
      .catch(() => {
        if (active)
          toast.error(
            "Could not load PIN settings. Open Settings again to retry.",
          );
      });
    void edgeParentGetSelfAvatar()
      .then((res) => {
        if (active && res.avatar)
          setSelfAvatar(resolveAvatar(res.avatar, "parent"));
      })
      .catch(() => {
        if (active)
          toast.error(
            "Could not load your profile picture. Open Settings again to retry.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredKids = useMemo(() => {
    const q = kidAvatarQuery.trim().toLowerCase();
    const sorted = [...kids].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        (k.username ?? "").toLowerCase().includes(q),
    );
  }, [kids, kidAvatarQuery]);

  const doLogout = async () => {
    sfx.tap();
    setParentBypassed(false);
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/login";
  };

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
    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    try {
      await edgeParentSetPin({ pin });
      setHasPin(true);
      setPin("");
      toast.success("Dashboard PIN saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const removePin = async () => {
    if (!/^\d{6}$/.test(currentPin)) {
      toast.error("Enter your 6-digit current PIN to turn off");
      return;
    }
    try {
      await edgeParentClearPin({ currentPin });
      clearParentPinSession();
      sessionStorage.removeItem("parentSessionValidUntil");
      setHasPin(false);
      setCurrentPin("");
      toast.success("Dashboard PIN turned off");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to turn off PIN");
    }
  };

  if (loading && !hasLoaded && !error)
    return (
      <div className="parent-page space-y-4">
        <Skeleton style={{ height: "40px", width: "200px" }} />
        <Skeleton
          style={{ height: "160px", width: "100%", borderRadius: "1.25rem" }}
        />
      </div>
    );

  if (error && !hasLoaded) {
    return (
      <div className="parent-page">
        <ParentLoadError variant="page" onRetry={refresh} message={error} />
      </div>
    );
  }

  const presets = [0.0, 0.025, 0.05, 0.1, 0.15];
  const displayName = parentDisplayName(user);

  return (
    <div className="parent-page settings-page mobile-stack pb-4">
      <InstallHint />
      {error && hasLoaded && (
        <ParentLoadError
          variant="banner"
          onRetry={refresh}
          lastLoadedAt={lastLoadedAt}
        />
      )}
      <div className="settings-profile">
        <div className="settings-profile__identity">
          <AvatarBubble emoji={selfAvatar} size={48} ring kind="parent" />
          <div className="min-w-0">
            <strong className="text-base text-[var(--ink)] block truncate">
              {displayName}
            </strong>
            <span className="text-xs text-[var(--text-muted)] truncate block">
              {user?.email}
            </span>
          </div>
        </div>
      </div>

      <nav aria-label="Settings sections" className="settings-groups">
        {(
          [
            {
              title: "Account & security",
              items: [
                { id: "profile", label: "My profile", icon: "user" },
                { id: "kids", label: "Children avatars", icon: "users" },
                { id: "pin", label: "Dashboard PIN", icon: "lock" },
              ],
            },
            {
              title: "App preferences",
              items: [
                { id: "prefs", label: "Sound & appearance", icon: "settings" },
                { id: "hibah", label: "Hibah preferences", icon: "gift" },
              ],
            },
          ] as const
        ).map((group) => (
          <section key={group.title}>
            <h2 className="settings-group-title">{group.title}</h2>
            <ul className="settings-list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="settings-list__item"
                    aria-expanded={panel === item.id}
                    onClick={() => {
                      sfx.tap();
                      setPanel((p) => (p === item.id ? null : item.id));
                    }}
                  >
                    <span className="settings-list__icon">
                      <AppIcon name={item.icon} size={24} />
                    </span>
                    {item.label}
                    <span className="settings-list__chevron">
                      <AppIcon name="chevron" size={20} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="settings-group-title">Help & information</h2>
          <ul className="settings-list">
            <li>
              <Link to="/parent/penny" className="settings-list__item">
                <span className="settings-list__icon">
                  <AppIcon name="chat" size={24} />
                </span>
                Ask Penny
                <span className="settings-list__chevron">
                  <AppIcon name="chevron" size={20} />
                </span>
              </Link>
            </li>
            <li>
              <Link to="/parent/reports" className="settings-list__item">
                <span className="settings-list__icon">
                  <AppIcon name="filetext" size={24} />
                </span>
                Monthly statements
                <span className="settings-list__chevron">
                  <AppIcon name="chevron" size={20} />
                </span>
              </Link>
            </li>
          </ul>
        </section>
      </nav>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center"
        onClick={doLogout}
      >
        <AppIcon name="exit" size={20} />
        Sign out
      </Button>

      <div className={`settings-panel${panel === "profile" ? " is-open" : ""}`}>
        <Card variant="default" className="m-0 mb-4">
          <CardHeader>
            <CardTitle style={{ fontSize: "1rem" }}>
              Your Comfort Name
            </CardTitle>
            <CardDescription>
              What Centsibility calls you across the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateComfortName} className="space-y-3">
              <Input
                type="text"
                value={comfortName}
                onChange={(e) => setComfortName(e.target.value)}
                placeholder="e.g. Mama, Papa, Ummi, Abi, Coach Dan"
                maxLength={30}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={savingName}
              >
                {savingName ? "Saving..." : "Save Comfort Name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card variant="default" className="m-0">
          <CardHeader>
            <CardTitle style={{ fontSize: "1rem" }}>
              Your profile avatar
            </CardTitle>
            <CardDescription>Upload a photo or pick an icon</CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarPicker
              value={selfAvatar}
              onChange={updateSelfAvatar}
              kind="parent"
            />
          </CardContent>
        </Card>
      </div>

      <div className={`settings-panel${panel === "kids" ? " is-open" : ""}`}>
        <Card variant="default" className="m-0">
          <CardHeader>
            <CardTitle style={{ fontSize: "1rem" }}>Children avatars</CardTitle>
            <CardDescription>Search, then update a child</CardDescription>
          </CardHeader>
          <CardContent
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {hasLoaded && !error && kids.length === 0 ? (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                No children enrolled yet.
              </p>
            ) : (
              <>
                <div className="kid-search">
                  <AppIcon name="users" size={16} />
                  <input
                    type="search"
                    value={kidAvatarQuery}
                    onChange={(e) => setKidAvatarQuery(e.target.value)}
                    placeholder={`Search ${kids.length} children…`}
                    aria-label="Search children for avatar edit"
                  />
                </div>
                {filteredKids.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] m-0 text-center py-3">
                    No match for “{kidAvatarQuery}”.
                  </p>
                ) : (
                  filteredKids.map((k) => (
                    <div
                      key={`av-${k.id}`}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "12px",
                        background: "var(--surface-soft)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.65rem",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarBubble
                            emoji={resolveAvatar(k.avatar, "kid")}
                            size={36}
                            ring
                            kind="kid"
                          />
                          <strong className="truncate text-sm text-[var(--ink)]">
                            {k.name}
                          </strong>
                        </div>
                      </div>
                      <AvatarPicker
                        value={resolveAvatar(k.avatar, "kid")}
                        onChange={(a) => updateKidAvatar(k.id, a)}
                        kind="kid"
                      />
                    </div>
                  ))
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className={`settings-panel${panel === "pin" ? " is-open" : ""}`}>
        <Card variant="default" className="m-0">
          <CardHeader>
            <CardTitle style={{ fontSize: "1rem" }}>Dashboard PIN</CardTitle>
            <CardDescription>
              Asked for whenever the parent dashboard opens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                margin: "0 0 0.85rem",
              }}
            >
              Set a 6-digit PIN. It is stored only as a hash on the server.
            </p>
            {hasPin ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  padding: "0.85rem 1rem",
                  background: "var(--success-soft)",
                  borderRadius: "12px",
                  border: "1px solid rgba(23, 166, 115, 0.2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                  }}
                >
                  <AppIcon name="check" size={18} color="var(--success)" />
                  <strong style={{ fontSize: "0.875rem", color: "var(--ink)" }}>
                    PIN active
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <Input
                    id="settings-current-pin-input"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="Current PIN"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    aria-label="Current PIN"
                    style={{ maxWidth: "140px" }}
                  />
                  <Button variant="danger" size="sm" onClick={removePin}>
                    Turn off PIN
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={savePin}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div>
                  <label
                    htmlFor="settings-pin-input"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "0.3rem",
                    }}
                  >
                    New PIN
                  </label>
                  <Input
                    id="settings-pin-input"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="6 digits"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    aria-required="true"
                  />
                </div>
                <Button type="submit" variant="primary">
                  Save PIN
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <div className={`settings-panel${panel === "prefs" ? " is-open" : ""}`}>
        <Card variant="default" className="m-0">
          <CardContent className="flex flex-col gap-2 pt-4">
            <button
              type="button"
              className="settings-list__item"
              style={{ border: "1px solid var(--border)", borderRadius: 12 }}
              onClick={() => {
                sfx.tap();
                setMuted(toggleMute());
              }}
            >
              <span className="settings-list__icon">
                <AppIcon name={muted ? "soundoff" : "soundon"} size={18} />
              </span>
              {muted ? "Unmute sounds" : "Mute sounds"}
            </button>
            <AppearanceSettings />
          </CardContent>
        </Card>
      </div>

      <div className={`settings-panel${panel === "hibah" ? " is-open" : ""}`}>
        <Card variant="default" className="m-0">
          <CardHeader>
            <CardTitle style={{ fontSize: "1rem" }}>Hibah rate</CardTitle>
            <CardDescription>Monthly gift per child</CardDescription>
          </CardHeader>
          <CardContent
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {hasLoaded && !error && kids.length === 0 ? (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                No children enrolled yet.
              </p>
            ) : (
              <>
                {kids.length > 4 && (
                  <div className="kid-search">
                    <AppIcon name="users" size={16} />
                    <input
                      type="search"
                      value={kidAvatarQuery}
                      onChange={(e) => setKidAvatarQuery(e.target.value)}
                      placeholder="Search children…"
                      aria-label="Search children for hibah"
                    />
                  </div>
                )}
                {filteredKids.map((k) => (
                  <div
                    key={k.id}
                    style={{
                      padding: "0.85rem",
                      borderRadius: "12px",
                      background: "var(--surface-soft)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.65rem",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarBubble
                          emoji={resolveAvatar(k.avatar, "kid")}
                          size={32}
                          ring
                          kind="kid"
                        />
                        <strong className="truncate text-sm text-[var(--ink)]">
                          {k.name}
                        </strong>
                      </div>
                      <strong
                        style={{
                          fontSize: "1.1rem",
                          color: "var(--action-text)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {(Number(k.hibah_rate) * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                      }}
                    >
                      {presets.map((r) => {
                        const active =
                          Math.abs(Number(k.hibah_rate) - r) < 0.001;
                        return (
                          <Button
                            key={r}
                            size="sm"
                            variant={active ? "selected" : "outline"}
                            onClick={() => setRate(k.id, r)}
                            style={{ minWidth: "56px" }}
                          >
                            {(r * 100).toFixed(1)}%
                          </Button>
                        );
                      })}
                      <Button
                        size="sm"
                        variant={editing === k.id ? "secondary" : "outline"}
                        onClick={() =>
                          setEditing(editing === k.id ? null : k.id)
                        }
                      >
                        Custom
                      </Button>
                    </div>
                    {editing === k.id && (
                      <div
                        style={{
                          padding: "0.75rem",
                          borderRadius: "10px",
                          background: "var(--surface)",
                          border: "1px solid var(--primary-soft)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                            Custom
                          </span>
                          <strong style={{ color: "var(--action-text)" }}>
                            {custom.toFixed(1)}%
                          </strong>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.35rem",
                          }}
                        >
                          {[0.5, 1, 2, 5].map((step) => (
                            <Button
                              key={`-${step}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setCustom((v) =>
                                  Math.max(0, +(v - step).toFixed(1)),
                                )
                              }
                            >
                              −{step}%
                            </Button>
                          ))}
                          {[0.5, 1, 2, 5].map((step) => (
                            <Button
                              key={`+${step}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setCustom((v) =>
                                  Math.min(20, +(v + step).toFixed(1)),
                                )
                              }
                            >
                              +{step}%
                            </Button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setRate(k.id, custom / 100)}
                        >
                          Apply {custom.toFixed(1)}%
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-[var(--text-muted)] text-center m-0 px-2 leading-relaxed">
        100% free of riba · Qard al-Hasan loans · Hibah is a voluntary gift
      </p>
    </div>
  );
}
