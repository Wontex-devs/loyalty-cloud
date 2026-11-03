# Etapa 10: personalización de la tarjeta

## Qué hay de nuevo
| Función | Dónde | Detalle |
|---|---|---|
| **Logotipo propio** | *Mi tarjeta digital → Logotipo* | PNG, JPG, WebP o SVG de hasta 8 MB. Se reduce en el navegador a un PNG cuadrado de 512 px (256 px en la demo), sin recortarlo. Aparece en la tarjeta, la inscripción, el cartel, la política de datos, el panel, el icono de la app y el pase de Wallet. Se puede cambiar o quitar; al quitarlo vuelven las iniciales. |
| **Icono del sello** | *Mi tarjeta digital → Sellos y tipografía* | Visto, corazón, estrella, brillo, flor, gema, corona o tijeras. |
| **Tipografía** | Mismo lugar | *Clásica* (serif) o *Moderna* (sans). |
| **Más estilos predefinidos** | *Estilos predefinidos* | De 4 a 8: se añaden Lavanda, Champán, Azul noche y Terracota. |
| **Guion de ventas** | `docs/GUION-DEMO.md` | Cómo presentar la demo a un salón. |

## Cómo funciona el logo en producción
- **Dónde se guarda.** En Supabase Storage, en el bucket público `brand-assets`, dentro de `brand-assets/<business_id>/logo-<fecha>.png`.
- **Quién puede subirlo.** Lo sube el navegador con la sesión del usuario. Las políticas de Storage solo permiten escribir en la carpeta del propio comercio, y solo al dueño, a los administradores o al superadmin.
- **Validación de la URL.** `update_business_profile` solo acepta URLs de la carpeta del propio comercio, así que no se puede apuntar a imágenes externas ni de otro comercio.
- **Al reemplazar el logo.** Se borra el archivo anterior. Si falla el guardado, también se borra el archivo recién subido.

## Base de datos
Nueva migración `20261101000011_brand_assets.sql`:
- el bucket `brand-assets` con sus políticas;
- `private.can_edit_brand_path`;
- una nueva versión de `update_business_profile`, que valida `logoUrl`, `stampIcon` y `font`.

| Proyecto | Estado |
|---|---|
| Pruebas (`loyalty-cloud`) | ✅ Aplicada (`db:verify --e2e`: 68 de 68) |
| Producción (`loyalty-cloud-prod`) | ✅ Aplicada y publicada en Vercel (prueba del sitio: 16 de 16) |

## Pruebas
- `npm run test:db`: 133 casos, 9 de ellos nuevos (logo propio o de otro comercio, URL arbitraria, icono no válido, quitar el logo y escritura en Storage por rol y por carpeta).
- `npm run test:unit`: 22 casos.
- `next build` sin errores.
- Revisado en el navegador, en modo demo:
  - subir el logo;
  - sellos de corazón;
  - tipografía moderna en celular;
  - inscripción, tarjeta y registro de visita con la nueva marca.
