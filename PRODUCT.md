# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Comprador:** dueño o dueña de un negocio pequeño en Colombia con clientes que repiten (barberías, salones, cafeterías, panaderías, spas, gimnasios, lavaderos, tiendas). Decide, paga y mira las estadísticas.
- **Equipo del mostrador:** empleados que registran visitas escaneando el QR de la tarjeta del cliente con un celular, tableta o computador, en 10 segundos y de pie.
- **Cliente final:** persona que se inscribe con nombre y celular y usa su tarjeta de sellos desde el celular, sin descargar nada.
- **Superadministrador de la plataforma:** equipo de Wontex; ve solo datos agregados.

## Product Purpose

Plataforma SaaS multiempresa de tarjetas de fidelización de marca blanca. Cambia la tarjeta de sellos de cartón por una tarjeta digital con la marca de cada negocio y le da al dueño un panel que dice quién vuelve, quién dejó de venir y a quién escribirle por WhatsApp. El éxito es que los clientes de cada negocio vuelvan más y que el dueño sepa quiénes son.

## Positioning

- La tarjeta se abre en el navegador, sin descargar app, y puede añadirse a la pantalla de inicio.
- Marca blanca: logo, colores, sello, letra y nombre del club son los del negocio, no los de Wontex.
- Precio accesible para negocios pequeños: plan Starter con primer mes gratis.

## Operating Context

- Inscripción: el cliente escanea el QR (cartel) de la caja, escribe nombre y celular y acepta términos.
- Visita: el equipo escanea el QR de la tarjeta del cliente y confirma +1 sello; si no hay celular, se busca por nombre o teléfono.
- Premio: al completar los sellos aparece la recompensa y se canjea una sola vez; las reversiones quedan registradas con motivo.
- Venta: el canal comercial es WhatsApp; hay una demo pública con datos de ejemplo.
- Idioma y mercado: español de Colombia, precios en pesos.

## Capabilities and Constraints

- Planes (según la portada actual): Starter $59.900/mes (100 clientes, 2 personas del equipo, 1 sede, primer mes gratis); Pro $119.900/mes (300 clientes, 10 personas, 3 sedes); Business a la medida.
- Datos personales de clientes bajo Habeas Data (Ley 1581 de 2012): solo los ve cada negocio, consentimiento al inscribirse, el cliente puede dejar de recibir mensajes y pedir el borrado.
- Multiempresa con aislamiento por comercio; Wallet (Google Wallet, Apple Wallet) y NFC como evolución de la tarjeta.
- **NFC:** el usuario confirmó que NFC funciona; la portada ya lo presenta en presente. No se han confirmado los detalles (qué lector, Apple Wallet, Google Wallet), por eso el texto no los nombra.

## Brand Commitments

- Nombre de la plataforma: «Lazo» (antes «Wontex App»; definido en `src/lib/config.ts`). Pendiente: verificar disponibilidad de la marca en la SIC y del dominio.
- Logo: una «L» que se cierra en lazo (`src/components/brand/lazo-logo.tsx`, favicon en `src/app/icon.svg`), en cobalto y amarillo.
- La página de venta ya usa azul cobalto y amarillo sobre blanco con letra Bricolage Grotesque; el estado vigente del sitio es la referencia hasta que se documente un sistema visual.

## Evidence on Hand

- Demo con el comercio de ejemplo Beauty Club (datos ficticios).
- Documentación en `docs/` (arquitectura, etapas, guía del equipo, guion de demo, presentación comercial).
- **Testimonios:** el usuario decidió omitirlos por ahora. Aún no hay textos reales en el repositorio; cuando existan, se necesitan las frases reales y el permiso de cada persona o negocio. Nunca inventarlos.

## Product Principles

1. Cero fricción para el cliente final: sin descargas, sin cuentas, con su nombre y celular.
2. El mostrador no espera: registrar una visita toma segundos.
3. La marca es del negocio: Wontex se nota poco en lo que ve el cliente.
4. Datos de clientes protegidos y propiedad de cada negocio.
5. Solo afirmaciones verificables: sin cifras, clientes ni testimonios inventados.

## Accessibility & Inclusion

Uso en celular y en mostrador con luz variable; textos legibles y objetivos táctiles grandes. No se estableció un estándar formal más allá del buen contraste y navegación por teclado.
