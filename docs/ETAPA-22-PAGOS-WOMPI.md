# Etapa 22 · Pago del plan en línea (Mercado Pago o Wompi)

> **Pasarela en uso: Mercado Pago.** El registro de comercios de Wompi estaba caído (noviembre de 2026),
> así que se agregó Mercado Pago. Si están las variables de Mercado Pago, el panel usa Mercado Pago;
> si no, usa Wompi. La parte de la base de datos (órdenes, una sola confirmación, mes gratis) es la misma.

## Mercado Pago: para encenderlo (lo hace la dueña de la cuenta)

1. **Entra a [mercadopago.com.co](https://www.mercadopago.com.co)** con tu cuenta. Sirve la de Mercado Libre; si no tienes, créala.
2. **Ve a [mercadopago.com.co/developers/panel](https://www.mercadopago.com.co/developers/panel) → *Crear aplicación*:**
   - nombre: **Lazo**;
   - tipo: **Pagos online**;
   - producto: **Checkout Pro**.
3. **Dentro de la aplicación → *Credenciales de producción*.** Copia el **Access Token** (empieza por `APP_USR-`).
4. **En la aplicación → *Webhooks* → *Configurar notificaciones*:**
   - URL de producción: `https://lazo.wontex-devs.com/api/pagos/mercadopago`;
   - evento: **Pagos**;
   - guarda y copia la **clave secreta** que aparece.
5. **En Vercel → loyalty-cloud → *Settings* → *Environment Variables* (Production), crea:**
   - `MERCADOPAGO_ACCESS_TOKEN` = el Access Token;
   - `MERCADOPAGO_WEBHOOK_SECRET` = la clave secreta del webhook.
6. **Avisa a Claude.** Hace el *Redeploy* y comprueba que la tarjeta diga «Pagar con Mercado Pago».

Cómo se confirma un pago:
- Al volver de Mercado Pago, o cuando llega su aviso, el servidor **consulta el pago en la API de Mercado Pago** con el Access Token (`GET /v1/payments/{id}`).
- Solo lo registra si está aprobado, con la referencia y el valor exactos de la orden. Los parámetros de la URL o del aviso no bastan por sí solos.
- Si está la clave del webhook, además se revisa la firma `x-signature`.

---

# Wompi (alternativa)

El comercio paga su plan desde **Configuración → Plan {nombre}** con el botón **«Pagar con Wompi»**. Puede pagar con PSE, Nequi, Bancolombia o tarjeta.
El pago se registra solo en el control de cobros. Si es el primer pago de un comercio nuevo en Starter, se suma el segundo mes gratis.

## Cómo funciona

1. **El dueño elige cuántos meses paga** (1, 3, 6 o 12) y toca «Pagar con Wompi».
2. **La base de datos crea una orden** con una referencia única (`lazo-…`) y el valor según su plan (`start_online_payment`).
   El valor no lo pone el navegador.
3. **El servidor arma el enlace al Web Checkout de Wompi** con la firma de integridad (SHA256 de referencia + valor + moneda + secreto). El dueño paga en la página de Wompi.
4. **Wompi envía el aviso `transaction.updated` a `/api/pagos/wompi`.**
   - El servidor verifica la firma con el secreto de eventos.
   - Si el pago quedó **aprobado** y el valor coincide, `confirm_online_payment` registra el pago igual que «Registrar pago» del panel de la plataforma: misma fecha «pagado hasta», historial, auditoría y mes gratis.
   - Si el valor no coincide, no se aplica y queda en la auditoría (`billing.online_payment_mismatch`).
   - Si Wompi repite el aviso, no se cobra dos veces.
5. **Al volver de Wompi**, el panel espera la confirmación y muestra «¡Pago aprobado!» con la nueva fecha.
   La redirección por sí sola no marca nada pagado.

En **Cobros** del panel de la plataforma, estos pagos aparecen con la nota «Pago en línea Wompi · <transacción>».

Base de datos: migración `20261101000040_pagos_en_linea.sql`, que crea la tabla `online_payments` y las funciones `start_online_payment`, `confirm_online_payment` y `my_billing`.
La lógica de registrar un pago queda compartida en `private.apply_business_payment`.

## Para encenderlo (lo hace la dueña de la cuenta)

1. **Crear la cuenta de comercio en [Wompi](https://comercios.wompi.co)** y completar la verificación. La cuenta la abre la persona responsable; Claude no puede hacerlo.
2. **En Wompi → *Desarrolladores*, copiar las llaves.** Primero las de **pruebas** (sandbox):
   - Llave pública: `pub_test_…`
   - Secreto de integridad: `test_integrity_…`
   - Secreto de eventos: `test_events_…`
3. **En Wompi → *Desarrolladores* → *URL de eventos* (sandbox), poner:** `https://lazo.wontex-devs.com/api/pagos/wompi`
4. **En Vercel → *Settings* → *Environment Variables* (Production), crear:**
   - `WOMPI_PUBLIC_KEY`
   - `WOMPI_INTEGRITY_SECRET`
   - `WOMPI_EVENTS_SECRET`

   Después, **Redeploy**.
5. **Probar.** El panel muestra «Modo de pruebas: los pagos no se cobran de verdad». Con las tarjetas de prueba de Wompi, el pago debe quedar aprobado y la fecha debe avanzar.
6. **Pasar a producción.** Cambiar las tres variables por las llaves de producción (`pub_prod_…`, `prod_integrity_…`, `prod_events_…`), poner la misma URL de eventos en el ambiente de producción de Wompi y hacer Redeploy.

Las llaves secretas nunca se pegan en el chat ni en el código; solo en Vercel.
