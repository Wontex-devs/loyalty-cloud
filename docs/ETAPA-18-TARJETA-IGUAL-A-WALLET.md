# Etapa 18 · La tarjeta web es igual al pase de Wallet («el hilo»)

Fecha: 18 de noviembre de 2026.

## Migración 0030 (ya aplicada, hoy sin uso)

`20261101000030_qr_tarjeta.sql` permite guardar `passQr` (verdadero o falso) en la marca del comercio. Se aplicó en producción el 18 de noviembre de 2026. El código QR se quitó después, así que **nada la usa hoy**; se deja porque no toca datos y sus pruebas siguen pasando. Si el QR vuelve, la validación ya está.

## Qué cambia

**Lo que el comercio ve en la vista previa es lo que el cliente guarda en su billetera.** La tarjeta web, la vista previa del panel y el pase de Apple Wallet tienen ahora la misma forma:

1. **Fila superior:** logo, nombre del comercio y «SELLOS 3 / 8». Es lo único que se ve cuando las tarjetas están apiladas en Wallet.
2. **Franja «el hilo»:** el premio como protagonista, en la letra de la marca, y un hilo fino que enhebra los sellos hasta cerrar en un aro alrededor del premio. De fondo, la inicial del comercio casi transparente.
3. **Sin datos debajo.** Al principio llevaba «MIEMBRO», «DESDE» y «TU PROGRESO»; se quitaron (18 nov 2026) para que sea solo la tarjeta. La frase de progreso sigue al reverso del pase y es la que llega como notificación en cada visita.
4. **Sin código QR.** Se probó con un QR al final y se quitó el mismo día: no se veía bien y los sellos se suman con la tarjeta NFC del mostrador.

## Qué puede personalizar el comercio

Dos colores (fondo, y sellos y etiquetas), logo o iniciales, letra de la marca (nombre y premio), sello (icono o imagen propia), cantidad de sellos y premio.

## Límites de Apple Wallet que se respetan

- El pase solo admite tres colores planos (fondo, texto, etiquetas): sin degradados, marcos ni efecto cristal.
- La letra de la marca solo va dentro de las imágenes (logo y franja); los datos usan la letra del iPhone.
- El orden de las piezas es fijo.
- La franja mide 375 × 144 puntos.

## Cómo está hecho

| Pieza | Archivo |
|---|---|
| Geometría compartida (posición de sellos, hilo y tamaño del premio) | `src/lib/domain/hilo.ts` |
| Imagen de la franja (Apple Wallet y Google Wallet) | `src/components/brand/pass-strip.tsx` |
| Franja de la tarjeta web | `src/components/loyalty/hilo-strip.tsx` |
| Tarjeta web | `src/components/loyalty/loyalty-card.tsx` |
| Campos del pase de Apple | `src/lib/wallet/apple.ts` |
| El mismo pase en la portada (iPhone e historia) | `src/components/marketing/pase-hilo.tsx` |

- De 2 a 12 sellos van en una fila; de 13 a 30, en dos.
- Un premio de nombre largo pasa a dos líneas más pequeñas; nunca se sale ni tapa los sellos.

## Pruebas

- `tests/hilo.test.ts`: para 2 a 30 sellos, todos caben en la franja sin tocarse ni tapar el premio.
- `tests/apple-wallet.test.ts`: campos nuevos y que el pase no lleva código de barras.
- `npm run test:db`: 5 pruebas nuevas de `passQr` (349 en total).
- Revisión visual con seis comercios ficticios: tarjeta web e imagen del pase lado a lado, en computador y en celular.

## Pendiente o no verificado

- **En un iPhone real:** no se ha visto el pase nuevo dentro de la app Wallet. Hay que guardar una tarjeta de prueba y revisarla.
- **Google Wallet:** usa la misma imagen del hilo, pero el resto del pase lo acomoda Google con su plantilla; no queda idéntico a la web.
- **Pases ya guardados:** se actualizan cuando el iPhone los vuelve a pedir (en la próxima visita o aviso). La imagen de Google cambia porque cambia su versión (`hilo-1`).
- **Estilos «Noche y oro», «Cristal», «Negro mate» y «Marfil y oro»:** siguen en el código (`card-palette.ts`) pero no se usan; la tarjeta y el pase usan exactamente los dos colores del comercio.
