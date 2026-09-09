import { useRef, useState } from "react";
import { sfx } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUploadCrop } from "./ImageUploadCrop";

import * as Phosphor from "@phosphor-icons/react";

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
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className={`grid place-items-center rounded-full overflow-hidden bg-gradient-to-br from-sunny via-mint to-sky shadow-soft ${ring ? "ring-2 ring-emerald-halal ring-offset-2 ring-offset-background" : ""} ${className}`}
    >
      {url ? (
        <img src={emoji} alt="avatar" className="w-full h-full object-cover" />
      ) : isPhosphor ? (
        (() => {
          const iconName = emoji.replace("phosphor:", "");
          const Icon = (Phosphor as any)[iconName] || Phosphor.User;
          return <Icon weight="duotone" className="w-3/5 h-3/5 text-charcoal/80 drop-shadow-sm" />;
        })()
      ) : (
        <span aria-hidden>{emoji}</span>
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
    <div>
      <button
        type="button"
        onClick={() => {
          sfx.pop();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-2"
      >
        <AvatarBubble emoji={value} size={56} />
        <span className="font-kid text-xs font-bold text-emerald-halal underline">Change</span>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl bg-card p-3 shadow-soft border border-border space-y-3">
          {isCropping ? (
            <ImageUploadCrop
              onSave={handleSaveCrop}
              onCancel={() => setIsCropping(false)}
              busy={uploading}
            />
          ) : (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => setIsCropping(true)}
                  disabled={uploading}
                  className="w-full rounded-2xl bg-emerald-halal py-2.5 font-parent text-sm font-bold text-white disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "📷 Upload a photo"}
                </button>
                <p className="mt-1 text-center font-body text-[10px] text-pewter">
                  or pick an emoji avatar
                </p>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {list.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      sfx.tap();
                      onChange(e);
                      setOpen(false);
                    }}
                    className={`grid place-items-center aspect-square rounded-[1.25rem] text-2xl transition ${value === e ? "bg-emerald-halal/20 ring-2 ring-emerald-halal" : "bg-cream hover:bg-sunny/40 shadow-sm border border-border"}`}
                  >
                    {e.startsWith("phosphor:")
                      ? (() => {
                          const iconName = e.replace("phosphor:", "");
                          const Icon = (Phosphor as any)[iconName] || Phosphor.User;
                          return <Icon weight="duotone" className="w-3/5 h-3/5 text-charcoal/80" />;
                        })()
                      : e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
