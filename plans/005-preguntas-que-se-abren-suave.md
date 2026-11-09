# 005 — Que las preguntas frecuentes se abran con suavidad

- **Status**: DONE
- **Commit**: 626f863 (más cambios sin commit de la portada del 8-nov-2026)
- **Severity**: LOW
- **Category**: Propósito (indicar el estado)
- **Estimated scope**: 2 archivos, ~20 líneas
- **Depende de**: 001

## Problem

Cada pregunta es un `<details>` nativo: al abrirse, la respuesta aparece de golpe y empuja el resto de la lista. Solo la «+» gira:

```tsx
/* src/app/page.tsx:287-293 — actual */
<details key={f.q} className="group py-5">
  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
    {f.q}
    <span className="text-2xl leading-none text-cobalt transition-transform group-open:rotate-45" aria-hidden>+</span>
  </summary>
  <p className="mt-3 text-[17px] leading-relaxed text-graphite">{f.a}</p>
</details>
```

## Target

Al abrir o cerrar, la respuesta anima **altura (0 ↔ auto) y opacidad en 220 ms** con `var(--ease-ui-out)` (`cubic-bezier(0.23, 1, 0.32, 1)`). La altura no es una propiedad de solo composición, pero aquí es aceptable: es un acordeón ocasional con contenido corto. Solo en navegadores con `interpolate-size` y `::details-content`; en los demás queda igual que hoy. Con `prefers-reduced-motion: reduce`: solo opacidad, 150 ms, sin cambio de altura animado.

## Repo conventions to follow

- Estilos de portada en `src/app/globals.css`, con comentario en español y `@supports` cuando una función no está en todos los navegadores (ejemplo: `.reveal`, `globals.css:77-90`).

## Steps

1. En `src/app/page.tsx:287`, agregar la clase `faq`: `<details key={f.q} className="faq group py-5">`.
2. En `src/app/globals.css`, agregar al final:

```css
/* Preguntas frecuentes: la respuesta se abre con suavidad (solo donde el navegador lo permite). */
@supports (interpolate-size: allow-keywords) {
  :root {
    interpolate-size: allow-keywords;
  }
  details.faq::details-content {
    height: 0;
    opacity: 0;
    overflow: clip;
    transition:
      height 220ms var(--ease-ui-out),
      opacity 220ms var(--ease-ui-out),
      content-visibility 220ms allow-discrete;
  }
  details.faq[open]::details-content {
    height: auto;
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    details.faq::details-content {
      height: auto;
      transition: opacity 150ms var(--ease-ui-out), content-visibility 150ms allow-discrete;
    }
  }
}
```

## Boundaries

- Do NOT cambiar `<details>` por un componente con JavaScript.
- Do NOT cambiar el texto de las preguntas ni la rotación de la «+».
- Do NOT aplicar la regla a otros `<details>` (el selector es `details.faq`).
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` sin errores.
- **Feel check**: en Chrome o Edge recientes, abrir `http://localhost:3100`, ir a las preguntas y confirmar:
  - Al abrir, la respuesta crece y se funde; al cerrar, se recoge. No hay salto de altura al final.
  - Abrir y cerrar rápido varias veces no deja la respuesta cortada.
  - Abrir una pregunta no mueve el scroll de forma brusca.
  - En el panel Animaciones a 10 %, altura y opacidad avanzan juntas.
  - En Firefox o Safari sin soporte, abre de golpe como hoy (no se rompe).
  - Con `prefers-reduced-motion: reduce`, solo hay fundido.
- **Done when**: acordeón suave donde hay soporte, igual que antes donde no, y sin cortes al spamear.
