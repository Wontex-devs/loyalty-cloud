# 004 — Que los tres pasos de «Así funciona» entren uno por uno

- **Status**: DONE (sin commit)
- **Commit**: 626f863 (más cambios sin commit de la portada del 8-nov-2026)
- **Severity**: LOW
- **Category**: Oportunidades perdidas (explicación, secuencia)
- **Estimated scope**: 1 archivo, 3 líneas

## Problem

Los tres pasos entran juntos, como un solo bloque, porque la clase `reveal` está en el contenedor y no en cada paso. El orden 1 → 2 → 3 es la información de la sección:

```tsx
/* src/app/page.tsx:134-135 — actual */
<div className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24">
  <h2 className={h2}>Así funciona en tu mostrador</h2>
```

```tsx
/* src/app/page.tsx:142 — actual */
<li key={t} className="grid gap-2 py-7 md:grid-cols-[6rem_1fr_1.2fr] md:items-baseline md:gap-6">
```

La clase `.reveal` (`src/app/globals.css:77-90`) usa una línea de tiempo por desplazamiento (`animation-timeline: view()`), así que cada elemento con `reveal` entra cuando llega a pantalla. Al ponerla en cada `<li>` el escalonado sale solo, sin retrasos escritos a mano.

## Target

- El título y cada uno de los tres pasos llevan `reveal`; el contenedor deja de llevarla.
- No se agregan duraciones, retrasos ni keyframes nuevos: se reutiliza `.reveal` tal cual (`opacity 0 → 1`, `translate 0 28px → 0`, rango `entry 0% entry 35%`, solo con `prefers-reduced-motion: no-preference`).

## Repo conventions to follow

- Exemplar: la sección de beneficios usa `reveal` en el contenedor `<section className="reveal mx-auto ...">` (`src/app/page.tsx:153`). Aquí cambia solo el nivel.

## Steps

1. En `src/app/page.tsx:134`, quitar `reveal` del contenedor: `<div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-24">`.
2. En `src/app/page.tsx:135`, cambiar a `<h2 className={`${h2} reveal`}>Así funciona en tu mostrador</h2>`.
3. En `src/app/page.tsx:142`, agregar `reveal` al `className` del `<li>`: `className="reveal grid gap-2 py-7 md:grid-cols-[6rem_1fr_1.2fr] md:items-baseline md:gap-6"`.

## Boundaries

- Do NOT cambiar el texto ni las líneas divisorias (`divide-y-2 divide-coal`) de la lista.
- Do NOT crear animaciones nuevas ni retrasos.
- Do NOT tocar `.reveal` en `globals.css`.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` sin errores.
- **Feel check**: en `http://localhost:3100`, bajar despacio a la sección amarilla y confirmar:
  - Cada paso aparece cuando llega a pantalla, uno tras otro; los tres no entran como bloque.
  - En pantallas altas donde los tres pasos ya están visibles al cargar, no se quedan invisibles (el rango `entry` no deja elementos ocultos que ya están dentro).
  - Con `prefers-reduced-motion: reduce`, todo está visible desde el inicio.
  - Las líneas divisorias de la lista no se parten ni parpadean al moverse los `<li>`.
- **Done when**: los pasos entran en orden y nada queda invisible.
