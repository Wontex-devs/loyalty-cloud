# Etapa 3: inscripción, QR, tarjetas y registro de visitas

## Qué funciona ahora con Supabase (modo live)

| Flujo | Dónde | Cómo |
|---|---|---|
| **QR general del comercio** | Panel → *Mi tarjeta digital* | QR de `/join/<slug>`, descarga en PNG de alta resolución (1200 px) y **cartel imprimible** en `/join/<slug>/poster` (A4/carta; "Guardar como PDF") |
| **Inscripción del cliente** | `/join/<slug>` | Se carga con la RPC `get_public_business` (pública, sin datos de clientes) y se envía a `joinProgramAction` → `join_program` |
| **Creación de tarjeta** | En la propia RPC | Cliente + tarjeta + token público de 128 bits en una sola transacción. Si el teléfono ya existe, devuelve su tarjeta sin duplicar |
| **QR individual** | `/card/<token>` | El QR codifica la URL de la tarjeta (solo el token público, nunca IDs internos) |
| **Registro de visita** | Panel → *Registrar visita* | Escáner con la **cámara** (jsQR, funciona en iPhone y Android) o búsqueda por nombre/teléfono → `registerVisitAction` → `register_visit` |
| **Actualización del progreso** | `/card/<token>` | La tarjeta se vuelve a consultar cada ~6 s mientras está visible y muestra "¡Visita sumada!" al detectar una visita nueva |

### Reglas aplicadas en el servidor (Postgres)
- **Tarjetas de otros comercios.** El escáner solo reconoce tarjetas del comercio actual (las demás no llegan al navegador por RLS), y la RPC vuelve a comprobar la membresía.
- **Doble registro.** Hay una clave de idempotencia por operación, y además un tiempo mínimo entre visitas (60 min en Beauty Club, configurable en *Mi programa*).
- **Inscripción.** La app limita a 10 inscripciones por IP cada 10 minutos (en memoria, válido para un único servidor). Los términos son obligatorios y el consentimiento de marketing va aparte.
- **Comercio suspendido.** No acepta inscripciones ni visitas, y sus tarjetas no se muestran.

### Pendiente para la Etapa 4
En modo live, **canjear recompensas** y **revertir visitas** muestran "se conecta en la Etapa 4". Las RPC ya existen y están probadas.

## Base de datos
Nueva migración `20261101000005_public_business.sql` (`get_public_business`). **Ya está aplicada** en el proyecto `loyalty-cloud`.

## Pruebas
- `npm run test:db`: 63 casos sobre Postgres en memoria.
- `npm run db:verify`: 20 casos contra Supabase real, sin modificar datos.
- `npm run db:verify -- --e2e`: además inscribe y reutiliza al cliente de prueba **"Cliente Verificación"** (`+57 300 000 0001`) y le registra una visita con la empleada Laura. Las visitas son inmutables, así que este cliente queda en el historial de Beauty Club.

## Probar la cámara en un celular
`getUserMedia` exige **HTTPS**. `http://localhost:3000` funciona en el computador, pero desde el celular la dirección local no es segura. Para probar con el teléfono hace falta una de estas opciones:
- Desplegar una vista previa (por ejemplo, Vercel). Es lo recomendado para el piloto.
- Abrir un túnel HTTPS temporal (por ejemplo `npx localtunnel --port 3000`) y añadir esa URL en Supabase → *Auth → URL Configuration*.

Si la cámara no está disponible, el empleado siempre puede buscar al cliente por nombre o teléfono.
