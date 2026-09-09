import { useState } from "react";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUploadCrop } from "./ImageUploadCrop";

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
  ring: _ring = false,
  className = "",
}: {
  emoji: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const url = isUrl(emoji);
  const isPhosphor = typeof emoji === "string" && emoji.startsWith("phosphor:");

  return (
    <div
      style={{
        width: size,
        minWidth: size,
        height: size,
        border: "1px solid #777",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        padding: "2px",
        textAlign: "center",
      }}
      className={className}
    >
      {url ? (
        <span>[image placeholder]</span>
      ) : isPhosphor ? (
        <span>[icon: {emoji.replace("phosphor:", "").toLowerCase()}]</span>
      ) : (
        <span>{emoji || "[avatar]"}</span>
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
        <AvatarBubble emoji={value} size={48} />
        <button
          type="button"
          onClick={() => {
            sfx.pop();
            setOpen((o) => !o);
          }}
        >
          {open ? "Close" : "Change avatar"}
        </button>
      </div>
      {open && (
        <div className="wireframe-card" style={{ marginTop: "0.5rem" }}>
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
                  {uploading ? "Uploading…" : "[icon: camera] Upload a photo"}
                </button>
                <p style={{ textAlign: "center", fontSize: "0.8rem", margin: "0.25rem 0" }}>
                  or pick an avatar
                </p>
              </div>
              <div className="wireframe-grid-4">
                {list.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      sfx.tap();
                      onChange(e);
                      setOpen(false);
                    }}
                    style={{
                      border: value === e ? "2px solid #000" : "1px solid #ccc",
                      padding: "0.25rem",
                    }}
                  >
                    {e.startsWith("phosphor:")
                      ? `[icon: ${e.replace("phosphor:", "").toLowerCase()}]`
                      : e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
