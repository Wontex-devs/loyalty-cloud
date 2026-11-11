import type { Pagina } from "./tipos";

export const SECTORES: Pagina[] = [
  {
    ruta: "barberias",
    tipo: "sector",
    titulo: "Tarjeta de fidelización para barberías con sellos digitales",
    descripcion:
      "Tarjeta de sellos para barbería con tu marca: el cliente la guarda en el celular, suma sellos con el celular y tú ves quién dejó de venir. Primer mes gratis.",
    antetitulo: "Para barberías",
    h1: "Tarjeta de fidelización para barberías",
    resumen:
      "Una tarjeta de sellos para barbería con el logo y los colores de tu local. Tu cliente se inscribe con un QR, suma un sello cada vez que se corta y tú ves en un panel quién volvió, quién dejó de venir y a quién le falta poco para el premio.",
    secciones: [
      {
        titulo: "¿Por qué una tarjeta de sellos funciona bien en una barbería?",
        parrafos: [
          "Porque el corte es una visita que se repite. Quien se corta el pelo hoy va a necesitar otro corte en unas semanas, y la pregunta es si vuelve a tu silla o prueba la barbería nueva de la esquina. Una tarjeta de sellos le da una razón concreta para volver donde ya le conocen la medida.",
          "Además, en la barbería la confianza pesa mucho. El cliente suele tener su barbero, su estilo y su día. Eso es una ventaja: la tarjeta no tiene que convencerlo de nada, solo reconocer algo que ya hace.",
        ],
      },
      {
        titulo: "¿Cada cuánto vuelve un cliente de barbería?",
        parrafos: [
          "No hay una cifra única, porque depende del corte y de cada persona. Pero el ritmo suele ser regular: quien lleva el pelo muy corto o la barba definida vuelve más seguido; quien lleva un corte más largo, más espaciado. Tú conoces a tus clientes y sabes cuáles son los de cada dos o tres semanas y cuáles los de cada mes o más.",
          "Ese ritmo es justo lo que el panel de Lazo te deja ver. Si alguien que venía cada tres semanas lleva dos meses sin aparecer, algo pasó. Esa persona sale en la lista de «quién dejó de venir», y puedes decidir si le escribes o no.",
        ],
        lista: [
          "Clientes frecuentes: vienen casi con la regularidad de un reloj. Cuídalos con un premio claro.",
          "Clientes de vez en cuando: necesitan un empujón. Un aviso a tiempo puede ser suficiente.",
          "Clientes que se fueron: el panel te muestra cuáles son para que no se pierdan sin que lo notes.",
        ],
      },
      {
        titulo: "¿Cómo podría ser la tarjeta de una barbería?",
        parrafos: [
          "Este es solo un ejemplo para que te hagas una idea; tú defines cuántos sellos y qué premio. Una tarjeta de 8 sellos, un sello por corte, y al completar el octavo, un corte gratis o una arreglada de barba de regalo.",
          "Piensa el premio con calma. Si el premio es muy lejano, la gente se desanima; si es muy fácil, te cuesta. Con ocho visitas, un cliente que viene cada tres semanas llega al premio en unos seis meses, un plazo razonable para alguien que ya es fiel.",
        ],
        tabla: [
          ["Elemento", "Ejemplo para una barbería"],
          ["Sellos", "8"],
          ["Cómo se gana un sello", "Cada corte, o cada corte con barba"],
          ["Premio", "Un corte gratis o un arreglo de barba de regalo"],
          ["Logo y colores", "Los de tu barbería, con tu sello y el nombre de tu club"],
        ],
      },
      {
        titulo: "¿Qué promociones sirven en una barbería?",
        parrafos: [
          "Las que llenan los huecos y premian lo que ya quieres que pase. En la barbería casi siempre hay días y horas tranquilos, normalmente a mitad de semana y temprano en el día, y otros en que no cabe nadie, como los sábados. La promoción se pone donde hace falta gente.",
        ],
        lista: [
          "Doble sello los martes (o el día más flojo de tu local): se crea una vez en el panel y se aplica sola.",
          "Cumpleaños: el panel te muestra los cumpleaños del mes, así que puedes tener un detalle para quien cumple años, como un premio de cumpleaños.",
                    "Quien lleva tiempo sin venir: un aviso para invitarlo a volver, solo si aceptó recibir avisos.",
        ],
      },
      {
        titulo: "¿Cómo usar los avisos sin molestar al cliente?",
        parrafos: [
          "Escribiendo poco y con motivo. Los avisos de Lazo llegan al celular solo de las personas que aceptaron recibirlos, y eso ya es una buena base: quien dijo que sí quiere saber de tu barbería. Aun así, lo que más cuida a tu cliente es la medida.",
        ],
        lista: [
          "Avisa cuando haya una razón: doble sello el martes, un cumpleaños, un sello que falta para el premio.",
          "Un mensaje corto y directo vale más que uno largo. Dile qué hay y hasta cuándo.",
          "No repitas el mismo aviso a la misma persona en pocos días. Mejor uno bueno que tres seguidos.",
          "Usa la lista de «a quién le falta poco» para el empujón final: a nadie le molesta que le recuerden que está cerca de un corte gratis.",
        ],
      },
      {
        titulo: "¿Cómo se ve en el mostrador de la barbería?",
        parrafos: [
          "Con dos cosas pequeñas: un cartel con el código QR cerca de la caja o del espejo de espera, y una etiqueta NFC adhesiva pegada en el mostrador. El cliente nuevo escanea el QR una sola vez y escribe su nombre y su celular; no descarga ninguna aplicación.",
          "En Android guarda la tarjeta en Google Wallet y los sellos se actualizan solos. En iPhone, por ahora, usa la tarjeta desde el navegador. Para sumar un sello, el cliente acerca el celular a la etiqueta al pagar. No necesitas lector ni datáfono.",
          "Para que nadie abuse, tú eliges el tiempo mínimo entre un sello y otro, así nadie se sella tres veces el mismo día. El sistema frena los toques repetidos, cada sello queda con fecha y hora, puedes anularlo desde el historial y, si sospechas que alguien copió la etiqueta, la cambias y la anterior deja de funcionar.",
        ],
      },
      {
        titulo: "¿Y si tengo varios barberos o más de una sede?",
        parrafos: [
          "Cada persona de tu equipo entra al panel con su propio usuario y con los permisos que tú le des: unos solo canjean premios, otros también ven los clientes y las estadísticas. Así nadie usa la cuenta del dueño y sabes quién canjeó cada premio.",
          "Eso sí, ten en cuenta el límite de cada plan: el Starter incluye una sede y dos personas del equipo; el Pro, hasta tres sedes y diez personas.",
        ],
      },
      {
        titulo: "¿Cuánto cuesta y qué plan me conviene?",
        parrafos: [
          "Los planes son mensuales, con IVA incluido, sin permanencia y con pago mes a mes. Una barbería con un solo local y dos barberos suele quedar bien en el Starter, que además tiene el primer mes gratis para que pruebes con tus clientes de verdad.",
        ],
        tabla: [
          ["Plan", "Precio al mes", "Incluye"],
          ["Starter", "$79.990", "100 clientes, 2 personas del equipo, 1 sede, primer mes gratis"],
          ["Pro", "$139.990", "300 clientes, 10 personas del equipo, 3 sedes"],
          ["Business", "A medida", "Para cadenas o necesidades especiales"],
        ],
      },
    ],
    preguntas: [
      {
        q: "¿Mis clientes tienen que descargar una app?",
        a: "No. Se inscriben una sola vez escaneando el QR de tu barbería y escriben su nombre y su celular. En Android la tarjeta queda en Google Wallet; en iPhone, por ahora, se usa desde el navegador.",
      },
      {
        q: "¿Puede un cliente sellarse dos veces el mismo día?",
        a: "Tú eliges el tiempo mínimo que debe pasar entre un sello y otro, y el sistema frena los toques repetidos. Si algo se cuela, puedes anular el sello desde el historial.",
      },
      {
        q: "¿Puedo dar más sellos en ciertos días?",
        a: "Sí. Creas una promoción en el panel, por ejemplo doble sello los martes o durante una semana, y se aplica sola a cada visita de esos días.",
      },
      {
        q: "¿Los clientes reciben avisos aunque no quieran?",
        a: "No. Los avisos al celular solo llegan a quienes aceptaron recibirlos. Tú decides cuándo enviarlos y para qué.",
      },
      {
        q: "¿Qué pasa con los datos de mis clientes?",
        a: "Según la Ley 1581 de 2012, tu barbería es la responsable de los datos de sus clientes. Lazo actúa como encargado, los guarda para que la tarjeta funcione y no los vende.",
      },
    ],
    actualizado: "2026-11-11",
    relacionadas: ["tarjeta-de-sellos-digital", "tarjeta-de-fidelizacion-digital", "cafeterias"],
  },
  {
    ruta: "cafeterias",
    tipo: "sector",
    titulo: "Tarjeta de fidelización para cafeterías con sellos digitales",
    descripcion:
      "Tarjeta de sellos para café con la marca de tu cafetería: el cliente suma un sello cada vez que viene y tú ves quién volvió. Primer mes gratis.",
    antetitulo: "Para cafeterías",
    h1: "Tarjeta de fidelización para cafeterías",
    resumen:
      "Una tarjeta de sellos para café con el nombre y los colores de tu cafetería. Tu cliente la guarda en el celular, suma un sello con cada visita acercando el teléfono al mostrador, y tú ves en un panel quién es de la casa y quién hace rato no pasa.",
    secciones: [
      {
        titulo: "¿Sirve una tarjeta de sellos en una cafetería?",
        parrafos: [
          "Sí, y es de los negocios donde más natural resulta. Un café es una compra pequeña y repetida: cuesta poco, se disfruta rápido y se vuelve a querer pronto. La tarjeta de sellos convierte ese hábito en un pequeño juego: «ya llevo seis, me faltan cuatro».",
          "El reto de la cafetería es otro: cada vez que alguien paga un café, es probable que haya una fila atrás. La tarjeta tiene que sumar el sello en un segundo, sin conversación ni papeles.",
        ],
      },
      {
        titulo: "¿Cada cuánto vuelve un cliente de cafetería?",
        parrafos: [
          "Mucho más seguido que en otros negocios, y con ritmos muy distintos. Hay quien pasa todas las mañanas camino al trabajo, quien viene los fines de semana a quedarse un rato largo y quien llega solo cuando hay una reunión cerca. Como tú los ves a todos, conoces estos perfiles mejor que nadie.",
          "Por eso la tarjeta de una cafetería junta sellos rápido. Si cada visita suma, una persona de rutina puede llegar al premio en pocas semanas, y eso mantiene viva la costumbre de venir.",
        ],
        lista: [
          "Los de la rutina diaria: llenan la tarjeta rápido y se sienten premiados seguido.",
          "Los de fin de semana: vienen menos veces, pero con más gasto por visita. Una promoción de sábado o domingo los motiva.",
          "Los de paso: el QR en la caja es su forma más fácil de entrar al club.",
        ],
      },
      {
        titulo: "¿Cómo podría ser la tarjeta de una cafetería?",
        parrafos: [
          "Esto es un ejemplo, tú lo ajustas a tus márgenes. Una tarjeta de 10 sellos, un sello por cada café o bebida, y el décimo es una bebida de la casa o un café con un pan de regalo.",
          "Con un ritmo de visitas frecuente, diez sellos se llenan en un plazo corto, y eso es bueno: el premio llega cuando el cliente todavía se acuerda de por qué empezó la tarjeta. Si tu producto tiene margen ajustado, puedes poner más sellos o un premio más pequeño.",
        ],
        tabla: [
          ["Elemento", "Ejemplo para una cafetería"],
          ["Sellos", "10"],
          ["Cómo se gana un sello", "Una bebida de la carta"],
          ["Premio", "Una bebida de la casa o un café con un pan de regalo"],
          ["Logo y colores", "Los de tu cafetería, con tu sello y el nombre de tu club"],
        ],
      },
      {
        titulo: "¿Qué promociones sirven en una cafetería?",
        parrafos: [
          "Las que mueven las horas y los días en que el local se siente vacío. En una cafetería suele haber picos marcados, como la mañana y el almuerzo, y valles largos, como la tarde. La promoción es una herramienta para acercar gente a esas horas.",
        ],
        lista: [
          "Doble sello en la tarde o un día entre semana que esté flojo: se crea en el panel y se aplica sola.",
          "Cumpleaños: el panel te muestra quién cumple años este mes, y puedes darle un detalle como una bebida de cortesía al completar su sello.",
                    "Producto nuevo de la carta: un doble sello por una semana para animar a probarlo.",
        ],
      },
      {
        titulo: "¿Cómo usar los avisos sin cansar al cliente?",
        parrafos: [
          "Enviando pocos y con algo concreto que ofrecer. Un cliente de cafetería ya recibe mensajes de todo tipo en el celular, así que un aviso tuyo debe valer la pena. Recuerda que solo llegan a quienes aceptaron recibirlos.",
        ],
        lista: [
          "Un aviso a la hora correcta: el de «doble sello esta tarde» funciona mejor a media mañana que a las diez de la noche.",
          "Frases cortas con un solo mensaje: qué ofreces, hasta cuándo y listo.",
          "Aprovecha la lista de «a quién le falta poco» para mandar el recordatorio justo a quienes están cerca del premio.",
          "Si alguien dejó de venir, un solo mensaje amable basta. No hace falta insistir.",
        ],
      },
      {
        titulo: "¿Cómo se ve en el mostrador de la cafetería?",
        parrafos: [
          "Con un cartel QR en la caja y una etiqueta NFC adhesiva pegada junto a ella. El cliente nuevo escanea el QR una sola vez, escribe su nombre y su celular y la tarjeta queda lista; no descarga ninguna aplicación.",
          "En Android la guarda en Google Wallet y los sellos se actualizan solos. En iPhone, por ahora, usa la tarjeta desde el navegador. Para sumar el sello, acerca el celular a la etiqueta mientras paga. No hay lector ni datáfono de por medio, así que no se alarga la fila.",
          "Para cuidar la tarjeta, tú eliges el tiempo mínimo entre sellos, de modo que nadie junte tres cafés en una misma mañana. El sistema frena los toques repetidos, cada sello queda con fecha y hora y puedes anularlo desde el historial. Si la etiqueta se copia, la cambias y la anterior deja de funcionar.",
        ],
      },
      {
        titulo: "¿Y si mi cafetería tiene varios baristas o varias sedes?",
        parrafos: [
          "Cada persona de tu equipo entra al panel con su propio usuario y con los permisos que tú le des: unos solo canjean premios, otros también ven los clientes y las estadísticas. Así nadie usa la cuenta del dueño y sabes quién canjeó cada premio.",
          "El Starter cubre una sede y dos personas del equipo. Si tienes más turnos o hasta tres sedes, el plan Pro es el que sigue.",
        ],
      },
      {
        titulo: "¿Cuánto cuesta y cuál plan elegir?",
        parrafos: [
          "Los planes son mensuales, con IVA incluido y sin permanencia. Una cafetería pequeña con un solo local suele empezar en el Starter, que tiene el primer mes gratis para probar con tus clientes habituales.",
        ],
        tabla: [
          ["Plan", "Precio al mes", "Incluye"],
          ["Starter", "$79.990", "100 clientes, 2 personas del equipo, 1 sede, primer mes gratis"],
          ["Pro", "$139.990", "300 clientes, 10 personas del equipo, 3 sedes"],
          ["Business", "A medida", "Para cadenas o necesidades especiales"],
        ],
      },
    ],
    preguntas: [
      {
        q: "¿La tarjeta hace la fila más lenta?",
        a: "No. El cliente acerca el celular a la etiqueta NFC del mostrador mientras paga y el sello se marca. No hay lector ni datáfono de por medio.",
      },
      {
        q: "¿Qué pasa si un cliente de cafetería no tiene Android?",
        a: "En iPhone, por ahora, usa la tarjeta desde el navegador. En Android la guarda en Google Wallet y los sellos se actualizan solos.",
      },
      {
        q: "¿Puedo hacer que un día valga doble sello?",
        a: "Sí. Desde el panel creas una promoción, por ejemplo doble sello en la tarde o un día flojo, y se aplica sola.",
      },
      {
        q: "¿Cómo evito que alguien se selle varias veces seguidas?",
        a: "Tú eliges el tiempo mínimo entre sellos y el sistema frena los toques repetidos. Además, cada sello queda en un historial donde puedes anularlo.",
      },
      {
        q: "¿Lazo vende los datos de mis clientes?",
        a: "No. Según la Ley 1581 de 2012, tu cafetería es la responsable de los datos de sus clientes y Lazo es el encargado. Los datos no se venden.",
      },
    ],
    actualizado: "2026-11-11",
    relacionadas: ["tarjeta-de-sellos-digital", "tarjeta-de-fidelizacion-digital", "salones-de-belleza"],
  },
  {
    ruta: "salones-de-belleza",
    tipo: "sector",
    titulo: "Tarjeta de fidelización para salones de belleza digital",
    descripcion:
      "Tarjeta de fidelización para salones de belleza, peluquerías, uñas y spa: sellos con tu marca, sin app, y un panel que te dice quién volvió y quién no.",
    antetitulo: "Para salones de belleza",
    h1: "Tarjeta de fidelización para salones de belleza",
    resumen:
      "Una tarjeta de sellos con la marca de tu salón, peluquería, estudio de uñas o spa. Tu clienta se inscribe con un QR, suma sellos en cada visita y tú ves en un panel quién volvió, a quién le toca su próxima cita y quién cumple años este mes.",
    secciones: [
      {
        titulo: "¿Una tarjeta de sellos sirve en un salón de belleza?",
        parrafos: [
          "Sí, siempre que el premio y los sellos respeten cómo funciona tu salón. En belleza hay servicios muy distintos: un retoque de uñas no se parece a un tratamiento de spa ni a un cambio de color. La tarjeta funciona mejor cuando reconoce esa diferencia en lugar de tratar todo igual.",
          "Esto aplica tanto a un salón grande con varias estilistas como a una peluquería de barrio o a un estudio de uñas de una sola persona.",
        ],
      },
      {
        titulo: "¿Cada cuánto vuelve una clienta de un salón?",
        parrafos: [
          "Depende mucho del servicio, y ahí está la clave del sector. Las uñas se retocan en pocas semanas; un corte o un peinado, en un plazo mayor; un tinte o un tratamiento, según cuánto crezca el pelo; y un día de spa suele ser más ocasional. Cada servicio trae su propio ritmo.",
          "Por eso conviene pensar el plan de fidelización por tipo de servicio, no con una regla única. Y como muchas clientas combinan servicios, la tarjeta puede ser el hilo que las mantiene viniendo a un mismo lugar.",
        ],
        lista: [
          "Servicios frecuentes (uñas, cejas, peinados): llenan sellos más rápido.",
          "Servicios de intervalo medio (corte, tinte, tratamientos): una visita cada tantas semanas.",
          "Servicios ocasionales (spa, ocasiones especiales): vienen menos, pero el panel te muestra cuándo conviene recordarles.",
        ],
      },
      {
        titulo: "¿Cómo podría ser la tarjeta de un salón de belleza?",
        parrafos: [
          "Este es un ejemplo para que te hagas una idea; tú decides. Una tarjeta de 6 sellos, un sello por cada visita, y al sexto, un servicio adicional de regalo, como un tratamiento de hidratación, un diseño de uñas o un masaje corto.",
          "El premio en un salón funciona bien cuando es un servicio extra y no solo un descuento: la clienta prueba algo nuevo, y es posible que después lo pida de pago. Si tienes servicios de precio muy distinto, puedes pensar en una tarjeta aparte para el servicio más frecuente.",
        ],
        tabla: [
          ["Elemento", "Ejemplo para un salón de belleza"],
          ["Sellos", "6"],
          ["Cómo se gana un sello", "Cada visita de servicio"],
          ["Premio", "Un servicio adicional de regalo, como un tratamiento o un diseño de uñas"],
          ["Logo y colores", "Los de tu salón, con tu sello y el nombre de tu club"],
        ],
      },
      {
        titulo: "¿Qué promociones sirven en una peluquería, un salón de uñas o un spa?",
        parrafos: [
          "Las que ayudan a llenar la agenda en los días tranquilos y a que cada clienta pruebe más de un servicio. Muchos salones tienen un día de semana más calmado y fechas de mucho movimiento, como diciembre o antes de eventos. La promoción se hace para equilibrar.",
        ],
        lista: [
          "Doble sello en el día más tranquilo de la semana: se crea una vez y se aplica sola.",
          "Cumpleaños: el panel te muestra las cumpleañeras del mes. Un detalle, como un premio de cumpleaños o un servicio pequeño, funciona muy bien.",
                    "Para quien lleva tiempo sin venir: un aviso para invitarla a volver, solo si aceptó recibir avisos.",
        ],
      },
      {
        titulo: "¿Cómo usar los avisos sin molestar a las clientas?",
        parrafos: [
          "Con respeto por su tiempo y su agenda. Los avisos de Lazo llegan al celular solo de quienes aceptaron recibirlos. En un salón, el mejor aviso suele ser el que ayuda a pedir cita.",
        ],
        lista: [
          "Recuerda el momento oportuno: a quien se hizo las uñas hace unas semanas le sirve un aviso; a quien se hizo un tinte ayer, no.",
          "Un mensaje corto, con una sola idea: qué hay, hasta qué día y cómo pedir la cita.",
          "No mandes lo mismo a todas. Usa las listas del panel, como «a quién le falta poco» o «quién dejó de venir».",
          "Evita insistir: un aviso a tiempo basta, y la clienta decide.",
        ],
      },
      {
        titulo: "¿Cómo se ve en el mostrador del salón?",
        parrafos: [
          "Con un cartel QR en la recepción y una etiqueta NFC adhesiva pegada en el mostrador donde se paga. La clienta nueva escanea el QR una vez, escribe su nombre y su celular, y listo; no descarga ninguna aplicación.",
          "En Android guarda la tarjeta en Google Wallet y los sellos se actualizan solos. En iPhone, por ahora, usa la tarjeta desde el navegador. Para sumar un sello, acerca el celular a la etiqueta al pagar. No necesitas lector ni datáfono.",
          "Para evitar abusos, tú eliges el tiempo mínimo entre sellos y el sistema frena los toques repetidos. Cada sello queda con fecha y hora, puedes anularlo desde el historial y, si alguien copia la etiqueta, la cambias y la anterior deja de funcionar.",
        ],
      },
      {
        titulo: "¿Y si tengo varias estilistas, manicuristas o más de una sede?",
        parrafos: [
          "Cada persona de tu equipo entra al panel con su propio usuario y con los permisos que tú le des: unos solo canjean premios, otros también ven los clientes y las estadísticas. Así nadie usa la cuenta del dueño y sabes quién canjeó cada premio.",
          "El Starter incluye una sede y dos personas del equipo; el Pro llega hasta tres sedes y diez personas. Piensa en cuántas personas atienden en tu salón antes de elegir.",
        ],
      },
      {
        titulo: "¿Cuánto cuesta y cuál plan me conviene?",
        parrafos: [
          "Los planes son mensuales, con IVA incluido, sin permanencia y con pago mes a mes. Un estudio pequeño suele empezar en el Starter, que tiene el primer mes gratis; un salón con varias estilistas o sedes mira el Pro.",
        ],
        tabla: [
          ["Plan", "Precio al mes", "Incluye"],
          ["Starter", "$79.990", "100 clientes, 2 personas del equipo, 1 sede, primer mes gratis"],
          ["Pro", "$139.990", "300 clientes, 10 personas del equipo, 3 sedes"],
          ["Business", "A medida", "Para cadenas o necesidades especiales"],
        ],
      },
    ],
    preguntas: [
      {
        q: "¿La tarjeta sirve para uñas, peluquería y spa a la vez?",
        a: "Sí, es una tarjeta de sellos con la marca de tu negocio. Tú decides qué visita o servicio suma un sello y cuál es el premio.",
      },
      {
        q: "¿Puedo premiar con un servicio en lugar de un descuento?",
        a: "Sí. Cuando la clienta completa los sellos, el premio aparece en su tarjeta y lo canjeas desde el panel, una sola vez. Qué regalas lo defines tú.",
      },
      {
        q: "¿Cómo sé cuándo escribirle a una clienta?",
        a: "El panel te muestra quién volvió, quién dejó de venir y a quién le falta poco. Con esas listas decides a quién avisar, y solo llegan a quienes aceptaron recibir avisos.",
      },
      {
        q: "¿Las clientas deben bajar una aplicación?",
        a: "No. Se inscriben una sola vez con un QR, con nombre y celular. En Android la guardan en Google Wallet; en iPhone, por ahora, la usan desde el navegador.",
      },
      {
        q: "¿Quién es responsable de los datos de las clientas?",
        a: "Según la Ley 1581 de 2012, tu salón es el responsable de los datos de sus clientas. Lazo es el encargado y no vende los datos.",
      },
    ],
    actualizado: "2026-11-11",
    relacionadas: ["tarjeta-de-sellos-digital", "tarjeta-de-fidelizacion-digital", "barberias"],
  },
];
