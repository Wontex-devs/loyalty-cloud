# 003 — Animar el cambio de tarjeta en «Con tu marca»

- **Status**: DONE (sin commit)
- **Commit**: 626f863 (más cambios sin commit de la portada del 8-nov-2026)
- **Severity**: MEDIUM
- **Category**: Propósito (evitar un cambio brusco)
- **Estimated scope**: 2 archivos, ~15 líneas
- **Depende de**: 001

## Problem

Al tocar un tipo de negocio, la tarjeta cambia de golpe (colores, logo, textos) y el botón no reacciona al pulsar:

```tsx
/* src/components/marketing/brand-preview.tsx:42-45 — actual */
className={cn(
  "flex h-12 items-center gap-2 rounded-lg border-2 bg-white pl-1.5 pr-3.5 text-[15px] font-semibold transition-colors",
  n === i ? "border-cobalt text-coal" : "border-cobalt/20 text-coal hover:border-cobalt",
)}
```

```tsx
/* src/components/marketing/brand-preview.tsx:53-62 — actual */
<div className="max-w-sm">
  <LoyaltyCardView
    business={{ name: e.name, branding: e.branding }}
    program={{ name: e.club, stampsRequired: e.required, rewardName: e.reward }}
    customerName={e.customer}
    stamps={e.stamps}
    status="active"
    rewardsAvailable={0}
  />
  <p className="mt-3 text-sm text-graphite">Negocios inventados para mostrar la tarjeta.</p>
</div>
```

Es el único momento interactivo de la portada y se ve 2 a 5 veces por visita.

## Target

- La tarjeta entra con `opacity 0 → 1` y `translateY(8px) + scale(0.98) → none` en **220 ms**, curva `cubic-bezier(0.23, 1, 0.32, 1)` (`var(--ease-ui-out)`).
- Con `prefers-reduced-motion: reduce`: solo opacidad, 150 ms, sin desplazamiento ni escala.
- Los botones de negocio hacen `scale(0.97)` al pulsar, 150 ms.

## Repo conventions to follow

- Las animaciones de entrada son utilidades en `src/app/globals.css` con el patrón `.animate-fade-up { animation: ... both; }` (líneas ~100-113). Seguir ese patrón.
- El componente usa `cn()` de `@/lib/utils` para combinar clases.

## Steps

1. En `src/app/globals.css`, agregar al final:

```css
/* Cambio de tarjeta en «Con tu marca». */
@keyframes tarjeta-entra {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
@keyframes tarjeta-entra-suave {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-tarjeta { animation: tarjeta-entra 220ms var(--ease-ui-out) both; }
@media (prefers-reduced-motion: reduce) {
  .animate-tarjeta { animation: tarjeta-entra-suave 150ms var(--ease-ui-out) both; }
}
```

2. En `src/components/marketing/brand-preview.tsx`, envolver solo la tarjeta en un `div` con `key={i}` y la clase nueva (el párrafo «Negocios inventados…» queda fuera para no parpadear):

```tsx
<div className="max-w-sm">
  <div key={i} className="animate-tarjeta">
    <LoyaltyCardView
      business={{ name: e.name, branding: e.branding }}
      program={{ name: e.club, stampsRequired: e.required, rewardName: e.reward }}
      customerName={e.customer}
      stamps={e.stamps}
      status="active"
      rewardsAvailable={0}
    />
  </div>
  <p className="mt-3 text-sm text-graphite">Negocios inventados para mostrar la tarjeta.</p>
</div>
```

3. En el mismo archivo, cambiar en el `className` del botón `transition-colors` por `transition-[color,border-color,transform] duration-150 active:scale-[0.97]`.

## Boundaries

- Do NOT modificar `LoyaltyCardView` (`src/components/loyalty/loyalty-card.tsx`) ni los datos de `EXAMPLES`.
- Do NOT cambiar la estructura de los botones de selección.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` sin errores.
- **Feel check**: en `http://localhost:3100`, bajar a «Con tu marca» y confirmar:
  - Al tocar «Uñas», «Cafetería», etc., la tarjeta nueva aparece con un fundido corto y sube apenas; no se siente lenta.
  - Tocar varias veces seguidas no deja la tarjeta a medias ni invisible (cada toque reinicia la entrada de la tarjeta nueva).
  - En el panel Animaciones a 10 %, el movimiento es sutil (8 px) y la tarjeta nunca arranca desde escala 0.
  - El botón se hunde ligeramente al mantener pulsado.
  - Con `prefers-reduced-motion: reduce`, hay solo fundido.
- **Done when**: la tarjeta se anima al cambiar, el texto «Negocios inventados…» no parpadea y el movimiento reducido solo deja opacidad.
