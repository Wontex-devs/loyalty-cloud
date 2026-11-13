/** Exportación CSV de clientes (UTF-8 con BOM para que Excel respete las tildes). */
import type { CardStatus, Customer, LoyaltyCard } from "./types";

const STATUS: Record<CardStatus, string> = { active: "Activa", reward_available: "Con recompensa", blocked: "Bloqueada" };

// Evita que Excel interprete un nombre como fórmula (=, +, -, @). Los teléfonos se dejan tal cual.
const cell = (v: string | number | undefined | null) => {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?\d[\d ]*$/.test(s))) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV genérico (UTF-8 con BOM, separado por comas, protegido contra fórmulas). */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function customersCsv(customers: Customer[], cards: LoyaltyCard[]) {
  const cardOf = new Map(cards.map((c) => [c.customerId, c]));
  const header = ["Nombre", "Teléfono", "Correo", "Sellos actuales", "Visitas totales", "Última visita", "Estado", "Alta", "Acepta marketing"];
  const rows = customers.map((c) => {
    const k = cardOf.get(c.id);
    return [
      c.fullName,
      c.phone,
      c.email ?? "",
      k?.currentStamps ?? 0,
      k?.totalVisits ?? 0,
      k?.lastVisitAt?.slice(0, 10) ?? "",
      k ? STATUS[k.status] : "",
      c.createdAt.slice(0, 10),
      c.marketingConsent ? "Sí" : "No",
    ];
  });
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
