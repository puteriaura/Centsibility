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
    <div className="wireframe-col">
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
          border: "1px dashed #777",
          background: "#fff",
          touchAction: "none",
        }}
      />
      <div className="wireframe-space-between">
        <small>{hasInk ? "[✓ Signed]" : "Sign with finger or mouse"}</small>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}
