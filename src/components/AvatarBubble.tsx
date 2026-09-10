import { useState } from "react";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUploadCrop } from "./ImageUploadCrop";
import { AppIcon } from "@/components/ui/app-icon";

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
}: {
  emoji: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const url = isUrl(emoji);
  const isPhosphor = typeof emoji === "string" && emoji.startsWith("phosphor:");
  const iconSize = Math.max(16, Math.round(size * 0.45));

  return (
    <div
      className={`avatar-bubble ${ring ? "avatar-bubble--ring" : ""} ${className}`.trim()}
      style={{ width: size, minWidth: size, height: size, fontSize: iconSize }}
    >
      {url ? (
        <img src={emoji} alt="" className="avatar-bubble__img" />
      ) : isPhosphor ? (
        <AppIcon
          name={emoji}
          size={iconSize}
          color="var(--indigo-velvet)"
          strokeWidth={2.25}
        />
      ) : (
        <span className="avatar-bubble__emoji" aria-hidden>
          {emoji || "🙂"}
        </span>
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
    <div className="wireframe-box">
      <div className="wireframe-row">
        <AvatarBubble emoji={value} size={48} ring />
        <button
          type="button"
          data-variant="secondary"
          onClick={() => {
            sfx.pop();
            setOpen((o) => !o);
          }}
        >
          {open ? "Close" : "Change avatar"}
        </button>
      </div>
      {open && (
        <div className="ui-card" style={{ marginTop: "0.5rem" }}>
          {isCropping ? (
            <ImageUploadCrop
              onSave={handleSaveCrop}
              onCancel={() => setIsCropping(false)}
              busy={uploading}
            />
          ) : (
            <div>
              <div style={{ marginBottom: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsCropping(true)}
                  disabled={uploading}
                  style={{ width: "100%" }}
                >
                  <AppIcon name="camera" size={18} aria-hidden />
                  {uploading ? "Uploading…" : "Upload a photo"}
                </button>
                <p
                  className="text-secondary"
                  style={{ textAlign: "center", fontSize: "0.8rem", margin: "0.5rem 0" }}
                >
                  or pick an avatar
                </p>
              </div>
              <div className="wireframe-grid-4">
                {list.map((e) => {
                  const selected = value === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      data-variant="ghost"
                      aria-label={e.replace("phosphor:", "")}
                      aria-pressed={selected}
                      onClick={() => {
                        sfx.tap();
                        onChange(e);
                        setOpen(false);
                      }}
                      className={selected ? "avatar-pick avatar-pick--selected" : "avatar-pick"}
                    >
                      <AppIcon
                        name={e}
                        size={22}
                        color="var(--indigo-velvet)"
                        strokeWidth={2.25}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
