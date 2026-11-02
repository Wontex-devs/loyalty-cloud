# Etapa 7: promociones, cumpleaños y campañas

## Qué hay de nuevo
| Función | Dónde | Detalle |
|---|---|---|
| **Promociones** | Panel → *Programa → Promociones* | Doble, triple, cuádruple o quíntuple sello entre dos fechas y en los días de la semana que elijas. Se aplican solas al registrar la visita, en la zona horaria del comercio. Se pausan y se reactivan, pero no se borran. |
| **Aviso de promoción** | *Registrar visita* y tarjeta de la clienta | El escáner muestra "Hoy: Doble sello" y el botón indica los sellos reales, por ejemplo "+2 sellos". La tarjeta muestra "Tu visita de hoy suma 2 sellos". |
| **Cumpleaños** | Inscripción (opcional: día y mes, sin año) | Configura el regalo en *Mi programa → Regalo de cumpleaños*. Se entrega en la primera visita del mes de cumpleaños, una vez al año, y vence a los 30 días. |
| **Campañas por WhatsApp** | Panel → *Programa → Campañas* | Grupos de clientas: cerca del premio, premio sin canjear, inactivas hace más de 45 días, cumpleaños del mes, nuevas y todas. El mensaje se puede editar y admite variables. Cada envío se hace uno a uno desde tu WhatsApp. |

### Reglas
- **Solo con consentimiento.** Las campañas muestran únicamente clientas con consentimiento de marketing, y la base de datos rechaza registrar un contacto sin él (`NO_MARKETING_CONSENT`).
- **Sin envíos masivos ni automáticos.** Cada mensaje lo abre y lo envía una persona. Cada envío queda en un registro que no se puede borrar, y la lista muestra la fecha del último mensaje a cada clienta.
- **Sellos extra al completar la tarjeta.** Si una visita con promoción pasa la meta, los sellos que sobran cuentan para el ciclo siguiente.
- **Reversiones.** Revertir una visita con promoción descuenta también sus sellos extra.
- **Permisos.** Solo propietario y administrador crean promociones y usan Campañas. El equipo de caja solo ve el aviso.
- **Política de datos.** Ahora menciona el cumpleaños opcional y los mensajes por WhatsApp.

## Base de datos
Nueva migración `20261101000009_promotions_birthdays.sql`:
- tablas `promotions` y `customer_contacts`;
- columnas de cumpleaños y del tipo de recompensa;
- nuevas versiones de `register_visit`, `reverse_visit`, `get_public_card` y `join_program`. Esta última se elimina y se vuelve a crear porque cambian sus parámetros.

| Proyecto | Estado |
|---|---|
| Pruebas (`loyalty-cloud`) | ✅ Aplicada |
| Producción (`loyalty-cloud-prod`) | ✅ Aplicada y publicada en Vercel (prueba del sitio: 16 de 16) |

## Pruebas
- `npm run test:db`: 110 casos, 17 de ellos nuevos (promociones, cumpleaños, contactos y permisos).
- `npm run test:unit`: 17 casos.
- `npm run db:verify -- --e2e`: 51 casos contra el proyecto de pruebas.
- Revisado en el navegador, en modo demo:
  - crear una promoción;
  - visita con "+2 sellos";
  - grupos de Campañas y mensaje de WhatsApp;
  - campo de cumpleaños en la inscripción del celular.
