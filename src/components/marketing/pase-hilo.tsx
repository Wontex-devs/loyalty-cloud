import { Gift, Scissors } from "lucide-react";
import { hilo } from "@/lib/domain/hilo";

const W = 375;
const H = 144;
const px = (v: number) => `${(v / W) * 100}%`;
const py = (v: number) => `${(v / H) * 100}%`;
const cqw = (v: number) => `${(v / W) * 100}cqw`;

const AZUL = "#1b3fd8";
const SOL = "#ffc928";
const TINTA = "#0e1a52";
const HILO = "rgb(255 201 40 / 0.55)";
const SELLOS = 6;

/**
 * El pase de Barbería El Faro (negocio de ejemplo) para la portada, con el mismo diseño que el
 * pase real de Wallet: conteo arriba, y la franja con el premio y el hilo de sellos.
 * Usa la misma geometría que la tarjeta real (`hilo`), así la portada no promete otra cosa.
 *
 * Cada sello ganado es una capa encima del círculo vacío; quien lo usa decide cómo aparece:
 * `sello(i)` devuelve la referencia, la clase o el estilo de esa capa (animaciones de la portada).
 */
export function PaseHilo({
  contador,
  sello,
  compacto = false,
  className = "",
}: {
  /** Contenido del conteo, p. ej. «5 / 6» o las dos capas que se alternan. */
  contador: React.ReactNode;
  sello: (i: number) => { ref?: (n: Element | null) => void; className?: string; style?: React.CSSProperties };
  /** Más pequeño: para el celular de la historia. */
  compacto?: boolean;
  className?: string;
}) {
  const h = hilo(SELLOS, W, H);
  const etiqueta = "text-[9.5px] leading-tight font-semibold tracking-[0.06em] uppercase";

  return (
    <div className={`overflow-hidden text-white ${className}`} style={{ background: AZUL }}>
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/el-faro.svg" alt="" className={`${compacto ? "size-7" : "size-8"} shrink-0 rounded-full bg-white p-1`} />
          <span className={`truncate font-serif uppercase ${compacto ? "text-[11.5px] tracking-[0.08em]" : "text-[13px] tracking-[0.1em]"}`}>
            {/* En el celular pequeño de la historia no cabe el nombre completo. */}
            {compacto ? "El Faro" : "Barbería El Faro"}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <p className={etiqueta} style={{ color: SOL }}>
            Sellos
          </p>
          <div className="tabular text-[16px] leading-tight">{contador}</div>
        </div>
      </div>

      {/* La franja: el premio y el hilo de sellos */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size" }}>
        <span aria-hidden className="pointer-events-none absolute font-serif leading-none select-none" style={{ left: px(W - 118), top: py(6), fontSize: cqw(190), color: "rgb(255 255 255 / 0.055)" }}>
          B
        </span>
        <p className="absolute font-medium uppercase" style={{ left: px(20), top: py(16), fontSize: cqw(11.5), letterSpacing: "0.19em", lineHeight: 1.2, color: SOL }}>
          Próxima recompensa
        </p>
        <p className="absolute font-serif whitespace-nowrap uppercase" style={{ left: px(20), top: py(33), fontSize: cqw(24), lineHeight: 1.15, letterSpacing: "0.05em" }}>
          Corte gratis
        </p>
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full">
          {h.hilos.map((d) => (
            <path key={d} d={d} fill="none" stroke={HILO} strokeWidth={h.trazo} />
          ))}
        </svg>
        {h.sellos.map((s) => {
          const capa = sello(s.index);
          const r = s.premio ? h.aro : s.r;
          return (
            <span
              key={s.index}
              className="absolute flex aspect-square items-center justify-center rounded-full"
              style={{ left: px(s.x), top: py(s.y), width: px(r * 2), transform: "translate(-50%, -50%)", border: s.premio ? `1px solid ${HILO}` : undefined }}
            >
              <span
                className="relative flex aspect-square items-center justify-center rounded-full"
                style={{ width: s.premio ? `${(s.r / h.aro) * 100}%` : "100%", background: AZUL, border: `1.2px solid ${s.premio ? SOL : "rgb(255 201 40 / 0.6)"}`, color: SOL }}
              >
                {s.premio && <Gift className="size-[52%]" strokeWidth={1.6} />}
                <span
                  ref={capa.ref}
                  className={`absolute -inset-[1.2px] flex items-center justify-center rounded-full ${capa.className ?? ""}`}
                  style={{ background: SOL, color: TINTA, ...capa.style }}
                >
                  {s.premio ? <Gift className="size-[52%]" strokeWidth={1.8} /> : <Scissors className="size-[52%]" strokeWidth={2} />}
                </span>
              </span>
            </span>
          );
        })}
      </div>

      <div className="h-4" />
    </div>
  );
}
