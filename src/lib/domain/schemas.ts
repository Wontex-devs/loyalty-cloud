/**
 * Validaciones Zod compartidas entre formularios (cliente) y Server Actions (Etapa 2+).
 * El servidor siempre vuelve a validar: la validación del cliente es solo UX.
 */
import { z } from "zod";
import { STAMP_ICONS } from "./types.ts";

/** Normaliza teléfonos a formato E.164 simple. País por defecto: Colombia (+57). */
export function normalizePhone(raw: string, defaultCountryCode = "57"): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.replace(/\D/g, "");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) return "+" + digits.slice(2); // prefijo internacional 00
  // "57 300 123 4567" ya trae el indicativo: no se duplica (móviles colombianos de 10 dígitos).
  if (digits.startsWith(defaultCountryCode) && digits.length === defaultCountryCode.length + 10) return "+" + digits;
  digits = digits.replace(/^0+/, "");
  return `+${defaultCountryCode}${digits}`;
}

export const joinSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre").max(80),
  phone: z
    .string()
    .trim()
    .min(7, "Teléfono no válido")
    .max(20)
    .regex(/^[+\d\s()-]+$/, "Teléfono no válido"),
  email: z.union([z.literal(""), z.email("Correo no válido")]).optional(),
  acceptTerms: z.literal(true, { error: "Debes aceptar los términos y la política de datos" }),
  marketingConsent: z.boolean(),
  // Cumpleaños opcional: día y mes, sin año.
  birthMonth: z.number().int().min(1).max(12).optional(),
  birthDay: z.number().int().min(1).max(31).optional(),
});
export type JoinInput = z.infer<typeof joinSchema>;

export const programSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200),
  stampsRequired: z.coerce.number().int().min(2, "Mínimo 2").max(30, "Máximo 30"),
  rewardName: z.string().trim().min(2).max(80),
  rewardDescription: z.string().trim().max(200),
  minMinutesBetweenVisits: z.coerce.number().int().min(0).max(1440),
  rewardExpiryDays: z.coerce.number().int().min(0).max(365),
  welcomeStamps: z.coerce.number().int().min(0, "Mínimo 0").max(5, "Máximo 5"),
  birthdayReward: z.string().trim().max(80, "Máximo 80 caracteres"),
  terms: z.string().trim().max(2000),
});
export type ProgramInput = z.infer<typeof programSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal no válido");
export const brandingSchema = z.object({
  logoText: z.string().trim().min(1).max(3),
  // La base de datos además exige que sea de la carpeta del propio comercio en Storage.
  logoUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ })]),
  coverUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ })]),
  stampIcon: z.enum(STAMP_ICONS),
  font: z.enum(["serif", "sans"]),
  primary: hex,
  primaryForeground: hex,
  accent: hex,
  cardBackground: hex,
  cardForeground: hex,
});

export const businessSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones"),
  category: z.string().min(2),
  city: z.string().min(2),
  planId: z.string().min(1),
});

const optionalText = (min: number, max: number, msg: string) =>
  z.union([z.literal(""), z.string().trim().min(min, msg).max(max, msg)]).optional();

/** Configuración del comercio y datos del responsable del tratamiento (Ley 1581 de 2012). */
export const businessSettingsSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre comercial.").max(80),
  category: z.string().trim().min(2, "Escribe la categoría.").max(60),
  city: z.string().trim().min(2, "Escribe la ciudad.").max(60),
  timezone: z.string().min(3),
  legalName: optionalText(2, 120, "Revisa la razón social."),
  taxId: optionalText(3, 30, "Revisa el NIT o documento."),
  contactEmail: z.union([z.literal(""), z.email("El correo de contacto no es válido.")]).optional(),
  contactPhone: optionalText(7, 30, "Revisa el teléfono de contacto."),
  address: optionalText(5, 200, "Revisa la dirección."),
});
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
export const promotionSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe un nombre").max(60),
    bonusStamps: z.number().int().min(1).max(4),
    startsOn: isoDate,
    endsOn: isoDate,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Elige al menos un día"),
    active: z.boolean(),
  })
  .refine((p) => p.endsOn >= p.startsOn, { message: "La fecha final debe ser igual o posterior a la inicial", path: ["endsOn"] });

export const staffInviteSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email("Correo no válido"),
  role: z.enum(["admin", "staff"]),
  canRedeem: z.boolean(),
});
