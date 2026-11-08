# 002 — Demostración animada del NFC en la portada

- **Status**: DONE (sin commit)
- **Commit**: 626f863 (más cambios sin commit de la portada del 8-nov-2026)
- **Severity**: MEDIUM (la mayor oportunidad de la portada)
- **Category**: Oportunidades perdidas (explicación)
- **Estimated scope**: 1 archivo nuevo, 2 archivos editados (~70 líneas)
- **Depende de**: 001

## Problem

La sección NFC explica con solo texto el beneficio que Wontex ya puede ofrecer. Hoy el visitante lee, pero no ve «acerca el celular y listo»:

```tsx
/* src/app/page.tsx:213-224 — actual */
{/* NFC */}
<section className="on-cobalt bg-cobalt text-white">
  <div className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24">
    <h2 className={`${h2} max-w-4xl`}>
      Con NFC: <span className="text-sun">acerca el celular y listo.</span>
    </h2>
    <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/90">
      Tu cliente acerca el celular al lector de tu mostrador y el sello se marca solo, como cuando paga con el teléfono. El QR queda como respaldo.
    </p>
    <p className="mt-4 max-w-3xl text-lg text-white/85">Puedes empezar con QR y pasar a NFC sin perder clientes ni sellos.</p>
  </div>
</section>
```

Es un momento raro (una vez por visita) y explicativo, así que puede durar más de 300 ms.

## Target

Una ilustración decorativa a la derecha del texto (debajo en celular) que, **una sola vez** al entrar en pantalla (50 % visible):

1. Un icono de celular se desliza de izquierda a derecha hasta el lector: 700 ms, `cubic-bezier(0.23, 1, 0.32, 1)`, propiedad `translate`.
2. Un anillo amarillo sale del lector: `scale 1 → 1.6` y `opacity 0.5 → 0`, 600 ms, retraso 650 ms, misma curva.
3. Un sello con palomita aparece sobre el lector con la animación existente `stamp-in` (`globals.css`, 500 ms), retraso 900 ms.

Con `prefers-reduced-motion: reduce`: no hay animación; se ve el estado final (celular junto al lector y sello visible, sin anillo). Sin JavaScript: también se ve el estado final.

## Repo conventions to follow

- Componentes de marketing en `src/components/marketing/` (ej. `wallet-phone.tsx`, que es `"use client"` y usa iconos de `lucide-react`).
- Texto y comentarios en español; clases de Tailwind v4.
- Se anima con las propiedades individuales `translate` y `scale` (como `phone-float` y `reveal-in` en `globals.css`), no con `transform`, para no chocar con las utilidades de Tailwind v4 que también usan `translate`.

## Steps

1. Crear `src/components/marketing/nfc-demo.tsx` con exactamente este contenido:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Nfc, Smartphone } from "lucide-react";

type Fase = "estatico" | "listo" | "reproduce";

/** Ilustración decorativa: el celular se acerca al lector y el sello se marca. Se reproduce una sola vez al entrar en pantalla. */
export function NfcDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<Fase>("estatico");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFase("listo");
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setFase("reproduce");
          observador.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden data-fase={fase} className="nfc-demo relative mx-auto h-56 w-full max-w-sm">
      {/* Lector */}
      <div className="absolute right-4 top-1/2 flex size-28 -translate-y-1/2 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10">
        <Nfc className="size-12 text-white" strokeWidth={1.5} />
      </div>
      {/* Anillo */}
      <div className="absolute right-4 top-1/2 size-28 -translate-y-1/2">
        <span className="nfc-anillo block size-full rounded-2xl border-2 border-sun" />
      </div>
      {/* Celular */}
      <div className="absolute right-40 top-1/2 -translate-y-1/2">
        <span className="nfc-celular flex size-20 items-center justify-center rounded-2xl bg-white text-coal shadow-[0_14px_28px_-12px_rgb(6_10_36/0.6)]">
          <Smartphone className="size-10" strokeWidth={1.5} />
        </span>
      </div>
      {/* Sello */}
      <div className="absolute right-0 top-6">
        <span className="nfc-sello flex size-12 items-center justify-center rounded-full bg-sun text-coal">
          <Check className="size-6" strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}
```

2. En `src/app/globals.css`, al final del archivo, agregar:

```css
/* Demostración NFC: por defecto se ve el estado final (sin JS o con movimiento reducido). */
.nfc-anillo { opacity: 0; }
.nfc-demo[data-fase="listo"] .nfc-celular { translate: -9rem 0; }
.nfc-demo[data-fase="listo"] .nfc-sello { opacity: 0; }
.nfc-demo[data-fase="reproduce"] .nfc-celular { animation: nfc-acercar 700ms var(--ease-ui-out) both; }
.nfc-demo[data-fase="reproduce"] .nfc-anillo { animation: nfc-anillo 600ms var(--ease-ui-out) 650ms both; }
.nfc-demo[data-fase="reproduce"] .nfc-sello { animation: stamp-in 500ms var(--ease-ui-out) 900ms both; }
@keyframes nfc-acercar {
  from { translate: -9rem 0; }
  to { translate: 0 0; }
}
@keyframes nfc-anillo {
  from { opacity: 0.5; scale: 1; }
  to { opacity: 0; scale: 1.6; }
}
```

3. En `src/app/page.tsx`: agregar el import `import { NfcDemo } from "@/components/marketing/nfc-demo";` junto a los otros imports de `@/components/marketing/`.
4. En `src/app/page.tsx`, en la sección NFC, reemplazar el `<div className="reveal ...">` interno por esta estructura (el texto no cambia):

```tsx
<div className="reveal mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
  <div>
    {/* h2 y los dos <p> actuales, sin cambios */}
  </div>
  <NfcDemo />
</div>
```

## Boundaries

- Do NOT cambiar el texto de la sección NFC ni nombrar Apple Wallet / Google Wallet (los detalles del NFC aún no están confirmados).
- Do NOT tocar `wallet-phone.tsx` ni la animación del teléfono del hero.
- Do NOT repetir la animación (sin bucle, sin reiniciar al volver a entrar).
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` sin errores.
- **Feel check**: abrir `http://localhost:3100`, desplazarse hasta la sección azul del NFC y confirmar:
  - Al entrar el 50 % de la ilustración, el celular se desliza hasta el lector y se frena suave (no lineal), luego sale el anillo y aparece el sello. Total cercano a 1,4 s.
  - Subir y volver a bajar no repite la animación.
  - En el panel Animaciones de DevTools a 10 %, el celular no «salta» al empezar (si se ve un salto breve del estado final al inicial al activarse, informar: es el costo conocido de `data-fase="listo"`).
  - Con `prefers-reduced-motion: reduce` (panel Rendering), no hay movimiento y se ve celular + sello juntos al lector.
  - A 375 px de ancho el celular y el lector caben sin desbordar horizontalmente (`document.documentElement.scrollWidth === 375`).
- **Done when**: la animación corre una vez, respeta movimiento reducido y no hay desbordamiento en móvil.
