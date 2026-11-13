# Etapa 14 · Panel de la plataforma: usuarios, roles, seguridad y auditoría

Fecha: 12 de noviembre de 2026.

## Antes de publicar: aplicar la migración 0019

El código nuevo necesita la migración `supabase/migrations/20261101000019_panel_usuarios.sql` en la base de datos de producción (`loyalty-cloud-prod`).

1. Supabase → proyecto `loyalty-cloud-prod` → **SQL Editor** → pegar el archivo completo → **Run**.
2. Aplicarla **antes** de unir el PR. Si el código llega primero, el panel sigue funcionando, pero las páginas de usuarios muestran el aviso «falta aplicar la migración 0019» y no se registran los inicios de sesión.
3. No borra ni cambia datos existentes: solo agrega un rol, tres columnas, una tabla, índices y funciones, y reemplaza cinco políticas de lectura.

## 1. Auditoría: lo que se encontró

| Área | Estado antes |
|---|---|
| Acceso al panel | Solo superadministrador. Comprobado en el servidor y en la base (RLS). Correcto. |
| Roles | Plataforma: `superadmin` / `user`. Comercio: propietario / administrador / empleado (+ permiso de canje). No había un rol de solo lectura. |
| Usuarios | Una tabla sin búsqueda, filtros, paginación, estado de cuenta, último acceso ni ficha individual. |
| Suspender cuentas | No existía: solo eliminar. |
| Contraseñas | Las personas pueden recuperarla solas. El administrador no podía enviar un enlace. Nadie ve contraseñas (correcto). |
| Auditoría | Se registraba bien en la base (inmutable), pero el panel solo mostraba 6 eventos con códigos técnicos. Sin filtros ni exportación. |
| Inicios de sesión | No se registraban. |
| Confirmaciones | Eliminar cuenta usaba la ventana nativa del navegador (`prompt`). Suspender un comercio no pedía confirmación. |
| Botones sin función | «Nuevo plan» y «Editar plan» estaban desactivados con «Próximamente». |
| Color de marca | Error: los colores de cada comercio nunca se aplicaban (gráficos y botones de marca salían negros). La variable se resolvía en `:root`. |
| Dashboard | Sin métricas de usuarios, alertas, crecimiento ni accesos rápidos. |
| Código | `setPlanChoice` se llamaba durante el dibujado (anti-patrón de React); un `!` podía romper la ficha del comercio si faltaba un perfil. |

## 2. Matriz de mejoras

| Problema | Solución | Prioridad | Archivos |
|---|---|---|---|
| No se podía quitar el acceso sin borrar la cuenta | Suspender y reactivar. Corta el acceso **en la base de datos** de inmediato (las funciones de RLS ignoran cuentas suspendidas) y bloquea el inicio de sesión en Supabase Auth. | Alta | migración 0019, `admin-actions.ts` |
| Faltaba un rol de solo lectura | Rol **Soporte (supervisor)**: ve todo el panel de la plataforma, no cambia nada. La base lo aplica con `is_platform_reader()`. | Alta | migración 0019, `admin/layout.tsx`, `piezas.tsx` |
| Cambios de rol sin protecciones en la base | `admin_set_platform_role`: nadie cambia su propio rol y siempre queda un superadministrador activo. Queda en la auditoría con el antes y el después. | Alta | migración 0019 |
| Lista de usuarios básica | Búsqueda, filtros (rol, estado, comercio), paginación, estados (activa, inactiva, invitación pendiente, suspendida), último acceso y exportación CSV. | Alta | `usuarios-tabla.tsx`, `admin_list_users()` |
| Sin ficha de usuario | `/admin/users/[id]`: perfil, comercios (cambiar rol, permiso de canje, activar o desactivar), cambios sobre la cuenta, lo que hizo e inicios de sesión. | Alta | `usuario-detalle.tsx`, `usuario-acciones.tsx` |
| Sin registro de inicios de sesión | Tabla `login_events` (solo fecha y método; sin IP ni dispositivo, por la Ley 1581). | Media | migración 0019, `actions.ts`, `auth/callback` |
| Auditoría poco útil | `/admin/audit`: filtros por ámbito, tipo, persona y fechas; paginación en el servidor; nombres legibles; exportación CSV, que también queda registrada. | Media | `admin/audit/page.tsx`, `acceso.ts` |
| Permisos no visibles | `/admin/roles`: tabla de lo que puede hacer cada rol, tomada de las mismas reglas que aplica la base. | Media | `admin/roles/page.tsx` |
| Acciones peligrosas sin confirmación | Ventanas de confirmación accesibles. Eliminar pide escribir el correo; suspender un comercio pide confirmar. | Media | `piezas.tsx` (Modal) |
| Dashboard pobre | Indicadores de usuarios y comercios, gráfico de inicios de sesión, alertas reales, crecimiento por mes, actividad reciente y accesos rápidos. | Media | `resumen.tsx` |
| Colores de marca rotos | `@theme inline` para los tokens de marca. El panel de la plataforma usa el azul de Lazo. | Media | `globals.css`, `admin-shell.tsx` |
| Botones «Próximamente» | Se quitaron y se explica cómo cambiar planes (con una migración). | Baja | `admin/plans/page.tsx` |

## 3. Seguridad: cómo se aplica

- **Tres capas:** la pantalla oculta lo que no se puede hacer, la acción del servidor comprueba el rol, y la base de datos lo vuelve a comprobar con RLS y funciones `SECURITY DEFINER` con `search_path` vacío.
- **Escritura:**
  - Las funciones `admin_*` exigen superadministrador activo.
  - La `service_role` solo se usa para Supabase Auth (invitar y bloquear el inicio de sesión), después de comprobar el rol.
- **Auditoría:**
  - Cada acción sensible queda en `audit_logs` en la misma transacción. La tabla no se puede editar ni borrar.
  - `admin_record_action` solo acepta una lista cerrada de acciones.
- **Contraseñas:** nadie del panel las ve ni las escribe. Solo se envía un enlace al correo de la persona.
- **Datos de clientes finales:** ni Superadministrador ni Soporte los ven. No cambió.

## 4. Pruebas

- Base de datos: 29 pruebas nuevas en `npm run test:db` (259 en total).
  - Soporte solo lee.
  - Una cuenta suspendida pierde el acceso y lo recupera al reactivarla.
  - Protecciones del último superadministrador y de los cambios a uno mismo.
  - Auditoría con el antes y el después.
  - Inicios de sesión privados y sin suplantación.
- Unitarias: `tests/acceso.test.ts` (estados de cuenta, permisos y CSV protegido contra fórmulas).
- Revisión visual con datos ficticios, en computador y en celular de 375 px:
  - Resumen, usuarios, ficha, roles, ventanas y modo Soporte.
  - Sin desbordes y sin errores en la consola.

## 5. Pendiente o fuera de alcance (documentado, no simulado)

- **Permisos configurables desde la pantalla:** hoy los roles son fijos en la base de datos. Hacerlos editables exige reescribir las políticas RLS; queda para una versión siguiente.
- **Ver y cerrar sesiones activas de otra persona:** Supabase Auth no ofrece por API la lista de sesiones de un usuario. La suspensión sí corta el acceso de inmediato.
- **Inicios de sesión anteriores:** el registro empieza con esta versión.
- **Editar planes desde el panel:** hoy se cambian con una migración, para que quede registrado.
- **Notificaciones por correo al administrador** (por ejemplo, por una suspensión): requieren un servicio de correo transaccional.
