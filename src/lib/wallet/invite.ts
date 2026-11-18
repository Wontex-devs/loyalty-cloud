/** Billeteras donde un cliente tiene guardada su tarjeta. */
export type WalletKind = "apple" | "google";

export const WALLET_LABEL: Record<WalletKind, string> = { apple: "Apple Wallet", google: "Google Wallet" };

/**
 * Mensaje de WhatsApp con el enlace de la tarjeta. Si el cliente aún no la tiene en la
 * billetera, lo invita a guardarla (así le llegan los avisos de sellos, premios y cercanía).
 */
export function cardMessage(first: string, businessName: string, cardUrl: string, inWallet: boolean) {
  const hola = first ? `Hola ${first}` : "Hola";
  return inWallet
    ? `${hola}, esta es tu tarjeta de ${businessName}: ${cardUrl}`
    : `${hola}, esta es tu tarjeta de ${businessName}: ${cardUrl}\nÁbrela y toca «Agregar a Apple Wallet» o «Agregar a la Billetera de Google». Así la tienes siempre a mano y te avisamos de tus sellos, tus premios y cuando estés cerca.`;
}

/** Enlace wa.me para abrir el chat con el mensaje escrito (lo envía el empleado, uno a uno). */
export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
