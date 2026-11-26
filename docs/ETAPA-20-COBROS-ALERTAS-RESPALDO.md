# Etapa 20 · Cobros, alertas de errores y copias de seguridad

## 1. Control de cobros (panel de la plataforma)

Sin pago en línea todavía: Lazo cobra por transferencia y aquí se lleva la cuenta.

- Cada comercio tiene una fecha **«pagado hasta»**. Desde la migración 0039 (oferta «pagas el primer
  mes y el segundo es gratis»), un comercio nuevo empieza **sin meses pagados**: su fecha es el día en
  que se crea y aparece por cobrar hasta que pague.
- **Primer pago de un comercio nuevo en el plan Starter:** se suma solo **1 mes gratis** además de los
  meses pagados, contando desde el día en que pagó. El formulario lo avisa, el historial lo marca
  («+ 1 mes gratis») y queda en la auditoría. Se usa una sola vez; los pagos siguientes son normales.
- Los comercios creados antes de la 0039 ya tuvieron su mes gratis con la oferta anterior: no reciben otro.
- **Establecimientos** muestra la columna **Pago** (Al día / Por vencer / Vencido) y el filtro
  **Por cobrar** (vencidos y los que vencen en 5 días o menos, primero los más atrasados). Si hay
  vencidos, aparece un aviso rojo arriba.
- En el detalle de cada comercio, la tarjeta **Cobros**:
  - **Registrar pago**: meses, monto (sugiere el precio del plan), fecha y nota. La fecha avanza desde
    el vencimiento anterior, no desde hoy, para que el ciclo no se corra si pagan tarde.
  - **Cambiar fecha**: para corregir o dar días extra. Pide motivo.
  - Historial de pagos.
- Solo el superadministrador registra pagos; soporte solo ve. El comercio no ve nada de esto.
- **Corte por mora (desde el 25 de noviembre de 2026).** A los 5 días de vencido, el dueño o administrador ve la pantalla de pago en vez de su panel; se abre solo al pagar. Los empleados siguen sumando sellos y las tarjetas de los clientes no se tocan. No aplica al comercio nuevo que aún no hace su primer pago.
- **El comercio no se suspende solo.** Para suspenderlo del todo se usa el botón «Suspender» de siempre.
- Todo queda en la auditoría (`billing.payment_registered`, `billing.paid_until_changed`).

Base de datos: migración `20261101000036_control_cobros.sql` (tablas `business_billing` y
`business_payments`, funciones `register_business_payment` y `set_business_paid_until`).
**Hay que aplicarla en Supabase antes de publicar el código**; mientras tanto el panel muestra un aviso.

## 2. Alertas de errores (Sentry)

El código ya está listo (`src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/lib/alertas.ts`).
No envía nada hasta que exista la variable `NEXT_PUBLIC_SENTRY_DSN`. Para encenderlo:

1. Crear una cuenta gratis en sentry.io y un proyecto de tipo **Next.js**.
2. Copiar el **DSN** del proyecto (Settings → Client Keys). No es secreto, pero tampoco se pone en el código.
3. En Vercel → Project → Settings → Environment Variables: `NEXT_PUBLIC_SENTRY_DSN` = el DSN, para Production.
4. Volver a publicar (Redeploy).
5. En Sentry → Alerts: que avise por correo con cada error nuevo.

Privacidad (Ley 1581): no se envían IP, cookies, encabezados, formularios ni parámetros de las
direcciones; el enlace de cada tarjeta (`/card/…`) y el secreto NFC (`?k=…`) se tapan. Solo errores:
sin medición de rendimiento ni grabación de pantallas. Pruebas: `tests/alertas.test.ts`.

Nota: el paquete de Sentry trae avisos de seguridad moderados en `glob`/`minimatch`, que solo se usan
al compilar (no en el sitio que ven los clientes).

## 3. Copias de seguridad

**El proyecto está en el plan gratis de Supabase, que no hace copias de seguridad** (verificado el
19-nov-2026 en Database → Backups). Dos caminos:

- **Recomendado cuando haya varios clientes:** plan Pro de Supabase (US$25/mes): copia diaria con 7 días
  de historia y restauración con un clic.
- **Gratis, desde ya:** `npm run respaldo` en el computador donde está el proyecto (necesita `.env.local`).
  Guarda en `C:\Respaldos-Lazo\<fecha>` cada tabla en JSON, la lista de cuentas (sin contraseñas) y
  los archivos subidos. Solo lee la base de datos. `npm run respaldo -- --conteo` solo cuenta filas.
  - Hacerlo al menos una vez por semana.
  - La copia tiene datos personales: carpeta local, nunca OneDrive/Drive, nunca Git ni correo.
    El script se niega a guardar dentro del proyecto o en carpetas que se sincronizan.
  - No incluye contraseñas ni secretos NFC (se generan de nuevo desde el panel).
  - Restaurar desde estos JSON es manual (con ayuda técnica). Con el plan Pro es automático.
