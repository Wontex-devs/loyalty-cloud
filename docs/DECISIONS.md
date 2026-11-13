# Decisiones del proyecto

## 2026-11-12 · Gestión de usuarios del panel de la plataforma

- **Decisión:**
  - Agregar el rol de plataforma **Soporte** (solo lectura) y la **suspensión** de cuentas.
  - Ambos se aplican en la base de datos (RLS y funciones de la migración 0019), no solo en la pantalla.
  - La suspensión también bloquea el inicio de sesión en Supabase Auth.
- **Motivo:**
  - El equipo necesita ayudar a los comercios sin poder cambiar nada.
  - También necesita quitar el acceso a una persona sin borrar su historial.
  - Si solo se ocultaran los botones, alguien con conocimientos técnicos podría saltarse la regla.
- **Alternativas descartadas:**
  - **Permisos editables desde la pantalla:** obligarían a reescribir todas las políticas RLS y a validar combinaciones arbitrarias. Hoy hay pocos roles y son claros, así que no compensa.
  - **Usar solo el bloqueo de Supabase Auth para suspender:** el token abierto seguiría sirviendo hasta una hora.
  - **Guardar la IP y el dispositivo en el registro de inicios de sesión:** no hace falta para la operación y aumenta los datos personales tratados (Ley 1581).

## 2026-11-12 · Colores de marca con `@theme inline`

- **Decisión:** los tokens `--color-brand*` van en `@theme inline`.
- **Motivo:**
  - Con `@theme`, Tailwind resolvía `var(--brand)` en `:root`.
  - El color que define cada panel en su contenedor nunca se aplicaba: salía negro.
- **Alternativa descartada:** definir `--color-brand` directamente en cada contenedor. Duplica la lógica y es fácil de olvidar.
