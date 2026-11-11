import type { Pagina } from "./tipos";
import { EMPRESA } from "@/lib/config";

/**
 * Textos legales de Lazo como empresa (Ley 1581 de 2012 y Decreto 1074 de 2015).
 * Salen de docs/legal/ y deben revisarse con un abogado. La política que acepta cada cliente final
 * al inscribirse es otra: la de cada comercio, en /join/<comercio>/terminos.
 */
const responsable = `${EMPRESA.nombre}, titular de la marca Lazo, con domicilio en ${EMPRESA.ciudad}. NIT: ${EMPRESA.nit}. Correo: ${EMPRESA.correo}. WhatsApp: ${EMPRESA.telefono}.`;

export const LEGAL: Pagina[] = [
  {
    ruta: "politica-de-datos",
    tipo: "legal",
    titulo: "Política de tratamiento de datos personales · Lazo",
    descripcion: "Cómo trata Lazo los datos personales según la Ley 1581 de 2012: quién es responsable, para qué se usan, tus derechos y cómo ejercerlos.",
    antetitulo: "Legal",
    h1: "Política de tratamiento de datos personales",
    resumen:
      "Esta política explica qué datos personales trata Lazo, para qué, quién es responsable de cada uno y cómo puedes conocerlos, corregirlos o pedir que se borren, según la Ley 1581 de 2012 y el Decreto 1074 de 2015.",
    actualizado: "2026-11-11",
    secciones: [
      { titulo: "¿Quién es el responsable?", parrafos: [responsable, "Rige desde el 11 de noviembre de 2026."] },
      {
        titulo: "¿Cuándo Lazo es responsable y cuándo es encargado?",
        parrafos: [
          "Lazo trata dos tipos de datos. Los de los clientes de cada negocio los trata por cuenta de ese negocio: ahí el negocio es el responsable y Lazo es el encargado. Los de las personas que usan el panel y de quienes nos escriben los trata Lazo como responsable.",
        ],
        tabla: [
          ["Datos", "Responsable", "Lazo actúa como"],
          ["Clientes de cada negocio: nombre, celular, correo, cumpleaños, visitas y premios", "El negocio", "Encargado"],
          ["Personas que usan el panel: nombre, correo, rol y registros de acceso", "Lazo", "Responsable"],
          ["Personas que escriben por WhatsApp o correo", "Lazo", "Responsable"],
        ],
      },
      {
        titulo: "¿Para qué usamos los datos?",
        lista: [
          "Crear y mantener las cuentas del panel y dar soporte.",
          "Operar la tarjeta de fidelización de cada negocio: inscribir clientes, registrar visitas y premios, y enviar los avisos que el cliente aceptó.",
          "Proteger la plataforma y prevenir fraudes.",
          "Facturar y cumplir obligaciones legales y contables.",
          "Responder a quien nos contacta y, si lo autoriza, enviarle información de Lazo.",
        ],
        parrafos: ["Lazo no vende datos personales, no los comparte entre negocios y no los usa para publicidad de terceros."],
      },
      {
        titulo: "¿Pedimos datos sensibles o de menores?",
        parrafos: [
          "No. Lazo no pide datos sensibles. El programa no está dirigido a menores de edad; si un negocio inscribe a un menor, debe contar con la autorización de su representante legal.",
        ],
      },
      {
        titulo: "¿Cuáles son tus derechos?",
        lista: [
          "Conocer, actualizar y corregir tus datos.",
          "Pedir prueba de la autorización que diste.",
          "Saber cómo se usan tus datos.",
          "Revocar la autorización y pedir que se borren, cuando la ley lo permita.",
          "Consultar tus datos gratis.",
          "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).",
        ],
      },
      {
        titulo: "¿Cómo ejercerlos?",
        parrafos: [
          `Escríbenos a ${EMPRESA.correo} con tu nombre, lo que pides y un dato para contactarte. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, prorrogables según la ley.`,
          "Si eres cliente de un negocio que usa Lazo, el responsable de tus datos es ese negocio: escríbele a él. También puedes dejar de recibir avisos desde tu propia tarjeta. Lazo apoya al negocio para atender tu solicitud.",
        ],
      },
      {
        titulo: "¿Qué proveedores usamos?",
        parrafos: [
          "Usamos proveedores de tecnología para la base de datos y el acceso (Supabase), el alojamiento de la página (Vercel), la tarjeta en el celular cuando el cliente la agrega (Google Wallet) y el envío de correos. Algunos guardan datos fuera de Colombia. Los usamos solo para operar Lazo y con medidas de seguridad adecuadas.",
        ],
      },
      {
        titulo: "¿Cómo protegemos y cuánto tiempo guardamos los datos?",
        lista: [
          "Cada negocio solo ve sus propios datos.",
          "Toda la plataforma usa conexión cifrada (HTTPS).",
          "Cada persona del panel entra con su propia cuenta.",
          "Las acciones importantes quedan registradas.",
          "Hay límites de intentos para frenar abusos.",
        ],
        parrafos: [
          "Guardamos los datos mientras exista la relación con el negocio o la persona, y el tiempo que exijan las normas legales y contables. Después los borramos o los dejamos anónimos.",
        ],
      },
      {
        titulo: "¿Qué pasa si cambia esta política?",
        parrafos: ["Publicaremos los cambios en esta página con su fecha. Si el cambio es importante, avisaremos por correo a quienes tengan cuenta en el panel."],
      },
    ],
    relacionadas: ["terminos"],
  },
  {
    ruta: "terminos",
    tipo: "legal",
    titulo: "Términos del servicio para negocios · Lazo",
    descripcion: "Condiciones del servicio de Lazo para negocios: planes, pago mensual con IVA incluido, sin permanencia, cancelación, datos y responsabilidades.",
    antetitulo: "Legal",
    h1: "Términos del servicio para negocios",
    resumen:
      "Estas son las condiciones con las que un negocio usa Lazo: qué incluye el servicio, cuánto cuesta, cómo se paga y se cancela, y qué le toca a cada parte. El acuerdo firmado con cada negocio puede ampliarlas.",
    actualizado: "2026-11-11",
    secciones: [
      { titulo: "¿Quién presta el servicio?", parrafos: [responsable] },
      {
        titulo: "¿Qué incluye Lazo?",
        lista: [
          "Una tarjeta de fidelización digital con la marca del negocio.",
          "Inscripción de clientes con un código QR.",
          "Sellos por toque NFC con una etiqueta en el mostrador.",
          "Premios, promociones y avisos al celular de los clientes que los aceptaron.",
          "Estadísticas del negocio y cuentas propias para cada persona del equipo.",
          "La tarjeta en Google Wallet para los clientes con Android.",
        ],
      },
      {
        titulo: "¿Cuánto cuesta y cómo se paga?",
        tabla: [
          ["Plan", "Incluye", "Precio al mes"],
          ["Starter", "100 clientes, 2 personas del equipo, 1 sede. Primer mes gratis", "$79.990"],
          ["Pro", "300 clientes, 10 personas del equipo, 3 sedes", "$139.990"],
          ["Business", "A la medida", "Se cotiza"],
        ],
        lista: [
          "Precios en pesos colombianos, con IVA incluido.",
          "El pago es mensual. No hay permanencia mínima.",
          "El primer mes gratis del plan Starter empieza el día de la activación. Si no cancelas antes de que termine, se cobra el mes siguiente.",
          "Si superas los límites de tu plan, te avisamos y te proponemos uno mayor. Nunca te cambiamos de plan sin tu aceptación.",
        ],
      },
      {
        titulo: "¿Cómo se cancela?",
        parrafos: [
          `El servicio es mes a mes. Puedes cancelarlo cuando quieras escribiendo a ${EMPRESA.correo} o por WhatsApp, y no se cobra el mes siguiente. Durante los 30 días después de cancelar, puedes pedir una copia de los datos de tus clientes; después los borramos, salvo lo que la ley obligue a conservar.`,
        ],
      },
      {
        titulo: "¿Qué le toca a Lazo?",
        lista: [
          "Mantener la plataforma disponible con esfuerzos razonables. No se garantiza un servicio sin interrupciones.",
          "Dar soporte por WhatsApp y correo.",
          "Hacer copias de seguridad y aplicar medidas de seguridad.",
          "Avisar con anticipación los cambios importantes del servicio.",
        ],
      },
      {
        titulo: "¿Qué le toca al negocio?",
        lista: [
          "Dar datos reales y mantener al día la información del negocio.",
          "Usar Lazo solo para el programa de fidelización de su negocio y para fines lícitos.",
          "Darle una cuenta propia a cada persona del equipo y quitar el acceso a quien se retire.",
          "Cuidar la etiqueta NFC; si se pierde o alguien la copia, cambiarla desde el panel.",
          "Enviar avisos solo a los clientes que los aceptaron.",
          "Completar sus datos de responsable (razón social, NIT y correo) en el panel, porque es el responsable de los datos de sus clientes.",
        ],
      },
      {
        titulo: "¿Cómo se tratan los datos de los clientes?",
        parrafos: [
          "El negocio es el responsable de los datos de sus clientes y Lazo es el encargado: los trata solo para operar la tarjeta del negocio, no los vende y no los comparte con otros negocios. Al inscribirse, cada cliente acepta los términos del programa y la política de datos del negocio, y decide aparte si quiere recibir promociones.",
        ],
      },
      {
        titulo: "¿Hasta dónde responde Lazo?",
        parrafos: [
          "Lazo responde por los daños que cause por su culpa, hasta el valor pagado por el negocio en los 3 meses anteriores al hecho, salvo lo que la ley no permita limitar. No responde por fallas de servicios de terceros que no controla (internet, el celular del cliente, Google Wallet o los proveedores de nube), ni por el mal uso de la plataforma. Los controles del toque NFC reducen los abusos, pero no son infalibles.",
        ],
      },
      {
        titulo: "¿Cuándo se puede suspender el servicio?",
        parrafos: [
          "Por falta de pago de más de 10 días, por un uso ilícito o que ponga en riesgo la plataforma, o por orden de una autoridad. Avisamos antes cuando es posible. Suspender no borra los datos.",
        ],
      },
      {
        titulo: "¿Qué ley aplica?",
        parrafos: ["La ley colombiana. Cualquier diferencia se intenta resolver primero de forma directa, en un plazo de 15 días."],
      },
    ],
    relacionadas: ["politica-de-datos"],
  },
];
