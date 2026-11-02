# Etapa 6: experiencia de la clienta

## Qué hay de nuevo
| Función | Dónde | Detalle |
|---|---|---|
| **Instalar la tarjeta como app** | Tarjeta `/card/<token>` → *Tenla siempre a mano* | Android: botón *Instalar en mi celular*. iPhone: instrucciones de *Compartir → Añadir a pantalla de inicio*. El icono lleva las iniciales y colores del comercio y abre directamente la tarjeta de esa clienta. |
| **Recuperación segura de la tarjeta** | `/join/<slug>` | Si el celular ya está inscrito, la tarjeta solo se devuelve si el **nombre coincide**, sin importar tildes, mayúsculas ni espacios. Con otro nombre aparece un mensaje y no se revela nada. |
| **Enviar la tarjeta por WhatsApp** | Ficha del cliente → *Enviar por WhatsApp* | Abre WhatsApp con un mensaje y el enlace de la tarjeta. Lo envía el empleado desde su teléfono, uno a uno. |
| **Sellos de bienvenida** | *Mi programa → Recompensa → Sellos de bienvenida* | De 0 a 5 sellos de regalo al inscribirse, siempre menos que la meta. Se anuncian en la página de inscripción y en la bienvenida de la tarjeta. |

### Por qué cambió la recuperación
Antes, cualquiera que escribiera un número de celular ya inscrito en `/join` recibía la tarjeta de esa persona, con su nombre e historial. Ahora hace falta saber también su nombre. Junto con el límite de 10 intentos por IP cada 10 minutos, eso evita que se puedan consultar tarjetas ajenas probando números.

## Base de datos
Nueva migración `20261101000008_customer_experience.sql`:
- `private.normalize_name`;
- columna `loyalty_programs.welcome_stamps`;
- nuevas versiones de `join_program` y `get_public_business`.

| Proyecto | Estado |
|---|---|
| Pruebas (`loyalty-cloud`) | ✅ Aplicada |
| Producción (`loyalty-cloud-prod`) | ✅ Aplicada y publicada en Vercel (prueba del sitio: 16 de 16) |

## Pruebas
- `npm run test:db`: 93 casos. Los nuevos cubren la recuperación con otro nombre o con tildes y mayúsculas, y los sellos de bienvenida.
- `npm run db:verify -- --e2e`: 49 casos contra el proyecto de pruebas.
- `npm run test:unit`: 14 casos.
- Se probó en el navegador: un celular inscrito con otro nombre muestra el aviso, y el manifiesto y el icono de la app se generan con los colores del comercio.
