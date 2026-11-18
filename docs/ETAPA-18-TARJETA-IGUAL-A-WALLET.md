# Etapa 18 · La tarjeta web es igual al pase de Wallet («el hilo»)

Fecha: 18 de noviembre de 2026.

## Antes de publicar: aplicar la migración 0030

`supabase/migrations/20261101000030_qr_tarjeta.sql` en `loyalty-cloud-prod` (SQL Editor → pegar → Run).

- Solo cambia la validación de `update_business_profile` para aceptar `passQr` (verdadero o falso). No toca datos.
- Si el código llega antes que la migración, todo funciona menos el interruptor «Mostrar el código QR», que daría error al guardar.

## Qué cambia

**Lo que el comercio ve en la vista previa es lo que el cliente guarda en su billetera.** La tarjeta web, la vista previa del panel y el pase de Apple Wallet tienen ahora la misma forma:

1. **Fila superior:** logo, nombre del comercio y «SELLOS 3 / 8». Es lo único que se ve cuando las tarjetas están apiladas en Wallet.
2. **Franja «el hilo»:** el premio como protagonista, en la letra de la marca, y un hilo fino que enhebra los sellos hasta cerrar en un aro alrededor del premio. De fondo, la inicial del comercio casi transparente.
3. **Datos:** «MIEMBRO», «DESDE» (mes y año de inscripción) y «TU PROGRESO», que es la misma frase que llega como notificación en cada visita.
4. **Código QR** con el número de miembro. Abre la tarjeta del cliente; en caja sirve para confirmar de quién es. El comercio lo puede quitar.

## Qué puede personalizar el comercio

Dos colores (fondo, y sellos y etiquetas), logo o iniciales, letra de la marca (nombre y premio), sello (icono o imagen propia), cantidad de sellos, premio y código QR.

## Límites de Apple Wallet que se respetan

- El pase solo admite tres colores planos (fondo, texto, etiquetas): sin degradados, marcos ni efecto cristal.
- La letra de la marca solo va dentro de las imágenes (logo y franja); los datos usan la letra del iPhone.
- El orden de las piezas es fijo y el QR va siempre sobre un recuadro blanco.
- La franja mide 375 × 144 puntos.

## Cómo está hecho

| Pieza | Archivo |
|---|---|
| Geometría compartida (posición de sellos, hilo, tamaño del premio, número de miembro) | `src/lib/domain/hilo.ts` |
| Imagen de la franja (Apple Wallet y Google Wallet) | `src/components/brand/pass-strip.tsx` |
| Franja de la tarjeta web | `src/components/loyalty/hilo-strip.tsx` |
| Tarjeta web | `src/components/loyalty/loyalty-card.tsx` |
| Campos y QR del pase de Apple | `src/lib/wallet/apple.ts` |
| Interruptor del QR en el panel | `src/app/business/[slug]/card-design/page.tsx` |

- De 2 a 12 sellos van en una fila; de 13 a 30, en dos.
- Un premio de nombre largo pasa a dos líneas más pequeñas; nunca se sale ni tapa los sellos.
- El número de miembro se deriva del token con un resumen, así no deja ver parte del enlace secreto.

## Pruebas

- `tests/hilo.test.ts`: para 2 a 30 sellos, todos caben en la franja sin tocarse ni tapar el premio.
- `tests/apple-wallet.test.ts`: campos nuevos, QR y su retiro.
- `npm run test:db`: 5 pruebas nuevas de `passQr` (349 en total).
- Revisión visual con seis comercios ficticios: tarjeta web e imagen del pase lado a lado, en computador y en celular.

## Pendiente o no verificado

- **En un iPhone real:** no se ha visto el pase nuevo dentro de la app Wallet. Hay que guardar una tarjeta de prueba y revisarla.
- **Google Wallet:** usa la misma imagen del hilo, pero el resto del pase lo acomoda Google con su plantilla; no queda idéntico a la web.
- **Pases ya guardados:** se actualizan cuando el iPhone los vuelve a pedir (en la próxima visita o aviso). La imagen de Google cambia porque cambia su versión (`hilo-1`).
- **Estilos «Noche y oro», «Cristal», «Negro mate» y «Marfil y oro»:** siguen en el código (`card-palette.ts`) pero no se usan; la tarjeta y el pase usan exactamente los dos colores del comercio.
