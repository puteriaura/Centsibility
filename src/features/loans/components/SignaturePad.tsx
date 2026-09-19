import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const sx = ref.current!.width / r.width;
    const sy = ref.current!.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const up = () => {
    if (drawing) {
      setDrawing(false);
      onChange(ref.current!.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
      <div className="flex flex-col gap-2">
        <canvas
          ref={ref}
          width={600}
          height={200}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          style={{
            width: "100%",
            aspectRatio: "3 / 1",
            border: "1.5px dashed var(--border)",
            borderRadius: "12px",
            background: "#fff",
            touchAction: "none",
          }}
        />
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1">
            {hasInk ? (
              <span className="text-[var(--success)] font-semibold flex items-center gap-1">
                <AppIcon name="approve" size={14} /> Signed
              </span>
            ) : (
              "Sign with finger or stylus above"
            )}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={clear} className="text-xs">
            Clear Signature
          </Button>
        </div>
      </div>
    );
  }

