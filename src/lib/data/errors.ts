import { ERROR_MESSAGES } from "@/lib/domain/loyalty-engine";

/** Traduce los códigos que lanzan las funciones de Postgres a mensajes para el usuario. */
const DB_ERRORS: Record<string, string> = {
  ...ERROR_MESSAGES,
  INVALID_BRANDING: "La personalización de la marca no es válida.",
  SLUG_TAKEN: "Ese identificador ya está en uso.",
  BUSINESS_NOT_FOUND: "No se encontró el establecimiento.",
  CONFIRMATION_MISMATCH: "El identificador escrito no coincide. Escríbelo exactamente igual para confirmar.",
  BUSINESS_SUSPENDED: "El establecimiento está suspendido.",
  BUSINESS_UNAVAILABLE: "Este programa no está disponible en este momento.",
  TERMS_REQUIRED: "Debes aceptar los términos y la política de datos.",
  REASON_REQUIRED: "Indica el motivo de la corrección.",
  PHONE_REGISTERED: "Este celular ya tiene una tarjeta con otro nombre. Escribe tu nombre tal como lo registraste o pide tu enlace en el establecimiento.",
  welcome_lt_required: "Los sellos de bienvenida deben ser menos que las visitas necesarias.",
  INVALID_BIRTHDAY: "La fecha de cumpleaños no es válida.",
  INVALID_WALLET_SETTINGS: "Revisa los ajustes de los avisos.",
  INVALID_WALLET_MESSAGE: "Revisa el título y el mensaje del aviso.",
  NO_MARKETING_CONSENT: "Este cliente no aceptó recibir mensajes.",
  CUSTOMER_NOT_FOUND: "No se encontró el cliente.",
  promotions_name_check: "Escribe un nombre de 2 a 60 caracteres.",
  promotions_check: "Revisa las fechas: la promoción puede durar hasta un año.",
  PLAN_LIMIT_CUSTOMERS: "Este programa alcanzó su cupo de clientes. Pide ayuda en el establecimiento.",
  PLAN_LIMIT_STAFF: "Tu plan no permite más personas en el equipo. Desactiva a alguien o cambia de plan.",
  PLAN_LIMIT_LOCATIONS: "Tu plan no permite más sedes activas. Desactiva una o cambia de plan.",
  INVALID_LOCATION: "La sede elegida no es válida o está desactivada.",
  NFC_DISABLED: "Este negocio todavía no activa el toque con el celular.",
  INVALID_TAG: "Esta etiqueta ya no es válida. Pídele al negocio que la actualice.",
  INVALID_NFC_SETTINGS: "Revisa el tiempo mínimo entre toques.",
  PLAN_NOT_FOUND: "El plan no existe.",
  locations_business_id_name_key: "Ya tienes una sede con ese nombre.",
  INVALID_TIMEZONE: "La zona horaria no es válida.",
  RATE_LIMITED: "Hay demasiadas inscripciones en este momento. Inténtalo de nuevo en unos minutos.",
  contact_email_check: "El correo de contacto no es válido.",
  tax_id_check: "Revisa el NIT o documento.",
  legal_name_check: "Revisa la razón social.",
  contact_phone_check: "Revisa el teléfono de contacto.",
  address_check: "Revisa la dirección.",
  ALREADY_ANONYMIZED: "Los datos de este cliente ya se eliminaron.",
  CUSTOMER_ANONYMIZED: "Los datos de este cliente se eliminaron: su tarjeta no se puede reactivar.",
  REWARD_ALREADY_REDEEMED: "No se puede revertir: la recompensa de esa visita ya se canjeó.",
};
// Los códigos más largos primero: "REWARD_ALREADY_REDEEMED" antes que "ALREADY_REDEEMED".
const CODES = Object.keys(DB_ERRORS).sort((a, b) => b.length - a.length);

export function dbErrorMessage(error: { message?: string } | null | undefined, fallback = "No se pudo completar la operación.") {
  const code = CODES.find((k) => error?.message?.includes(k));
  return code ? DB_ERRORS[code] : fallback;
}
