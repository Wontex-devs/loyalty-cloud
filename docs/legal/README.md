# Documentos legales de Lazo (borradores)

> Son **borradores redactados con ayuda de IA**, no asesoría legal. Deben revisarse y firmarse con un abogado antes de usarse con clientes.

| Documento | Para qué | Quién lo firma o publica |
|---|---|---|
| [CONTRATO-SERVICIO-COMERCIO.md](CONTRATO-SERVICIO-COMERCIO.md) | Contrato con cada comercio que compra Lazo. Incluye el encargo de datos. | Lazo y el comercio |
| [POLITICA-TRATAMIENTO-DATOS-LAZO.md](POLITICA-TRATAMIENTO-DATOS-LAZO.md) | Política de datos de Lazo como empresa (equipo de cada comercio y contactos comerciales). | Lazo la publica en su página |
| Texto para clientes finales | Ya está en la aplicación: `/join/<comercio>/terminos`, con casilla obligatoria y casilla aparte para promociones. Cada comercio completa sus datos de responsable en su panel. | El cliente final la acepta al inscribirse |

## Lo que debe cerrar el abogado

1. **Quién es la entidad que vende Lazo:** razón social, NIT, representante y dirección (quedan como `[ ]` en los borradores).
2. **Transferencia internacional de datos** (artículo 26 de la Ley 1581): la base de datos y el alojamiento están en proveedores de nube que pueden estar fuera de Colombia. Definir si basta con la autorización que ya acepta el cliente o si hace falta contrato de transmisión o declaración de conformidad.
3. **Registro Nacional de Bases de Datos (RNBD):** ver si Lazo y/o los comercios están obligados a inscribirse.
4. **IVA** y facturación electrónica del servicio.
5. **Tope de responsabilidad, disponibilidad del servicio, permanencia, reajuste de precio y mora:** son propuestas que la empresa debe decidir (marcadas «Decisión»).
6. **Cláusula de controversias:** ciudad y mecanismo.
7. **Menores de edad:** cómo se maneja si un comercio inscribe menores.
8. **Uso del comercio como referencia comercial:** el contrato trae una casilla. Lazo no debe mostrar el nombre de un comercio como cliente sin ella.

## Lo que el comercio debe hacer en el panel antes de abrir

- Completar razón social, NIT, dirección y correo de contacto del responsable (si no, el texto para clientes muestra un aviso de «datos pendientes»).
- Revisar los términos del programa (sellos, recompensa, vencimiento).

## Publicado en el sitio (11-nov-2026)

Una versión resumida de la política y de los términos está publicada en `/politica-de-datos` y `/terminos` (texto en `src/lib/contenido/legal.ts`). Responsable: Wontex, Barranquilla, NIT en trámite. **Pendiente:** revisión del abogado, razón social y NIT definitivos (se cambian en `EMPRESA`, `src/lib/config.ts`).
