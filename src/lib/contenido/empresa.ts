import type { Pagina } from "./tipos";
import { EMPRESA } from "@/lib/config";

/**
 * Quién está detrás de Lazo. Solo datos confirmados: cuando haya persona responsable, razón social,
 * NIT o casos de clientes con permiso, se agregan aquí (y el NIT/razón social en EMPRESA, src/lib/config.ts).
 */
export const EMPRESA_PAGINAS: Pagina[] = [
  {
    ruta: "quienes-somos",
    tipo: "empresa",
    titulo: "Quiénes somos: el equipo detrás de Lazo",
    descripcion:
      "Lazo es una tarjeta de fidelización digital hecha en Barranquilla por Wontex. Conoce quién la hace, cómo trabajamos y cómo contactarnos.",
    antetitulo: "Sobre Lazo",
    h1: "Quiénes somos",
    resumen: `Lazo es una tarjeta de fidelización digital para negocios locales en Colombia. La hace ${EMPRESA.nombre}, un equipo de ${EMPRESA.localidad} que desarrolla páginas web, automatizaciones e inteligencia artificial para negocios. Creamos Lazo para que una barbería, una cafetería o un salón tengan su propio programa de puntos sin pagar lo que cuesta una app propia.`,
    actualizado: "2026-11-12",
    secciones: [
      {
        titulo: "¿Por qué hicimos Lazo?",
        parrafos: [
          "Porque la tarjeta de cartón se pierde y no le cuenta nada al dueño del negocio. Los programas de puntos grandes están pensados para cadenas, y una app propia es cara y casi nadie la descarga.",
          "Lazo es el punto medio: la tarjeta lleva la marca de tu negocio, vive en el celular de tu cliente sin que descargue nada y te muestra quién vuelve y quién dejó de venir.",
        ],
      },
      {
        titulo: "¿Quién está detrás?",
        parrafos: [
          `Lazo es un producto de ${EMPRESA.nombre}, con domicilio en ${EMPRESA.ciudad}. ${EMPRESA.nombre} también diseña páginas web y automatizaciones para empresas; puedes conocer ese trabajo en wontex-devs.com.`,
          `La empresa está en proceso de registro: el NIT está ${EMPRESA.nit}. Lo publicaremos aquí y en los términos del servicio en cuanto esté asignado.`,
        ],
        tabla: [
          ["Dato", "Detalle"],
          ["Marca", "Lazo"],
          ["Empresa", EMPRESA.nombre],
          ["Ciudad", EMPRESA.ciudad],
          ["NIT", EMPRESA.nit],
          ["Correo", EMPRESA.correo],
          ["WhatsApp", EMPRESA.telefono],
        ],
      },
      {
        titulo: "¿Cómo trabajamos?",
        lista: [
          "Te dejamos la tarjeta lista con tu logo, tus colores y tu premio. No tienes que configurar nada técnico.",
          "Precios en pesos colombianos con IVA incluido, pago mensual y sin permanencia mínima.",
          "Los datos de tus clientes son de tu negocio. Lazo los guarda solo para operar tu tarjeta, como encargado según la Ley 1581 de 2012, y no los vende ni los comparte con otros negocios.",
          "Te atendemos directamente por WhatsApp o correo, en español. No tenemos horario fijo: puedes escribirnos a cualquier hora y cualquier día.",
        ],
      },
      {
        titulo: "¿Qué hace y qué no hace Lazo hoy?",
        parrafos: [
          "Preferimos decirlo claro. Lazo hoy incluye la tarjeta de sellos con tu marca, los sellos por NFC con una etiqueta adhesiva en el mostrador, los premios, los avisos a quienes aceptaron recibirlos, las promociones por fechas y días, las estadísticas del negocio y usuarios propios para tu equipo.",
          "En Android la tarjeta va en Google Wallet. En iPhone, por ahora, se usa desde el navegador: todavía no está en Apple Wallet.",
        ],
      },
      {
        titulo: "¿Cómo nos contactas?",
        parrafos: [
          `Escríbenos por WhatsApp al ${EMPRESA.telefono.replace("+57 ", "")} o a ${EMPRESA.correo}, a cualquier hora. Respondemos preguntas antes de contratar, damos soporte a los negocios y atendemos las solicitudes sobre datos personales según nuestra política de datos.`,
        ],
      },
    ],
    relacionadas: ["tarjeta-de-fidelizacion-digital", "politica-de-datos", "terminos"],
  },
];
