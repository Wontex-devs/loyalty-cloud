# Etapa 19: código de barras en la tarjeta y «Escanear tarjeta»

**Qué hace:** cada tarjeta lleva al pie un código de barras (Code 128) con un número propio de 12 dígitos. El cliente lo muestra en caja y quien atiende lo escanea con la cámara de su celular desde el panel (**Escanear tarjeta**). Se suma el sello con las reglas de siempre: tiempo mínimo entre visitas, sede, promociones y premios.

## Por qué un número y no el enlace de la tarjeta
- Con una foto del código no se abre nada: el número solo sirve dentro del panel, con sesión, y RLS limita la búsqueda al comercio del usuario.
- Si la cámara no lo lee, se escribe a mano (está debajo de las barras, en grupos de 4).

## Dónde aparece
| Lugar | Cómo |
|---|---|
| Apple Wallet | `barcodes` con `PKBarcodeFormatCode128`, el número debajo (`altText`). |
| Google Wallet | `barcode` tipo `CODE_128`, con `alternateText`. |
| Tarjeta web y vista previa del panel | `CodigoBarras` (SVG propio, sin librerías), negro sobre blanco. |

Los pases ya guardados reciben el código en su próxima actualización (por ejemplo, el siguiente sello).

## Piezas
| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20261101000034_codigo_barras.sql` | Columna `loyalty_cards.scan_code` (12 dígitos, única, se crea sola), códigos para las tarjetas existentes y `scan_code` en `get_public_card`. |
| `src/lib/domain/code128.ts` | Code 128 juego C: símbolos, control y barras. |
| `src/app/business/[slug]/escanear/page.tsx` | Cámara (ZXing, se carga solo al abrirla), resultado en grande y número a mano. |
| `findCardByScanCodeAction` | Busca la tarjeta por número dentro del comercio. |

## Verificado
- Pruebas: Code 128 (estándar), pases de Apple y Google, y en la base: número en tarjetas nuevas, único, en la tarjeta pública, visible solo para el comercio.
- La librería de la cámara leyó el código que dibuja Lazo (482910473365 → 482910473365).

## No verificado
- Escanear con la cámara de un celular real el código en otra pantalla (brillo, distancia).
- Cómo dibujan Apple y Google el código en el pase real.
