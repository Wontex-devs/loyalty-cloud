# Etapa 5: pruebas completas y preparación del piloto

## 1. Pruebas

| Comando | Qué prueba | Casos |
|---|---|---|
| `npm test` | Tipos, pruebas unitarias y base de datos (todo lo local) | — |
| `npm run test:unit` | Motor de fidelización, teléfonos, validaciones, permisos, estadísticas y CSV | 14 |
| `npm run test:db` | Migraciones sobre Postgres en memoria: RLS, roles, visitas, canjes, reversiones, estadísticas, configuración y freno de inscripciones | 87 |
| `npm run db:verify` | Proyecto Supabase real, sin modificar datos | 33 |
| `npm run db:verify -- --e2e` | Además, flujo completo con "Cliente Verificación" | 44–46 (depende de cuándo fue su última visita) |
| `npm run smoke -- <url>` | Despliegue en marcha: cabeceras de seguridad, rutas protegidas, páginas públicas y política de datos | 15 |

Las pruebas encontraron y corrigieron un error real. Un número escrito como "57 300 123 4567", sin el "+", se guardaba como +5757…, así que la misma clienta podía acabar con dos tarjetas.

## 2. Qué se añadió para el piloto
- **Política de datos y términos públicos** en `/join/<slug>/terminos`. Los enlaza el formulario de inscripción y el pie de cada tarjeta. Es una plantilla basada en la Ley 1581 de 2012 y se completa con los datos del comercio. **Revísala con tu asesor legal antes de abrir el piloto.**
- **Configuración del comercio que sí guarda**: nombre, categoría, ciudad, zona horaria y datos del responsable del tratamiento (razón social, NIT, correo, teléfono, dirección). Mientras falte la razón social, el NIT o el correo, la política muestra un aviso.
- **Freno de inscripciones en la base de datos**: como máximo 60 clientes nuevos cada 10 minutos por comercio. Protege también a quien use la API pública directamente. El freno por IP de la app solo sirve dentro de un mismo servidor.
- **Cabeceras de seguridad**:
  - nadie puede incrustar el sitio en un iframe;
  - la cámara solo se permite en el propio sitio;
  - se fuerza HTTPS (HSTS);
  - el navegador no adivina el tipo de los archivos;
  - los buscadores no indexan nada, porque las tarjetas llevan un token privado.
- **Pantallas de error y de página no encontrada** en español, sin detalles técnicos.
- **Herramientas**:
  - `npm run db:bundle` genera `supabase/setup.sql` con todas las migraciones;
  - `npm run admin:bootstrap -- correo` crea el superadministrador de un proyecto nuevo sin manejar contraseñas;
  - `npm run smoke -- <url>` prueba un despliegue.

## 3. Preparar producción

### Recomendación: un proyecto Supabase nuevo para el piloto
El proyecto actual (`loyalty-cloud`) tiene datos de demostración, y el historial de visitas no se puede borrar por diseño. Para el piloto conviene **un proyecto limpio**, por ejemplo `loyalty-cloud-prod`. El actual se queda como entorno de pruebas.

1. Crea el proyecto en Supabase, región **São Paulo**, con *Data API* activa y "exponer tablas automáticamente" desactivado.
2. Ejecuta `npm run db:bundle`, pega `supabase/setup.sql` completo en el editor SQL y pulsa *Run*.
3. Ve a **Authentication → Sign In / Providers** y desactiva *Allow new users to sign up*.
4. Ve a **Authentication → URL Configuration**:
   - Site URL: `https://<tu-dominio>`
   - Redirect URL: `https://<tu-dominio>/auth/callback`
5. **Correo (importante)**: el correo integrado de Supabase solo sirve para pruebas. Está limitado a muy pocos envíos por hora y puede que solo envíe a miembros de tu equipo de Supabase, así que las invitaciones al personal podrían no llegar. Configura un SMTP propio (Resend, Brevo, Amazon SES…) en **Authentication → Emails → SMTP Settings**.
6. Revisa el plan:
   - En el plan Free el proyecto se pausa tras unos días sin actividad y las copias de seguridad son limitadas.
   - Para datos reales de clientes, valora el plan Pro antes del lanzamiento.

### Desplegar la app (Vercel recomendado)
1. Ejecuta `npx vercel` desde la carpeta del proyecto (no hace falta Git) o importa el repositorio en vercel.com.
2. Elige la región de funciones **São Paulo (gru1)**, junto a la base de datos.
3. Configura las variables de entorno en *Project Settings → Environment Variables*:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, la clave *publishable* del proyecto de producción.
   - `SUPABASE_SERVICE_ROLE_KEY`, la clave *secret*. **Solo servidor**: nunca con el prefijo `NEXT_PUBLIC_`.
   - `NEXT_PUBLIC_APP_URL`, la URL final con `https://`.
4. Si usarás un dominio propio (por ejemplo `club.beautyclub.co`), conéctalo y actualiza la Site URL de Supabase.
5. Ejecuta `npm run smoke -- https://<tu-dominio> <slug>`. Todo debe salir ✓.

Con HTTPS, la cámara de cualquier celular ya funciona como escáner.

### Dar de alta el comercio del piloto
1. Superadministrador: ejecuta `npm run admin:bootstrap -- tu-correo` con el `.env.local` apuntando a producción. Entra con el enlace del correo y crea tu contraseña.
2. En **/admin → Comercios → Nuevo** crea el comercio. La propietaria recibe la invitación por correo.
3. La propietaria completa:
   - **Configuración**: los datos del responsable del tratamiento.
   - **Mi programa**: sellos, recompensa, vencimiento y tiempo mínimo entre visitas.
   - **Mi tarjeta digital**: colores y logo.
4. Revisa `/join/<slug>/terminos` y valídalo con tu asesor.
5. Invita al equipo desde **Empleados** y decide quién puede canjear.
6. Imprime el cartel (*Mi tarjeta digital → Cartel para imprimir*) y ponlo en caja.

## 4. Plan del piloto (4 semanas, un comercio)

| Semana | Objetivo |
|---|---|
| 0 | Alta del comercio, formación del equipo (15 min con [GUIA-EQUIPO.md](GUIA-EQUIPO.md)) y prueba con 2 o 3 clientas de confianza |
| 1 | Invitar a cada clienta en caja. Revisar a diario Historial y Estadísticas |
| 2–3 | Operación normal. Primeros canjes. Anotar fricciones del equipo |
| 4 | Evaluación y decisión |

**Qué medir** (lo muestran *Estadísticas* y *Historial*):
- Inscripciones por semana y % de clientas atendidas que se inscriben.
- Clientes que repiten (dos o más visitas en 30 días).
- Visitas registradas frente a servicios reales en caja. Si hay mucha diferencia, el equipo se está olvidando de escanear.
- Correcciones (reversiones). Si son muchas, hace falta reforzar la formación.
- Canjes y tasa de canje.
- Tiempo por visita en caja. Objetivo: menos de 10 segundos.

**Criterios para seguir**: el equipo escanea sin ayuda, no hay incidentes de datos y las clientas vuelven a abrir su tarjeta.

**Revisión diaria (2 minutos)**: Historial → filtra "Visita revertida" y revisa que los motivos tengan sentido. En Auditoría comprueba que no haya exportaciones ni bloqueos inesperados.

## 5. Límites conocidos
- El panel carga hasta 10 000 registros por tabla y comercio; las estadísticas no tienen límite. Más allá de esa cifra, el historial necesitará paginación en el servidor.
- El freno por IP de la inscripción vive en la memoria de cada servidor. El freno de la base de datos (60 cada 10 min) es el que cuenta en producción.
- La política de datos es una plantilla, no asesoría legal.
- No hay SMS ni WhatsApp: la clienta guarda el enlace de su tarjeta o la añade a la pantalla de inicio.

## 6. Producción actual
- Sitio: https://loyalty-cloud-sigma.vercel.app. Proyecto Vercel `wontex/loyalty-cloud`, plan Hobby, funciones en São Paulo (`gru1`).
- Base de datos: proyecto Supabase `loyalty-cloud-prod` (`axuiaztmryljcxypogmt`, São Paulo). Las 7 migraciones están aplicadas y el registro libre está desactivado.
- Auth: Site URL y redirect `…/auth/callback` configurados.
- Superadministradora y propietaria de Beauty Club: `wontex.developer@gmail.com`.
- Variables en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` y `SUPABASE_SERVICE_ROLE_KEY` (secreta).
- Para publicar cambios: `npx vercel deploy --prod`.
- **Pendiente antes de abrir a clientas reales**:
  - pasar a Vercel Pro, porque Hobby es solo para uso no comercial;
  - configurar SMTP propio, para invitar al equipo;
  - completar los datos legales y revisarlos con un asesor.
