# 006 — Respuesta al pulsar en los botones de la portada

- **Status**: DONE (sin commit)
- **Commit**: 626f863 (más cambios sin commit de la portada del 8-nov-2026)
- **Severity**: LOW
- **Category**: Propósito (respuesta al toque)
- **Estimated scope**: 1 archivo, 3 líneas

## Problem

Los botones de la portada suben 2 px al pasar el cursor, pero no reaccionan al pulsar, así que el toque se siente «mudo»:

```tsx
/* src/app/page.tsx:27 — actual */
const btn = "inline-flex h-14 items-center justify-center gap-2.5 rounded-lg px-6 text-base font-semibold transition-transform hover:-translate-y-0.5";
```

```tsx
/* src/app/page.tsx:76 — actual (botón del encabezado) */
className="inline-flex h-10 items-center gap-2 rounded-lg bg-sun px-4 font-semibold text-coal transition-transform hover:-translate-y-0.5"
```

```tsx
/* src/app/page.tsx:270 — actual (botón de cada plan) */
className={`mt-6 flex h-12 items-center justify-center rounded-lg px-4 font-semibold transition-transform hover:-translate-y-0.5 ${
```

Nota: el `hover:` de Tailwind v4 ya solo se aplica en dispositivos con cursor (`@media (hover: hover)`), así que en celular el elevado no se queda pegado; solo falta el estado `:active`.

## Target

Los tres botones se hunden a `scale(0.97)` al pulsar, con `transition-transform` en 150 ms y la curva `ease-out` de Tailwind. El elevado al pasar el cursor no cambia.

## Repo conventions to follow

- Clases de Tailwind v4 en línea (ejemplo: el botón del encabezado, `page.tsx:76`). En v4, `translate` y `scale` son propiedades separadas, así que `hover:-translate-y-0.5` y `active:scale-[0.97]` no chocan.

## Steps

1. En `src/app/page.tsx:27`, reemplazar `transition-transform hover:-translate-y-0.5` por `transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]`.
2. En `src/app/page.tsx:76`, reemplazar el mismo fragmento por el mismo texto nuevo.
3. En `src/app/page.tsx:270`, reemplazar el mismo fragmento por el mismo texto nuevo (dentro de la plantilla de texto, antes de `${`).

## Boundaries

- Do NOT cambiar tamaños, colores ni textos de los botones.
- Do NOT tocar botones de otras páginas ni `src/components/ui/index.tsx` (esos son del panel, no de la portada).
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` sin errores.
- **Feel check**: en `http://localhost:3100`, mantener pulsado «Quiero mi primer mes gratis», «Ver la demo» y el botón de un plan y confirmar:
  - Se hunden apenas (3 %) y vuelven al soltar; no se sienten lentos.
  - El elevado al pasar el cursor sigue igual.
  - El texto no se desenfoca ni se mueve el diseño de alrededor.
  - Con `prefers-reduced-motion: reduce`, el hundimiento es tan pequeño que puede quedarse (es retroalimentación, no movimiento decorativo).
- **Done when**: los tres botones tienen respuesta al pulsar y nada más cambió.
