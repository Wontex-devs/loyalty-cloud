# Etapa 11: derechos de las clientas y freno a inscripciones falsas

Corrige los hallazgos **A1**, **A2** y **A3** de la auditoría.

## Qué hay de nuevo
| Hallazgo | Función | Dónde |
|---|---|---|
| **A1 · Supresión (Ley 1581)** | **Eliminar datos de la clienta.** Se borran nombre, celular, correo y cumpleaños, y se retira el consentimiento. La tarjeta queda bloqueada y su enlace deja de funcionar. Las recompensas pendientes se anulan. Las visitas se conservan sin datos personales, así que las estadísticas no cambian. Solo el **propietario** puede hacerlo: hay que escribir `ELIMINAR` para confirmar y no se puede deshacer. Queda en la auditoría. Si la persona vuelve, se inscribe desde cero con el mismo celular. | Panel → *Clientes → (clienta)* |
| **A2 · Revocar marketing** | **Retirar consentimiento**, para el propietario o un administrador. La clienta también puede darse de baja ella misma desde su tarjeta: *"No quiero recibir promociones"*. En ambos casos deja de aparecer en *Campañas* y queda en la auditoría con su origen (`panel` o `card`). | Ficha de la clienta y tarjeta pública |
| **A3 · Inscripciones falsas** | **1. Solo el servidor inscribe.** La clave pública ya no puede llamar a `join_program`: la app inscribe con la `service_role` mediante `join_program_limited`. **2. Límite por conexión.** Se permiten 20 intentos por hora y por conexión, contados en Postgres, así que sirve aunque haya varios servidores. Se guarda un HMAC de la IP, nunca la IP. **3. Anti-bots opcional.** Si se configuran las claves de Cloudflare Turnstile, el formulario hace la comprobación y el servidor la valida. Sigue activo el freno de 60 inscripciones nuevas cada 10 minutos por comercio. | `src/lib/data/loyalty-actions.ts`, `src/components/public/turnstile.tsx` |
| B2 (de paso) | Las funciones de trigger dejan de tener permiso de ejecución para el público. | Migración |

## Activar Turnstile (opcional, recomendado antes de abrir a desconocidos)
1. Entra a **Cloudflare → Turnstile → Add widget**.
2. Usa el dominio del sitio (`loyalty-cloud-sigma.vercel.app`) y el modo *Managed*.
3. En **Vercel → loyalty-cloud → Environment Variables** (Production), crea:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = la *Site Key*;
   - `TURNSTILE_SECRET_KEY` = la *Secret Key*, marcada como **Sensitive**.
4. Vuelve a publicar el sitio.

Sin estas claves todo funciona igual, pero solo con los límites de la base de datos.

## Base de datos
Nueva migración `20261101000012_privacy_abuse.sql`:
- en `customers`: la columna `anonymized_at`, y `phone_e164` pasa a admitir nulos;
- la política de edición de `customers` ya no permite editar a una clienta anonimizada;
- funciones nuevas: `anonymize_customer`, `revoke_marketing_consent`, `unsubscribe_marketing` y `join_program_limited`;
- la tabla `private.join_attempts`;
- nuevas versiones de `set_card_blocked` y `get_public_card`;
- cambios de permisos.

| Proyecto | Estado |
|---|---|
| Pruebas (`loyalty-cloud`) | ✅ Aplicada y verificada (`db:verify --e2e`: 72 de 72) |
| Producción (`loyalty-cloud-prod`) | ✅ Aplicada y publicada en Vercel (prueba del sitio: 16 de 16; permisos comprobados en la base de datos) |

⚠️ **En producción hay que aplicar la migración y publicar el código seguidos.** Con la migración aplicada, el código anterior ya no puede inscribir, porque usaba la clave pública. Con el código nuevo y sin la migración, tampoco, porque `join_program_limited` no existiría.

## Pruebas
- `npm run test:db`: 161 casos, 28 nuevos:
  - inscripción directa bloqueada;
  - límite por conexión;
  - baja desde la tarjeta;
  - retiro desde el panel, por rol;
  - anonimización: permisos, datos borrados, enlace invalidado, historial conservado, sin reactivación ni edición y reinscripción.
- `npm run test:unit`: 22 casos.
- `npm run db:verify -- --e2e`: 72 casos contra el proyecto de pruebas, 4 nuevos.
- `next build` sin errores.
- En el navegador:
  - **modo demo:** baja desde la tarjeta, *Retirar consentimiento* y *Eliminar datos*;
  - **modo real, contra el proyecto de pruebas:** inscripción desde el formulario a través del servidor y baja desde la tarjeta.
- **Sin probar:** Turnstile con claves reales (no hay claves todavía) y la eliminación desde el panel en modo real. Esta última está cubierta por las pruebas de base de datos y por los permisos verificados en Supabase.
