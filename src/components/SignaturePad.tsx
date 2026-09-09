import { useEffect, useRef, useState } from "react";

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
    ctx.strokeStyle = "#0f172a";
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
    <div>
      <canvas
        ref={ref}
        width={600}
        height={200}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="w-full touch-none rounded-2xl border-2 border-dashed border-charcoal/40 bg-white"
        style={{ aspectRatio: "3 / 1" }}
      />
      <div className="mt-2 flex justify-between font-body text-[11px] text-pewter">
        <span>{hasInk ? "✓ Signed" : "Sign with finger or mouse"}</span>
        <button type="button" onClick={clear} className="font-kid font-bold text-coral">
          Clear
        </button>
      </div>
    </div>
  );
}
