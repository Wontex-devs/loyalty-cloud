/**
 * Páginas públicas de contenido (guías, tipos de negocio y textos legales).
 * Cada página es solo datos: la plantilla `PaginaContenido` las dibuja todas igual.
 */

export interface Seccion {
  /** Título de la sección (h2). Mejor si es una pregunta o lleva la palabra que la gente busca. */
  titulo: string;
  /** Párrafos de texto. El primero debe responder directo a lo que plantea el título. */
  parrafos?: string[];
  /** Lista con viñetas. */
  lista?: string[];
  /** Lista numerada (pasos). */
  pasos?: string[];
  /** Tabla sencilla: primera fila = encabezados. */
  tabla?: string[][];
}

export interface Pregunta {
  q: string;
  a: string;
}

export interface Pagina {
  /** Ruta sin barra inicial, en minúsculas y con guiones: "tarjeta-de-sellos-digital". */
  ruta: string;
  tipo: "guia" | "sector" | "legal";
  /** <title>: máximo 60 caracteres, con la palabra clave al inicio. Se le agrega « · Lazo» si cabe. */
  titulo: string;
  /** Meta description: entre 120 y 155 caracteres. */
  descripcion: string;
  /** Línea corta encima del h1 (por ejemplo «Guía» o «Para barberías»). */
  antetitulo: string;
  h1: string;
  /** Primer párrafo: responde en 40 a 60 palabras qué encontrará la persona. */
  resumen: string;
  secciones: Seccion[];
  /** Preguntas frecuentes de esta página (opcional). */
  preguntas?: Pregunta[];
  /** Fecha de la última actualización real del texto (AAAA-MM-DD). */
  actualizado: string;
  /** Rutas de otras páginas relacionadas para enlazar al final. */
  relacionadas?: string[];
}
