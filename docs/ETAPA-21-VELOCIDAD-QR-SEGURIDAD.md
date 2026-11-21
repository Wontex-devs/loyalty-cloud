# Etapa 21 · Velocidad, código QR, seguridad y quitar fondo (21-nov-2026)

## 1. Velocidad

**Medición en el sitio real (antes de estos cambios):** con el servidor despierto, las páginas responden
en 0,3–0,6 s. Tras un rato sin visitas, la primera tarda cerca de 3 s («arranque en frío» de Vercel, plan Hobby).
La base de datos y las funciones están en la misma región (São Paulo): por ahí no era.

**Qué se corrigió**

| Causa | Arreglo |
|---|---|
| El filtro de sesión (`src/proxy.ts`) corría en TODAS las rutas: cada página pública pagaba un arranque extra | Solo corre en `/admin`, `/business`, `/account`, `/login`, `/start` y `/auth` |
| La inscripción (`/join/<comercio>`) se armaba en el servidor en cada visita | Se guarda ya armada y se sirve al instante; se rearma cada minuto y al cambiar marca, programa o datos del comercio |
| Cada pase de Apple dibujaba 9 imágenes desde cero (y traía logo e ilustración cada vez) | Imágenes guardadas en memoria y en la caché de datos (`src/lib/wallet/imagenes-cache.ts`): todas las tarjetas de un comercio con los mismos sellos comparten imagen |
| La imagen de sellos de Google Wallet se dibujaba en cada pedido | La misma caché, y el navegador/Google la guardan un día |
| Las 5 letras de la tarjeta se bajaban de Google Fonts en cada arranque del servidor | Quedan en la caché de datos por un mes |
| El pase de Apple leía la tarjeta dos veces, una tras otra | Una sola lectura, en paralelo con los datos internos |
| Sentry se cargaba siempre, aunque esté apagado | Solo se carga si existe `NEXT_PUBLIC_SENTRY_DSN` |

**Lo que NO se puede arreglar con código:** el arranque en frío del plan Hobby de Vercel. Con más visitas
ocurre menos; el plan Pro de Vercel lo reduce. **No verificado:** los tiempos después del cambio se miden
cuando esté publicado (en local no hay arranque en frío).

## 2. Código QR

Ver `docs/ETAPA-19-CODIGO-BARRAS.md` (sección «Cambio a código QR») y `npm run comparar:lectura`.

## 3. Seguridad: revisión y arreglos

**Arreglado**
- **Redirección a otro sitio después de iniciar sesión.** El parámetro `next` solo comprobaba que empezara
  por «/» y no por «//». Los navegadores tratan «\» como «/» y se saltan tabuladores, así que un enlace de Lazo
  armado a propósito podía llevar, después de entrar con la contraseña real, a una página falsa. Ahora se
  valida como lo hace el navegador (`src/lib/domain/ruta-interna.ts`, con pruebas). Afectaba el inicio de
  sesión y el retorno de los enlaces de correo.
- **Registro de errores de Apple Wallet** (`/api/apple-wallet/v1/log`): no pide credenciales (así lo define
  Apple). Ahora tiene límite por conexión, de tamaño y de cantidad, y no deja escribir saltos de línea.

**Revisado y correcto**
- Cada panel comprueba la sesión y el rol en su propio diseño (layout) y la base de datos lo vuelve a comprobar
  (RLS): quitar el filtro de sesión de las páginas públicas no abre nada.
- Las imágenes de marca solo pueden apuntar a la carpeta del propio comercio en Storage (lo valida la base).
- La tarea diaria exige su secreto con comparación en tiempo constante. Los pases de Apple exigen su token.
- Cabeceras: HSTS, sin iframes de terceros, sin detección de tipo, permisos de cámara/ubicación solo propios.
- Subidas a Storage: solo PNG, WebP y JPG de hasta 1 MB, y solo a la carpeta del propio comercio.

**Pendiente (recomendado, no urgente)**
- Política de contenido (CSP) completa para scripts: hoy solo cubre iframes, formularios y objetos.
- Dependencias: 5 avisos moderados, todos del paquete de Sentry y solo al compilar.
- En Supabase (requiere entrar al panel): confirmar que el registro libre sigue desactivado y activar la
  protección de contraseñas filtradas y la verificación en dos pasos para las cuentas de administrador.
- Copias de seguridad: el plan gratis no las hace (ver Etapa 20).

Ninguna revisión garantiza que un sitio sea imposible de atacar; esto reduce los riesgos conocidos.

## 4. Quitar el fondo de la ilustración

En **Diseño de tarjeta → Ilustración de la franja**, la casilla «Quitar el fondo automáticamente» (encendida por
defecto) borra el fondo liso al subir la imagen y la deja en PNG transparente. Apagada, se sube tal cual.

- Se hace en el navegador (`src/lib/domain/quitar-fondo.ts`): toma el color del borde y borra lo que se le
  parece y está conectado con la orilla. Los blancos encerrados dentro del dibujo se conservan y el contorno
  queda suavizado.
- Funciona con fondos lisos (blanco, crema, un color). Con fotos de fondo variado avisa y la sube sin cambios.
- Si la imagen ya es transparente, no la toca. Ahora también se aceptan JPG.
