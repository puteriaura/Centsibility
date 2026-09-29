import { useEffect, useState } from "react";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUploadCrop } from "./ImageUploadCrop";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_KID_AVATAR, DEFAULT_PARENT_AVATAR, resolveAvatar } from "@/lib/avatar";

const KID_AVATARS = [
  "phosphor:Smiley",
  "phosphor:Cat",
  "phosphor:Dog",
  "phosphor:Bird",
  "phosphor:Butterfly",
  "phosphor:Crown",
  "phosphor:Rocket",
  "phosphor:Star",
  "phosphor:Planet",
  "phosphor:GameController",
  "phosphor:Heart",
  "phosphor:MusicNote",
  "phosphor:Palette",
  "phosphor:Lightning",
  "phosphor:Moon",
  "phosphor:Sun",
];
const PARENT_AVATARS = [
  "phosphor:User",
  "phosphor:Users",
  "phosphor:IdentificationCard",
  "phosphor:ShieldCheck",
  "phosphor:Briefcase",
  "phosphor:Coffee",
  "phosphor:House",
  "phosphor:Tree",
  "phosphor:Mosque",
  "phosphor:BookOpen",
  "phosphor:GraduationCap",
  "phosphor:HandHeart",
];

const isUrl = (v: string) =>
  /^https?:\/\//.test(v) || v.startsWith("/") || v.startsWith("data:image/");

export function AvatarBubble({
  emoji,
  size = 48,
  ring = false,
  className = "",
  kind = "kid",
}: {
  emoji: string;
  size?: number;
  ring?: boolean;
  className?: string;
  kind?: "kid" | "parent";
}) {
  const resolved = resolveAvatar(emoji, kind);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);
  const url = isUrl(resolved) && !imgFailed;
  const fallbackToken = kind === "parent" ? DEFAULT_PARENT_AVATAR : DEFAULT_KID_AVATAR;
  const iconToken = url ? null : resolved.startsWith("phosphor:") ? resolved : fallbackToken;
  const iconSize = Math.max(16, Math.round(size * 0.45));

  return (
    <div
      className={`avatar-bubble ${ring ? "avatar-bubble--ring" : ""} ${className}`.trim()}
      style={{ width: size, minWidth: size, height: size, fontSize: iconSize }}
      aria-hidden
    >
      {url ? (
        <img
          src={resolved}
          alt=""
          className="avatar-bubble__img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <AppIcon
          name={iconToken ?? fallbackToken}
          size={iconSize}
          color="var(--indigo-velvet)"
          strokeWidth={2.25}
        />
      )}
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
  kind = "kid",
}: {
  value: string;
  onChange: (v: string) => void;
  kind?: "kid" | "parent";
}) {
  const [open, setOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const list = kind === "kid" ? KID_AVATARS : PARENT_AVATARS;
  const display = resolveAvatar(value, kind);

  const handleSaveCrop = async (base64: string) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const res = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], `avatar-${Date.now()}.webp`, { type: "image/webp" });

      const path = `${u.user.id}/${kind}-${Date.now()}.webp`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      sfx.pop();
      onChange(data.publicUrl);
      setOpen(false);
      setIsCropping(false);
      toast.success("Photo updated!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AvatarBubble emoji={display} size={48} ring kind={kind} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            sfx.pop();
            setOpen((o) => !o);
          }}
        >
          {open ? "Close" : "Change avatar"}
        </Button>
      </div>
      {open && (
        <Card variant="default" className="mt-2 p-4 border border-[var(--border)] shadow-md">
          {isCropping ? (
            <ImageUploadCrop
              onSave={handleSaveCrop}
              onCancel={() => setIsCropping(false)}
              busy={uploading}
            />
          ) : (
            <div className="space-y-3">
              <div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCropping(true)}
                  disabled={uploading}
                  className="w-full justify-center"
                >
                  <AppIcon name="camera" size={16} />
                  {uploading ? "Uploading…" : "Upload a photo"}
                </Button>
                <p className="text-center text-xs text-[var(--text-secondary)] my-2">
                  or pick an avatar icon
                </p>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {list.map((e) => {
                  const selected = value === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      aria-label={e.replace("phosphor:", "")}
                      aria-pressed={selected}
                      onClick={() => {
                        sfx.tap();
                        onChange(e);
                        setOpen(false);
                      }}
                      className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer border min-h-[44px] ${
                        selected
                          ? "bg-[var(--surface-pink)] border-[var(--primary)] text-[var(--primary-text)] shadow-xs"
                          : "bg-white border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-soft)]"
                      }`}
                    >
                      <AppIcon
                        name={e}
                        size={22}
                        color={selected ? "var(--primary)" : "var(--ink)"}
                        strokeWidth={2.25}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

