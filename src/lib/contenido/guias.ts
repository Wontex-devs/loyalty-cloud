import type { Pagina } from "./tipos";

export const GUIAS: Pagina[] = [
  {
    ruta: "tarjeta-de-fidelizacion-digital",
    tipo: "guia",
    titulo: "Tarjeta de fidelización digital: guía para tu negocio",
    descripcion:
      "Qué es una tarjeta de fidelización digital, cómo funciona, cuánto cuesta en Colombia y cómo elegir el premio para que tus clientes vuelvan.",
    antetitulo: "Guía",
    h1: "Tarjeta de fidelización digital: qué es y cómo usarla en tu negocio",
    resumen:
      "Una tarjeta de fidelización digital es la tarjeta de sellos de tu negocio, pero en el celular del cliente. No se pierde, no se olvida en la billetera y te dice quién vuelve. Aquí te explicamos cómo funciona, cómo elegir el premio, cuánto cuesta y qué errores evitar.",
    secciones: [
      {
        titulo: "¿Qué es una tarjeta de fidelización digital?",
        parrafos: [
          "Es una tarjeta de lealtad que vive en el celular de tu cliente en lugar de en un cartón. Lleva el logo, los colores y el nombre del club de tu negocio, y suma un sello cada vez que el cliente te compra. Al completar los sellos, gana un premio que tú defines.",
          "La idea de fondo no cambia frente al cartón de toda la vida: dar un motivo para volver. Lo que cambia es que la tarjeta no se pierde y que tú, por fin, sabes quién la usa y con qué frecuencia.",
        ],
      },
      {
        titulo: "¿Cómo funciona una tarjeta de fidelización digital con Lazo?",
        parrafos: [
          "Tu cliente se inscribe una sola vez escaneando un QR que pones en la caja. Escribe su nombre y su celular, y listo: no descarga ninguna app. En Android guarda la tarjeta en Google Wallet; en iPhone, por ahora, la usa desde el navegador.",
          "Para sumar sellos, el cliente acerca el celular a una etiqueta NFC adhesiva pegada en tu mostrador. No necesitas lector ni datáfono. Tú activas la etiqueta desde tu panel, y cada sello nuevo aparece solo en la tarjeta.",
        ],
        pasos: [
          "Pegas la etiqueta NFC en el mostrador y la activas desde tu panel.",
          "Pones el QR en la caja para que los clientes creen su tarjeta.",
          "El cliente suma un sello en cada visita acercando el celular.",
          "Al completar los sellos, el premio aparece en su tarjeta y tú lo canjeas desde el panel.",
        ],
      },
      {
        titulo: "¿En qué se diferencia de la tarjeta de cartón?",
        parrafos: [
          "La principal diferencia es que el cartón se pierde, se moja o se queda en otro bolsillo, y además no te cuenta nada. La tarjeta digital siempre está en el celular y deja un registro de cada visita.",
          "Con el cartón no sabes quién dejó de venir. Con la tarjeta digital ves en tu panel quién volvió, quién lleva tiempo sin aparecer y a quién le falta poco para el premio. Esa información es la que te permite escribirle a la persona correcta en el momento correcto.",
        ],
      },
      {
        titulo: "¿Y frente a un programa de puntos como Puntos Colombia?",
        parrafos: [
          "Son herramientas distintas y pueden convivir. Un programa de puntos de muchos comercios, como Puntos Colombia, suma compras en distintos lugares. La tarjeta de sellos es solo de tu negocio: premia que el cliente vuelva específicamente contigo.",
          "Con una tarjeta propia, las reglas, el premio y la marca los pones tú. No dependes de las condiciones de un tercero ni compartes a tu cliente con otros comercios. Además, un sello es fácil de entender: se compra, se suma, se completa y se gana.",
        ],
      },
      {
        titulo: "¿Cómo elegir el premio de tu programa de fidelización?",
        parrafos: [
          "Elige un premio que el cliente quiera de verdad y que a ti te cueste poco frente a lo que ya compró. Lo ideal es que sea un producto o servicio de tu propio negocio, porque así el cliente vuelve una vez más a recogerlo.",
          "Algunas ideas para pensar el premio según tu caso:",
        ],
        lista: [
          "Un producto de tu carta o de tu catálogo, como un café o un postre.",
          "Un servicio extra, como un lavado adicional o un tratamiento corto.",
          "Un descuento sobre la siguiente compra.",
          "Algo que otros no pueden ofrecer: un detalle exclusivo de tu local.",
        ],
      },
      {
        titulo: "¿Cuánto cuesta una tarjeta de fidelización digital con Lazo?",
        parrafos: [
          "Lazo tiene planes mensuales con el IVA incluido, sin permanencia y con pago mensual. El plan Starter cuesta $79.990 al mes e incluye 100 clientes, 2 personas del equipo y 1 sede, con el primer mes gratis.",
          "El plan Pro cuesta $139.990 al mes e incluye 300 clientes, 10 personas del equipo y 3 sedes. Para cadenas o negocios con más sedes, el plan Business se arma a la medida de tu negocio.",
        ],
        tabla: [
          ["Plan", "Precio al mes (IVA incluido)", "Clientes", "Equipo", "Sedes"],
          ["Starter", "$79.990 (primer mes gratis)", "100", "2 personas", "1"],
          ["Pro", "$139.990", "300", "10 personas", "3"],
          ["Business", "A medida", "A medida", "A medida", "A medida"],
        ],
      },
      {
        titulo: "¿Qué pasa con los datos de tus clientes? (Ley 1581)",
        parrafos: [
          "Los datos de tus clientes se tratan según la Ley 1581 de 2012. Tu negocio es el responsable de esos datos y Lazo actúa como encargado, es decir, los maneja por tu cuenta y bajo tus reglas. Lazo no vende datos.",
          "El cliente acepta la política de datos al inscribirse, y los avisos al celular solo les llegan a quienes dijeron que sí. Cuéntale a tus clientes para qué usas su información: la confianza también fideliza.",
        ],
      },
      {
        titulo: "¿Cuáles son los errores más comunes al fidelizar clientes?",
        parrafos: [
          "El error más común es poner un premio tan lejano que el cliente se rinde antes de empezar. Si le toca esperar meses, deja de ver el avance y deja de venir.",
          "Estos son otros tropiezos frecuentes:",
        ],
        lista: [
          "No contarles a los clientes que existe la tarjeta: el QR en la caja tiene que estar a la vista.",
          "Cambiar las reglas a mitad del camino sin avisar.",
          "Ofrecer un premio que no te deja margen o que nadie quiere.",
          "Inscribir clientes y no mirar el panel: la información sirve cuando la usas.",
          "Pedir demasiados datos al inscribirse. Con nombre y celular alcanza.",
        ],
      },
    ],
    preguntas: [
      {
        q: "¿Una tarjeta de fidelización digital sirve para un negocio pequeño?",
        a: "Sí. Está pensada para negocios locales con clientes que repiten, como barberías, cafeterías, panaderías o salones. El plan Starter cubre hasta 100 clientes y una sede.",
      },
      {
        q: "¿Cómo empiezo?",
        a: "Escríbenos por WhatsApp al 313 893 9222 o a info@wontex-devs.com. Con el plan Starter, el primer mes es gratis y no hay permanencia.",
      },
      {
        q: "¿Puedo usar mi logo y mis colores?",
        a: "Sí. Lazo es de marca blanca: la tarjeta lleva el logo, los colores, el sello y el nombre del club de tu negocio.",
      },
      {
        q: "¿Hay contrato de permanencia?",
        a: "No. Los planes son mensuales, con el IVA incluido y sin permanencia.",
      },
      {
        q: "¿Puedo hacer promociones, como doble sello?",
        a: "Sí. Desde el panel puedes crear promociones, por ejemplo doble sello los martes, para mover los días más flojos.",
      },
    ],
    actualizado: "2026-11-11",
    relacionadas: ["tarjeta-de-sellos-digital", "tarjeta-de-lealtad-google-wallet", "cafeterias"],
  },
  {
    ruta: "tarjeta-de-sellos-digital",
    tipo: "guia",
    titulo: "Tarjeta de sellos digital: cómo montarla en tu negocio",
    descripcion:
      "Cartón vs. tarjeta de sellos digital, cuántos sellos poner, ideas de premios y cómo montarla paso a paso con QR, Google Wallet y etiqueta NFC.",
    antetitulo: "Guía",
    h1: "Tarjeta de sellos digital: cómo montarla paso a paso",
    resumen:
      "Una tarjeta de sellos digital reemplaza el cartón por una tarjeta en el celular de tu cliente, que suma sellos acercando el teléfono a una etiqueta NFC. En esta guía comparas ambas opciones, decides cuántos sellos poner, eliges el premio y la montas con Lazo paso a paso.",
    secciones: [
      {
        titulo: "¿Qué es una tarjeta de sellos digital?",
        parrafos: [
          "Es la versión en el celular de la tarjeta de cartón que se sella en cada compra. Tiene la marca de tu negocio, una cantidad de sellos que tú defines y un premio al completarla. Los sellos se suman solos cuando el cliente acerca el celular a una etiqueta NFC en tu mostrador.",
          "No hace falta timbre, tinta ni lector. Tampoco que el cliente descargue una app: se inscribe escaneando un QR y, en Android, guarda la tarjeta en Google Wallet.",
        ],
      },
      {
        titulo: "¿Qué diferencia hay entre el cartón y la tarjeta digital?",
        parrafos: [
          "El cartón es barato de arrancar, pero se pierde y no te deja ver nada. La tarjeta digital no se extravía y te muestra quién vuelve. Esta tabla resume las diferencias más claras.",
        ],
        tabla: [
          ["Aspecto", "Tarjeta de cartón", "Tarjeta de sellos digital"],
          ["Se pierde o se daña", "Sí, con facilidad", "No, vive en el celular"],
          ["Sabes quién vuelve", "No", "Sí, desde tu panel"],
          ["Aviso a clientes", "No", "Sí, a quienes aceptaron"],
          ["Control de trampas", "Difícil", "Tiempo mínimo entre sellos e historial"],
          ["Marca de tu negocio", "Depende de la imprenta", "Logo, colores y nombre del club"],
          ["Promociones (doble sello)", "Complicado", "Se activan desde el panel"],
        ],
      },
      {
        titulo: "¿Cuántos sellos debe tener la tarjeta?",
        parrafos: [
          "No hay un número único: depende de cada cuánto vuelve tu cliente y de cuánto margen te deja el premio. Como regla de sentido común, entre más seguido vuelven, más sellos puede pedir la tarjeta. Estos rangos son solo una sugerencia para que arranques; ajústalos con lo que veas en tu local.",
        ],
        tabla: [
          ["Tipo de negocio", "Sellos sugeridos"],
          ["Cafetería o panadería (visitas casi diarias)", "8 a 10"],
          ["Barbería o salón (visitas cada 2 a 4 semanas)", "5 a 8"],
          ["Lavadero o spa (visitas más espaciadas)", "4 a 6"],
        ],
      },
      {
        titulo: "¿Cómo se monta una tarjeta de sellos digital con Lazo?",
        parrafos: [
          "Se monta en tres piezas: el QR para inscribir clientes, Google Wallet donde la guardan y la etiqueta NFC donde suman sellos. Tú configuras la marca y las reglas desde el panel.",
        ],
        pasos: [
          "Define tu tarjeta: logo, colores, sello, nombre del club, cantidad de sellos y premio.",
          "Pon el QR en la caja. Cada cliente lo escanea una sola vez y escribe su nombre y su celular.",
          "En Android, el cliente guarda la tarjeta en Google Wallet con el botón «Agregar a la Billetera de Google». En iPhone, por ahora, la usa desde el navegador.",
          "Pega una etiqueta NFC adhesiva (NTAG213 o NTAG215) en el mostrador y actívala desde tu panel.",
          "Elige el tiempo mínimo entre sellos para que nadie se lleve dos en la misma visita.",
          "Cuando el cliente completa los sellos, el premio aparece en su tarjeta y tú lo canjeas desde el panel.",
        ],
      },
      {
        titulo: "¿Qué premios puedo ofrecer?",
        parrafos: [
          "El mejor premio es uno que cuesta poco hacer y que el cliente valora. Piensa en lo que ya vendes y en lo que haría que alguien vuelva con un amigo.",
        ],
        lista: [
          "Una bebida o producto gratis, como el café número diez.",
          "Un servicio adicional, como un lavado extra o un tratamiento corto.",
          "Un descuento sobre la próxima compra.",
          "Un producto de tu marca o un detalle exclusivo del local.",
          "Un doble sello en un día flojo, como promoción para llenar la semana.",
        ],
      },
      {
        titulo: "¿Cómo evito que se hagan trampas con los sellos?",
        parrafos: [
          "Lazo trae varios frenos: un tiempo mínimo entre sellos que tú eliges, bloqueo a toques repetidos y un historial donde puedes anular cualquier sello. Cada sello queda con fecha y hora.",
          "Si sospechas que alguien copió la etiqueta NFC, la cambias desde tu panel y la anterior deja de funcionar. Además, cada premio se canjea una sola vez.",
        ],
      },
      {
        titulo: "¿Qué tengo que comprar para empezar?",
        parrafos: [
          "Solo una etiqueta NFC adhesiva, tipo NTAG213 o NTAG215, y un cartel con el QR para la caja. No necesitas lector ni datáfono. El plan Starter cuesta $79.990 al mes con el IVA incluido, sin permanencia y con el primer mes gratis.",
        ],
      },
    ],
    preguntas: [
      {
        q: "¿Cada cuánto debería pedir un sello?",
        a: "Un sello por visita o por compra es lo más simple de entender. Tú decides el tiempo mínimo entre sellos para que no se sumen dos en la misma visita.",
      },
      {
        q: "¿Necesito lector o datáfono para sumar sellos?",
        a: "No. Basta una etiqueta NFC adhesiva pegada en tu mostrador y activada desde tu panel. El cliente acerca el celular y el sello se suma.",
      },
      {
        q: "¿Qué pasa si un cliente cambia de celular?",
        a: "Vuelve a escanear el QR de tu negocio con el mismo nombre y celular, y recupera su tarjeta con todos sus sellos.",
      },
      {
        q: "¿Cómo canjeo el premio?",
        a: "Cuando el cliente completa los sellos, el premio aparece en su tarjeta. Tú lo canjeas desde tu panel, y cada premio se canjea una sola vez.",
      },
      {
        q: "¿Se puede anular un sello por error?",
        a: "Sí. En el historial de tu panel puedes anular cualquier sello.",
      },
    ],
    actualizado: "2026-11-11",
    relacionadas: ["tarjeta-de-fidelizacion-digital", "tarjeta-de-lealtad-google-wallet", "barberias"],
  },
  {
    ruta: "tarjeta-de-lealtad-google-wallet",
    tipo: "guia",
    titulo: "Tarjeta de lealtad Google Wallet para tu negocio",
    descripcion:
      "Cómo funciona una tarjeta de lealtad en Google Wallet: qué ve tu cliente, cómo la agrega, cómo se actualizan los sellos y qué pasa en iPhone.",
    antetitulo: "Guía",
    h1: "Tarjeta de lealtad en Google Wallet: cómo funciona para tu negocio",
    resumen:
      "La tarjeta de lealtad de Lazo se guarda en Google Wallet, la billetera del celular Android, con el logo y los colores de tu negocio. Los sellos se actualizan solos y el cliente no descarga ninguna app. Aquí ves qué ve tu cliente, cómo la agrega y qué pasa en iPhone.",
    secciones: [
      {
        titulo: "¿Qué es una tarjeta de lealtad en Google Wallet?",
        parrafos: [
          "Es tu tarjeta de sellos guardada en Google Wallet, la billetera digital que ya viene en muchos celulares Android. El cliente la encuentra junto a sus otras tarjetas, con el logo, los colores y el nombre del club de tu negocio.",
          "No es una app que tengas que desarrollar ni que tu cliente tenga que descargar. Tú manejas todo desde un panel, y el cliente solo ve su tarjeta.",
        ],
      },
      {
        titulo: "¿Qué ve el cliente en su celular?",
        parrafos: [
          "Ve una tarjeta con la marca de tu negocio y los sellos que lleva. Cada vez que suma uno, la tarjeta se actualiza y se nota el avance hacia el premio.",
          "Cuando completa los sellos, el premio aparece en la misma tarjeta. Tú lo canjeas desde tu panel, y cada premio se canjea una sola vez.",
        ],
      },
      {
        titulo: "¿Cómo se agrega la tarjeta a Google Wallet?",
        parrafos: [
          "El cliente la agrega con un solo toque, justo después de inscribirse. No tiene que buscar nada en una tienda de aplicaciones.",
        ],
        pasos: [
          "Escanea con la cámara el QR que tienes en la caja.",
          "Escribe su nombre y su celular, y acepta la política de datos.",
          "En Android toca el botón «Agregar a la Billetera de Google».",
          "Listo: la tarjeta queda guardada en su billetera.",
        ],
      },
      {
        titulo: "¿Cómo se actualizan los sellos solos?",
        parrafos: [
          "El cliente acerca el celular a una etiqueta NFC adhesiva pegada en tu mostrador y el sello se suma. La tarjeta en Google Wallet se actualiza sola, sin que él ni tú tengan que hacer nada más.",
          "No necesitas lector ni datáfono. La etiqueta es NTAG213 o NTAG215 y la activas desde tu panel. Entre dos sellos pasa un tiempo mínimo que tú eliges, y el sistema frena los toques repetidos.",
        ],
      },
      {
        titulo: "¿Qué pasa con los clientes que tienen iPhone?",
        parrafos: [
          "Por ahora, en iPhone la tarjeta se usa desde el navegador, sin instalar nada. El cliente abre su enlace personal y ve su tarjeta con sus sellos. Apple Wallet todavía no está disponible.",
          "Esto significa que tus clientes con iPhone también participan en el programa; solo cambia el lugar donde ven la tarjeta. Pídeles que la abran siempre desde el mismo navegador (Safari), porque así el toque NFC reconoce su tarjeta.",
        ],
      },
      {
        titulo: "¿Puedo avisarles a mis clientes desde la tarjeta?",
        parrafos: [
          "Sí, pero solo a quienes aceptaron recibir avisos. Desde tu panel puedes ver quién volvió, quién dejó de venir y a quién le falta poco para el premio, y escribirle a la persona indicada.",
          "Los avisos llegan al celular y el cliente puede dejar de recibirlos desde su tarjeta. Puedes usarlos, por ejemplo, para contar una promoción como doble sello los martes.",
        ],
      },
      {
        titulo: "¿Qué pasa si el cliente cambia de celular?",
        parrafos: [
          "Recupera su tarjeta con todos sus sellos. Solo tiene que volver a escanear el QR de tu negocio y escribir el mismo nombre y celular con los que se inscribió.",
          "Así nadie pierde lo que ya sumó por un celular roto, perdido o nuevo.",
        ],
      },
      {
        titulo: "¿Por qué no hace falta una app?",
        parrafos: [
          "Porque la tarjeta vive en Google Wallet, que ya está en el celular, o en el navegador. Una app propia hay que desarrollarla y mantenerla, y a muchos clientes no les provoca instalar una más por un solo negocio.",
          "Con Lazo, el cliente se inscribe una sola vez escaneando un QR y tú arrancas desde $79.990 al mes con el IVA incluido, sin permanencia.",
        ],
      },
    ],
    preguntas: [
      {
        q: "¿Mis clientes tienen que descargar una app?",
        a: "No. Se inscriben escaneando el QR de tu negocio y escriben nombre y celular. En Android guardan la tarjeta en Google Wallet; en iPhone la usan desde el navegador.",
      },
      {
        q: "¿La tarjeta se ve con el logo de mi negocio?",
        a: "Sí. Lleva el logo, los colores, el sello y el nombre del club de tu negocio.",
      },
      {
        q: "¿Quién ve los datos de mis clientes?",
        a: "Solo tu negocio. Según la Ley 1581 de 2012, tu negocio es el responsable de los datos y Lazo es el encargado. Lazo no vende datos.",
      },
      {
        q: "¿Habrá Apple Wallet?",
        a: "Por ahora no está disponible. Los clientes con iPhone usan su tarjeta desde el navegador, sin instalar nada.",
      },
      {
        q: "¿Qué pasa si un cliente borra la tarjeta de su billetera?",
        a: "Puede volver a escanear el QR de tu negocio con el mismo nombre y celular y recuperar su tarjeta con todos sus sellos.",
      },
    ],
    actualizado: "2026-11-11",
    relacionadas: ["tarjeta-de-fidelizacion-digital", "tarjeta-de-sellos-digital", "cafeterias"],
  },
];
