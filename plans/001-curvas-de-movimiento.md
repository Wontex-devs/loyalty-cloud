# 001 — Definir las curvas de movimiento compartidas

- **Status**: DONE
- **Commit**: 626f863 (más cambios sin commit de la portada del 8-nov-2026: `src/app/page.tsx`, `src/components/marketing/wallet-phone.tsx`, `src/app/globals.css`)
- **Severity**: LOW (pero es requisito de los planes 002 a 005)
- **Category**: Cohesión y tokens
- **Estimated scope**: 1 archivo, 5 líneas

## Problem

`src/app/globals.css` no tiene variables de curva ni de duración. Las animaciones existentes escriben la curva a mano:

```css
/* src/app/globals.css:107 — actual */
.animate-fade-up { animation: fade-up 0.25s ease-out both; }
/* src/app/globals.css:113 — actual */
.animate-toast-in { animation: toast-in 0.35s ease-out both; }
```

Los planes 002 a 005 necesitan una curva de salida fuerte compartida. No se puede llamar `--ease-out`: Tailwind v4 ya define `--ease-out` en su tema y la utilidad `ease-out` la usa, así que sobrescribirla cambiaría el comportamiento de clases existentes.

## Target

Agregar en `src/app/globals.css`, justo después del bloque `@theme { ... }` (que termina antes de `html {`), este bloque exacto:

```css
/* Curvas de movimiento de la interfaz (nombres propios para no pisar `--ease-out` de Tailwind). */
:root {
  --ease-ui-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-ui-in-out: cubic-bezier(0.77, 0, 0.175, 1);
}
```

## Repo conventions to follow

- Los tokens de color y sombra viven en el bloque `@theme` de `src/app/globals.css:3-39`. Las curvas van en `:root` aparte, por la razón de arriba.
- Comentarios en español.

## Steps

1. Abrir `src/app/globals.css`, ubicar el cierre `}` del bloque `@theme` y pegar debajo el bloque de la sección Target.
2. No cambiar las animaciones existentes (`animate-fade-up`, `animate-toast-in`, `stamp-in`, etc.).

## Boundaries

- Do NOT renombrar ni modificar `--ease-out` ni usar `@theme` para las curvas.
- Do NOT tocar otros archivos.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` termina sin errores.
- **Feel check**: no aplica (no cambia ningún movimiento visible). Abrir la portada y confirmar que nada se ve distinto.
- **Done when**: `grep -n "ease-ui-out" src/app/globals.css` muestra la definición y la portada se ve igual.
