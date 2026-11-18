"use client";

import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector de color como el de Paint: una paleta de colores listos, un recuadro con un
 * circulito para elegir cualquier tono, una barra de matiz, un gotero para copiar un color
 * de cualquier parte de la pantalla (otra página, una foto…) y el código #RRGGBB.
 */

const PALETTE = [
  "#000000", "#3F3F46", "#71717A", "#A1A1AA", "#D4D4D8", "#F4F4F5", "#FFFFFF", "#F1ECE2", "#E7DFD0", "#C8B79A",
  "#7F1D1D", "#B91C1C", "#EF4444", "#F87171", "#FF7A66", "#FDBA74", "#F59E0B", "#FFC928", "#FDE68A", "#FEF3C7",
  "#14532D", "#1E3A2B", "#0F5C4A", "#16A34A", "#4ADE80", "#BFE8D4", "#0E7490", "#06B6D4", "#A5F3FC", "#CFE3FF",
  "#0E1A52", "#1E3A8A", "#1B3FD8", "#3B82F6", "#93C5FD", "#4B2E83", "#7C3AED", "#C4B5FD", "#6D1F3A", "#EC4899",
];

type HSV = { h: number; s: number; v: number };

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

export function hexToHsv(hex: string): HSV {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: HSV) {
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Arrastre con el mouse o el dedo dentro de un elemento: devuelve la posición de 0 a 1. */
function useDrag(onMove: (x: number, y: number) => void, onEnd: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const start = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect();
      onMove(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height));
    };
    move(e);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      onEnd();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return { ref, onPointerDown: start };
}

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [text, setText] = useState(value.toUpperCase());
  const [canPick, setCanPick] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hex = hsvToHex(hsv);

  useEffect(() => setCanPick(typeof window !== "undefined" && !!window.EyeDropper), []);
  // Si el color cambia desde afuera (p. ej. una combinación lista), se sincroniza.
  useEffect(() => {
    if (value.toUpperCase() !== hsvToHex(hsv)) {
      setHsv(hexToHsv(value));
      setText(value.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const set = (next: HSV) => {
    setHsv(next);
    const h = hsvToHex(next);
    setText(h);
    onChange(h);
  };
  const setHex = (h: string) => {
    const up = h.toUpperCase();
    setText(up);
    if (/^#[0-9A-F]{6}$/.test(up)) {
      setHsv(hexToHsv(up));
      onChange(up);
    }
  };

  const sv = useDrag((x, y) => set({ ...hsv, s: x, v: 1 - y }), () => {});
  const hue = useDrag((x) => set({ ...hsv, h: Math.round(x * 359) }), () => {});

  const pickFromScreen = async () => {
    try {
      const res = await new window.EyeDropper!().open();
      setHex(res.sRGBHex.length === 7 ? res.sRGBHex : hsvToHex(hexToHsv(res.sRGBHex)));
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg border border-line-strong bg-surface p-1.5 pr-3 text-left shadow-card transition hover:border-ink/40"
      >
        <span className="size-9 shrink-0 rounded-md ring-1 ring-black/10" style={{ background: hex }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block font-mono text-xs text-muted">{hex}</span>
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-[300px] rounded-2xl border border-line bg-surface p-3 shadow-pop">
          {/* Paleta de colores listos */}
          <div className="grid grid-cols-10 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setHex(c)}
                className={cn("aspect-square rounded-md ring-1 ring-black/10 transition hover:scale-110", hex === c && "ring-2 ring-ink ring-offset-1")}
                style={{ background: c }}
              />
            ))}
          </div>

          {/* Cualquier tono: recuadro (saturación y brillo) y barra de matiz */}
          <div
            {...sv}
            className="relative mt-3 h-36 cursor-crosshair touch-none rounded-lg"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)` }}
          >
            <span
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
            />
          </div>
          <div
            {...hue}
            className="relative mt-3 h-3.5 cursor-pointer touch-none rounded-full"
            style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
          >
            <span
              className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35)]"
              style={{ left: `${(hsv.h / 359) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }}
            />
          </div>

          {/* Código y gotero */}
          <div className="mt-3 flex items-center gap-2">
            <span className="size-8 shrink-0 rounded-md ring-1 ring-black/10" style={{ background: hex }} />
            <input
              value={text}
              onChange={(e) => /^#?[0-9a-fA-F]{0,6}$/.test(e.target.value) && setHex(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
              className="h-8 min-w-0 flex-1 rounded-md border border-line-strong px-2 font-mono text-sm uppercase"
              aria-label="Código del color"
            />
            {canPick && (
              <button
                type="button"
                onClick={pickFromScreen}
                title="Toma un color de cualquier parte de la pantalla: otra página, una foto, tu logo…"
                className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-xs font-medium hover:bg-canvas"
              >
                <Pipette className="size-3.5" /> Gotero
              </button>
            )}
          </div>
          {!canPick && <p className="mt-2 text-[11px] text-muted">Para copiar un color de otra página, pega aquí su código (#RRGGBB). El gotero funciona en Chrome y Edge.</p>}
        </div>
      )}
    </div>
  );
}
