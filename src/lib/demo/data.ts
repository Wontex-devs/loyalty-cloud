/**
 * Datos de demostración (Etapa 1). Se generan de forma determinista para que el
 * render de servidor y de cliente coincidan. Se sustituirán por Supabase en la Etapa 2.
 */
import { DEFAULT_WALLET_SETTINGS } from "../wallet/messages.ts";
import type {
  AuditLog,
  Business,
  BusinessMembership,
  Customer,
  LoyaltyCard,
  LoyaltyProgram,
  Plan,
  Profile,
  Redemption,
  Reward,
  Visit,
} from "@/lib/domain/types";

export const DEMO_NOW = new Date("2026-10-31T20:00:00.000Z");

// PRNG determinista (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261031);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const daysAgo = (d: number, h = 0) =>
  new Date(DEMO_NOW.getTime() - d * 86400000 - h * 3600000).toISOString();
const token = () => {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return Array.from({ length: 22 }, () => abc[Math.floor(rand() * 64)]).join("");
};

export const plans: Plan[] = [
  {
    id: "plan_starter",
    name: "Starter",
    priceMonthly: 79990,
    currency: "COP",
    maxCustomers: 100,
    maxStaff: 2,
    maxPrograms: 1,
    maxLocations: 1,
    features: ["1 programa", "Hasta 100 clientes", "2 empleados", "1 sede"],
  },
  {
    id: "plan_pro",
    name: "Pro",
    priceMonthly: 139990,
    currency: "COP",
    maxCustomers: 300,
    maxStaff: 10,
    maxPrograms: 3,
    maxLocations: 3,
    features: ["3 programas", "Hasta 300 clientes", "10 empleados", "Hasta 3 sedes"],
  },
  {
    id: "plan_business",
    name: "Business",
    priceMonthly: 249000,
    currency: "COP",
    maxCustomers: null,
    maxStaff: null,
    maxPrograms: 10,
    maxLocations: null,
    features: ["Plan a la medida", "Clientes, equipo y sedes según tu negocio", "Soporte prioritario"],
  },
];

export const beautyClub: Business = {
  id: "biz_beauty",
  slug: "beautyclub",
  name: "Beauty Club",
  category: "Salón de uñas",
  city: "Bogotá",
  status: "active",
  planId: "plan_pro",
  timezone: "America/Bogota",
  legal: {},
  walletNotifications: { ...DEFAULT_WALLET_SETTINGS },
  createdAt: daysAgo(142),
  branding: {
    logoText: "BC",
    primary: "#1A1416",
    primaryForeground: "#FFFFFF",
    accent: "#D8A7A7",
    cardBackground: "#EBCFCB",
    cardForeground: "#1A1416",
  },
};

const otherBusinesses: Business[] = [
  ["biz_barber", "elcorte", "El Corte Barbería", "Barbería", "Medellín", "active", "plan_starter", "#0F172A", "#C2A878"],
  ["biz_cafe", "cafealba", "Café Alba", "Cafetería", "Bogotá", "active", "plan_pro", "#3B2A20", "#D9B48F"],
  ["biz_resto", "labrasa", "La Brasa Gourmet", "Restaurante", "Cali", "trial", "plan_starter", "#7F1D1D", "#F5C26B"],
  ["biz_spa", "lotospa", "Loto Spa", "Spa", "Barranquilla", "active", "plan_business", "#134E4A", "#A7D7C5"],
  ["biz_nails2", "glamnails", "Glam Nails Studio", "Salón de uñas", "Bogotá", "suspended", "plan_starter", "#4C1D95", "#E9D5FF"],
  ["biz_bakery", "migapan", "Miga Panadería", "Panadería", "Bucaramanga", "active", "plan_starter", "#78350F", "#FDE68A"],
].map(([id, slug, name, category, city, status, planId, primary, accent], i) => ({
  id,
  slug,
  name,
  category,
  city,
  status: status as Business["status"],
  planId,
  timezone: "America/Bogota",
  legal: {},
  walletNotifications: { ...DEFAULT_WALLET_SETTINGS },
  createdAt: daysAgo(30 + i * 17),
  branding: {
    logoText: name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join(""),
    primary,
    primaryForeground: "#FFFFFF",
    accent,
    cardBackground: accent,
    cardForeground: primary,
  },
}));

export const businesses: Business[] = [beautyClub, ...otherBusinesses];

/** Métricas agregadas para el panel de plataforma (en Etapa 4 vendrán de vistas SQL). */
export const businessStats: Record<string, { customers: number; visits30d: number; rewards30d: number }> = {
  biz_barber: { customers: 184, visits30d: 312, rewards30d: 21 },
  biz_cafe: { customers: 642, visits30d: 1480, rewards30d: 96 },
  biz_resto: { customers: 57, visits30d: 88, rewards30d: 4 },
  biz_spa: { customers: 911, visits30d: 1204, rewards30d: 133 },
  biz_nails2: { customers: 96, visits30d: 0, rewards30d: 0 },
  biz_bakery: { customers: 233, visits30d: 702, rewards30d: 58 },
};

export const profiles: Profile[] = [
  { id: "usr_super", fullName: "Natalia Huertas", email: "admin@plataforma.app", platformRole: "superadmin", createdAt: daysAgo(200) },
  { id: "usr_owner", fullName: "Valentina Ríos", email: "valentina@beautyclub.co", platformRole: "user", createdAt: daysAgo(142) },
  { id: "usr_admin", fullName: "Camila Torres", email: "camila@beautyclub.co", platformRole: "user", createdAt: daysAgo(120) },
  { id: "usr_staff1", fullName: "Laura Gómez", email: "laura@beautyclub.co", platformRole: "user", createdAt: daysAgo(98) },
  { id: "usr_staff2", fullName: "Daniela Pérez", email: "daniela@beautyclub.co", platformRole: "user", createdAt: daysAgo(40) },
  { id: "usr_barber", fullName: "Andrés Mejía", email: "andres@elcorte.co", platformRole: "user", createdAt: daysAgo(30) },
  { id: "usr_cafe", fullName: "Sofía Lozano", email: "sofia@cafealba.co", platformRole: "user", createdAt: daysAgo(47) },
];

export const memberships: BusinessMembership[] = [
  { id: "mem_1", businessId: "biz_beauty", profileId: "usr_owner", role: "owner", canRedeem: true, active: true, createdAt: daysAgo(142) },
  { id: "mem_2", businessId: "biz_beauty", profileId: "usr_admin", role: "admin", canRedeem: true, active: true, createdAt: daysAgo(120) },
  { id: "mem_3", businessId: "biz_beauty", profileId: "usr_staff1", role: "staff", canRedeem: true, active: true, createdAt: daysAgo(98) },
  { id: "mem_4", businessId: "biz_beauty", profileId: "usr_staff2", role: "staff", canRedeem: false, active: true, createdAt: daysAgo(40) },
  { id: "mem_5", businessId: "biz_barber", profileId: "usr_barber", role: "owner", canRedeem: true, active: true, createdAt: daysAgo(30) },
  { id: "mem_6", businessId: "biz_cafe", profileId: "usr_cafe", role: "owner", canRedeem: true, active: true, createdAt: daysAgo(47) },
];

export const beautyProgram: LoyaltyProgram = {
  id: "prg_beauty",
  businessId: "biz_beauty",
  name: "Beauty Club",
  description: "Acumula un sello por cada visita y disfruta tu manicura de cortesía.",
  stampsRequired: 9,
  rewardName: "Manicura gratis",
  rewardDescription: "Manicura tradicional o semipermanente, a elección.",
  minMinutesBetweenVisits: 60,
  rewardExpiryDays: 60,
  welcomeStamps: 0,
  birthdayReward: null,
  terms:
    "Un sello por visita con servicio pagado. La recompensa es personal e intransferible y vence 60 días después de obtenerla.",
  active: true,
  createdAt: daysAgo(142),
};

export const programs: LoyaltyProgram[] = [beautyProgram];

const FIRST = ["María", "Isabella", "Sara", "Juliana", "Mariana", "Paula", "Natalia", "Catalina", "Andrea", "Gabriela", "Luisa", "Alejandra", "Carolina", "Daniela", "Valeria", "Lina", "Manuela", "Ana", "Tatiana", "Juana", "Laura", "Diana", "Ximena", "Salomé"];
const LAST = ["García", "Rodríguez", "Martínez", "López", "Hernández", "Gómez", "Díaz", "Moreno", "Álvarez", "Romero", "Vargas", "Castro", "Ortiz", "Rubio", "Suárez", "Rojas", "Jiménez", "Navarro"];
const STAFF = ["usr_staff1", "usr_staff2", "usr_admin", "usr_owner"];

export const customers: Customer[] = [];
export const cards: LoyaltyCard[] = [];
export const visits: Visit[] = [];
export const rewards: Reward[] = [];
export const redemptions: Redemption[] = [];

// La primera clienta es la tarjeta destacada de la demo.
const FEATURED_TOKEN = "q7Lm2Xv9RkTz4pWb8NcY3a";

for (let i = 0; i < 38; i++) {
  const first = i === 0 ? "Sofía" : FIRST[i % FIRST.length];
  const last = i === 0 ? "Martínez" : pick(LAST);
  const joinedDaysAgo = [96, 120, 74][i] ?? Math.floor(rand() * 135) + 1;
  const customerId = `cus_${(i + 1).toString().padStart(3, "0")}`;
  const marketing = rand() > 0.35;
  customers.push({
    id: customerId,
    businessId: "biz_beauty",
    fullName: `${first} ${last}`,
    phone: `+57 3${Math.floor(rand() * 90 + 10)} ${Math.floor(rand() * 900 + 100)} ${Math.floor(rand() * 9000 + 1000)}`,
    email: rand() > 0.3 ? `${first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${last.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@mail.com` : undefined,
    termsAcceptedAt: daysAgo(joinedDaysAgo),
    marketingConsent: marketing,
    marketingConsentAt: marketing ? daysAgo(joinedDaysAgo) : undefined,
    createdAt: daysAgo(joinedDaysAgo),
  });

  const cardId = `crd_${(i + 1).toString().padStart(3, "0")}`;
  // Visitas: frecuencia variable por clienta.
  const frequency = i === 0 ? 11 : Math.floor(rand() * 20) + 6; // días promedio entre visitas
  const cardVisits: Visit[] = [];
  // Casos guionizados de la demo: 0 → 6/9 sellos; 1 → 8/9 (la próxima visita gana); 2 → recompensa disponible.
  const scripted: Record<number, number[]> = {
    0: Array.from({ length: 15 }, (_, k) => Math.round(96 - k * 6.5)),
    1: Array.from({ length: 17 }, (_, k) => Math.round(120 - k * 7.3)),
    2: Array.from({ length: 9 }, (_, k) => 74 - k * 9),
  };
  const days: number[] = [];
  if (scripted[i]) days.push(...scripted[i]);
  else for (let d = joinedDaysAgo; d >= 0; d -= Math.max(1, Math.round(frequency * (0.6 + rand() * 0.8)))) days.push(d);
  for (const d of days) {
    cardVisits.push({
      id: `vis_${cardId}_${cardVisits.length}`,
      businessId: "biz_beauty",
      cardId,
      kind: "visit",
      delta: 1,
      staffId: pick(STAFF),
      idempotencyKey: `seed_${cardId}_${cardVisits.length}`,
      createdAt: daysAgo(d, Math.floor(rand() * 8) + 1),
    });
  }

  // Ciclos de recompensa
  let stamps = 0;
  let rewardAvailable = false;
  cardVisits.forEach((v) => {
    stamps++;
    if (stamps >= beautyProgram.stampsRequired) {
      stamps = 0;
      const rewardId = `rwd_${v.id}`;
      const earnedAgo = (DEMO_NOW.getTime() - new Date(v.createdAt).getTime()) / 86400000;
      const redeemed = i !== 2 && (earnedAgo > 6 || rand() > 0.6);
      rewards.push({
        id: rewardId,
        businessId: "biz_beauty",
        cardId,
        programId: beautyProgram.id,
        name: beautyProgram.rewardName,
        status: redeemed ? "redeemed" : "available",
        earnedAt: v.createdAt,
        expiresAt: new Date(new Date(v.createdAt).getTime() + 60 * 86400000).toISOString(),
      });
      if (redeemed) {
        redemptions.push({
          id: `red_${v.id}`,
          businessId: "biz_beauty",
          rewardId,
          cardId,
          staffId: pick(STAFF.slice(0, 1).concat(STAFF.slice(2))),
          createdAt: new Date(new Date(v.createdAt).getTime() + Math.min(earnedAgo, 5) * 86400000 * rand()).toISOString(),
        });
      } else rewardAvailable = true;
    }
  });
  visits.push(...cardVisits);

  cards.push({
    id: cardId,
    businessId: "biz_beauty",
    programId: beautyProgram.id,
    customerId,
    publicToken: i === 0 ? FEATURED_TOKEN : token(),
    status: i === 7 ? "blocked" : rewardAvailable ? "reward_available" : "active",
    currentStamps: stamps,
    totalVisits: cardVisits.length,
    lastVisitAt: cardVisits.at(-1)?.createdAt,
    createdAt: daysAgo(joinedDaysAgo),
  });
}

visits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Ejemplo de corrección auditada: una visita revertida.
{
  const target = visits.find((v) => v.cardId === "crd_005");
  if (target) {
    visits.unshift({
      id: "vis_reversal_demo",
      businessId: "biz_beauty",
      cardId: "crd_005",
      kind: "reversal",
      delta: -1,
      reversesVisitId: target.id,
      reason: "Visita registrada por error (servicio no realizado)",
      staffId: "usr_admin",
      idempotencyKey: `reverse:${target.id}`,
      createdAt: new Date(new Date(target.createdAt).getTime() + 1800000).toISOString(),
    });
    const c = cards.find((c) => c.id === "crd_005")!;
    c.currentStamps = Math.max(0, c.currentStamps - 1);
    c.totalVisits -= 1;
  }
}

export const auditLogs: AuditLog[] = [
  ...visits.slice(0, 25).map<AuditLog>((v) => ({
    id: `aud_${v.id}`,
    businessId: v.businessId,
    actorId: v.staffId,
    action: v.kind === "visit" ? "visit.created" : "visit.reversed",
    entity: "visit",
    entityId: v.id,
    metadata: { cardId: v.cardId },
    createdAt: v.createdAt,
  })),
  { id: "aud_p1", businessId: null, actorId: "usr_super", action: "business.suspended", entity: "business", entityId: "biz_nails2", metadata: { reason: "Pago pendiente" }, createdAt: daysAgo(3) },
  { id: "aud_p2", businessId: null, actorId: "usr_super", action: "business.created", entity: "business", entityId: "biz_resto", createdAt: daysAgo(9) },
  { id: "aud_p3", businessId: "biz_beauty", actorId: "usr_owner", action: "program.updated", entity: "loyalty_program", entityId: "prg_beauty", metadata: { field: "rewardExpiryDays" }, createdAt: daysAgo(12) },
].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const DEMO_FEATURED_TOKEN = FEATURED_TOKEN;
