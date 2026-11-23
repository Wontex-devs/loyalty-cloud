import { esCodigoTarjeta, limpiarCodigo } from "./code128.ts";

/**
 * Lo que lleva el código QR de cada tarjeta: un enlace con el número, no el número solo.
 * Con el número solo, la cámara normal del celular apenas ofrecía «copiar». Con el enlace, quien atiende
 * puede escanear con cualquier cámara: si tiene sesión del negocio, se abre «Escanear tarjeta» y se suma el sello.
 * Quien no es del negocio solo ve un aviso: el enlace no muestra la tarjeta ni sus datos.
 */
export const RUTA_SELLO = "sello";

/** `base` es la dirección del sitio (SITE_URL), sin barra final. */
export const enlaceDeSello = (codigo: string, base: string) => `${base.replace(/\/$/, "")}/${RUTA_SELLO}/${codigo}`;

/**
 * Número de tarjeta a partir de lo que leyó la cámara o se escribió a mano.
 * Acepta el enlace nuevo (de cualquier dominio de Lazo, por las vistas previas), el número solo de los QR
 * de antes y el número escrito con espacios. Un enlace que no es de una tarjeta no se toma como número.
 */
export function codigoDeLectura(leido: string): string {
  const texto = (leido ?? "").trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) {
    const m = texto.match(new RegExp(`^https?://[^/?#]+/${RUTA_SELLO}/([0-9]{12})/?(?:[?#].*)?$`, "i"));
    return m ? m[1] : "";
  }
  return limpiarCodigo(texto);
}

export const esLecturaDeTarjeta = (leido: string) => esCodigoTarjeta(codigoDeLectura(leido));

/** Contenido del QR de un pase de billetera: el enlace en el dominio de la tarjeta, o el número si no hay dirección. */
export function contenidoQrPase(codigo: string, cardUrl: string): string {
  try {
    return enlaceDeSello(codigo, new URL(cardUrl).origin);
  } catch {
    return codigo;
  }
}
