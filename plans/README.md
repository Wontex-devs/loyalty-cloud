# Planes de movimiento para la portada

Planes escritos el 8-nov-2026 sobre el commit `626f863` más los cambios sin commit de la portada. Los seis planes se implementaron el 8-nov-2026 (sin commit); falta la revisión de sensación con una persona.

| # | Plan | Severidad | Depende de | Estado |
|---|---|---|---|---|
| 001 | [Curvas de movimiento compartidas](001-curvas-de-movimiento.md) | LOW | — | DONE (sin commit) |
| 002 | [Demostración animada del NFC](002-nfc-demostracion.md) | MEDIUM | 001 | DONE (sin commit) |
| 003 | [Cambio de tarjeta en «Con tu marca»](003-cambio-de-tarjeta-de-marca.md) | MEDIUM | 001 | DONE (sin commit) |
| 004 | [Pasos de «Así funciona» uno por uno](004-pasos-uno-por-uno.md) | LOW | — | DONE (sin commit) |
| 005 | [Preguntas frecuentes suaves](005-preguntas-que-se-abren-suave.md) | LOW | 001 | DONE (sin commit) |
| 006 | [Respuesta al pulsar en botones](006-respuesta-al-pulsar-botones.md) | LOW | — | DONE (sin commit) |

## Orden recomendado

1. **001** primero: define `--ease-ui-out`, que usan 002, 003 y 005.
2. **002** (la de mayor valor) y **003**.
3. **004**, **005** y **006** en cualquier orden.

## Notas

- Todos los planes editan `src/app/page.tsx` o `src/app/globals.css`: ejecutarlos **uno a la vez**, no en paralelo, para evitar choques de edición.
- Los números de línea de los planes son del estado actual; si el archivo cambió, el ejecutor debe detenerse y avisar.
- Los planes no se deben subir a GitHub si el equipo no quiere publicar esta carpeta; `plans/` es material de trabajo.
- Cada plan incluye una verificación de sensación al moverlo (cámara lenta y movimiento reducido): hay que hacerla con una persona mirando la pantalla.
