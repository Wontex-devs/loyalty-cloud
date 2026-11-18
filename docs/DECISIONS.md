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

## 2026-11-17 · El superadministrador entra a editar un comercio
- **Decisión:** la sesión de soporte tiene un modo «edit», solo para superadministradores, con motivo y de máximo 2 horas. Mientras está abierta, las funciones de permisos (`is_member`, `has_role`, `can_redeem`) lo tratan como propietario de ese comercio.
- **Motivo:** el equipo necesita resolver pedidos de los comercios sin pedirles la clave, y reutilizar las mismas reglas que ya protegen cada tabla evita duplicar permisos y dejar huecos.
- **Alternativas descartadas:**
  - **Agregar `or is_superadmin()` a cada política y función:** acceso permanente y sin motivo a datos personales de clientes; muchos cambios y fácil olvidar uno.
  - **Crear una membresía de propietario falsa:** rompe la regla de un solo propietario y ensucia el equipo del comercio.
  - **Usar la clave de servicio desde el servidor:** se saltaría RLS y la auditoría quedaría sin autor.
