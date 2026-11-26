"use client";

import { cn, type SeriesPoint } from "@/lib/utils";

export { dailySeries, type SeriesPoint } from "@/lib/utils";

/** Gráfico de barras minimalista de una sola serie (color de marca). */
export function BarChart({ data, height = 180, className }: { data: SeriesPoint[]; height?: number; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const empty = data.every((d) => d.value === 0);
  // La línea del medio está al 50 %: solo lleva número si es exacto (con 1 o 3 visitas quedaría «1, 1, 0»).
  const ticks = empty ? ["", "", "0"] : [String(max), max % 2 === 0 ? String(max / 2) : "", "0"];
  return (
    <div className={cn("flex gap-3", className)}>
      <div className="tabular flex flex-col justify-between pb-5 text-right text-[11px] text-subtle" style={{ height }}>
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative flex items-end gap-[3px] border-b border-line" style={{ height: height - 20 }}>
          {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">Aún no hay visitas en este periodo.</p>}
          {[0.5, 1].map((f) => (
            <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
          ))}
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-[3px] bg-brand/85 transition-colors group-hover:bg-brand"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">
                <span className="tabular font-semibold">{d.value}</span> · {d.label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
          <span>{data[0]?.label}</span>
          <span>{data[Math.floor(data.length / 2)]?.label}</span>
          <span>{data.at(-1)?.label}</span>
        </div>
      </div>
    </div>
  );
}

/** Barras horizontales para distribuciones (p.ej. clientes por nº de sellos). */
export function HBarList({ data, format = (v: number) => String(v) }: { data: SeriesPoint[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[88px_1fr_40px] items-center gap-3 text-[13px]">
          <span className="truncate text-muted">{d.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
            <div className="h-full rounded-full bg-brand/80" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="tabular text-right font-medium">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}
