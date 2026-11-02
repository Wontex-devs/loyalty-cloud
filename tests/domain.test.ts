// Pruebas unitarias de la lógica de dominio (sin base de datos ni navegador).
// Uso: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePublicToken, getProgress, redeemReward, registerVisit, reverseVisit, type LedgerState } from "../src/lib/domain/loyalty-engine.ts";
import { businessSettingsSchema, joinSchema, normalizePhone } from "../src/lib/domain/schemas.ts";
import { can } from "../src/lib/domain/permissions.ts";
import { computeStats, isRewardUsable } from "../src/lib/domain/stats.ts";
import { customersCsv } from "../src/lib/domain/csv.ts";
import type { Customer, LoyaltyCard, LoyaltyProgram, Visit } from "../src/lib/domain/types.ts";

const T0 = new Date("2026-10-01T15:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

const program: LoyaltyProgram = {
  id: "prg", businessId: "biz", name: "Club", description: "", stampsRequired: 3, rewardName: "Manicura",
  rewardDescription: "", minMinutesBetweenVisits: 60, rewardExpiryDays: 30, welcomeStamps: 0, birthdayReward: null, terms: "", active: true, createdAt: T0.toISOString(),
};
const card: LoyaltyCard = {
  id: "crd", businessId: "biz", programId: "prg", customerId: "cus", publicToken: "tok",
  status: "active", currentStamps: 0, totalVisits: 0, createdAt: T0.toISOString(),
};
const empty = (): LedgerState => ({ cards: [{ ...card }], visits: [], rewards: [], redemptions: [], auditLogs: [] });

function visit(state: LedgerState, key: string, at: Date) {
  const r = registerVisit(state, program, { cardId: "crd", staffId: "staff", idempotencyKey: key, now: at });
  assert.ok(r.ok, !r.ok ? r.message : "");
  return r;
}

test("una visita suma un sello y queda auditada", () => {
  const r = visit(empty(), "k1", T0);
  if (!r.ok) return;
  assert.equal(r.state.cards[0].currentStamps, 1);
  assert.equal(r.state.visits.length, 1);
  assert.ok(r.state.auditLogs.some((a) => a.action === "visit.created"));
});

test("la misma clave de idempotencia no suma dos veces", () => {
  const r1 = visit(empty(), "k1", T0);
  if (!r1.ok) return;
  const r2 = registerVisit(r1.state, program, { cardId: "crd", staffId: "staff", idempotencyKey: "k1", now: minutes(120) });
  assert.equal(r2.ok, false);
  assert.equal(!r2.ok && r2.error, "DUPLICATE_REQUEST");
});

test("respeta el tiempo mínimo entre visitas", () => {
  const r1 = visit(empty(), "k1", T0);
  if (!r1.ok) return;
  const r2 = registerVisit(r1.state, program, { cardId: "crd", staffId: "staff", idempotencyKey: "k2", now: minutes(30) });
  assert.equal(!r2.ok && r2.error, "TOO_SOON");
  assert.ok(registerVisit(r1.state, program, { cardId: "crd", staffId: "staff", idempotencyKey: "k2", now: minutes(61) }).ok);
});

test("al completar la meta emite la recompensa y reinicia el ciclo", () => {
  let s = empty();
  for (let i = 0; i < 3; i++) {
    const r = visit(s, `k${i}`, minutes(i * 90));
    if (r.ok) s = r.state;
  }
  assert.equal(s.cards[0].currentStamps, 0);
  assert.equal(s.cards[0].status, "reward_available");
  assert.equal(s.rewards.length, 1);
  assert.equal(getProgress(s.cards[0], program, s.rewards).rewardsAvailable, 1);
});

test("canje: una sola vez, con permiso, no vencida y con tarjeta activa", () => {
  let s = empty();
  for (let i = 0; i < 3; i++) {
    const r = visit(s, `k${i}`, minutes(i * 90));
    if (r.ok) s = r.state;
  }
  const rewardId = s.rewards[0].id;
  assert.equal((redeemReward(s, { rewardId, staffId: "x", canRedeem: false }) as { error?: string }).error, "FORBIDDEN");

  const blocked = { ...s, cards: s.cards.map((c) => ({ ...c, status: "blocked" as const })) };
  assert.equal((redeemReward(blocked, { rewardId, staffId: "x", canRedeem: true, now: minutes(300) }) as { error?: string }).error, "CARD_BLOCKED");

  const late = redeemReward(s, { rewardId, staffId: "x", canRedeem: true, now: minutes(60 * 24 * 40) });
  assert.equal(!late.ok && late.error, "REWARD_EXPIRED");

  const ok = redeemReward(s, { rewardId, staffId: "x", canRedeem: true, now: minutes(300) });
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.equal(ok.state.cards[0].status, "active");
  const again = redeemReward(ok.state, { rewardId, staffId: "x", canRedeem: true, now: minutes(301) });
  assert.equal(!again.ok && again.error, "ALREADY_REDEEMED");
});

test("reversión: no borra la visita y no se repite", () => {
  const r1 = visit(empty(), "k1", T0);
  if (!r1.ok) return;
  const visitId = r1.state.visits[0].id;
  const rv = reverseVisit(r1.state, { visitId, staffId: "owner", reason: "Registro por error" });
  assert.ok(rv.ok);
  if (!rv.ok) return;
  assert.equal(rv.state.visits.length, 2);
  assert.equal(rv.state.cards[0].currentStamps, 0);
  const again = reverseVisit(rv.state, { visitId, staffId: "owner", reason: "Registro por error" });
  assert.equal(!again.ok && again.error, "ALREADY_REVERSED");
});

test("tokens públicos: 128 bits, base64url y sin repetirse", () => {
  const tokens = new Set(Array.from({ length: 2000 }, generatePublicToken));
  assert.equal(tokens.size, 2000);
  for (const t of tokens) assert.match(t, /^[A-Za-z0-9_-]{22}$/);
});

test("normalización de teléfonos colombianos", () => {
  assert.equal(normalizePhone("300 123 4567"), "+573001234567");
  assert.equal(normalizePhone("(300) 123-4567"), "+573001234567");
  assert.equal(normalizePhone("+57 300 123 4567"), "+573001234567");
  assert.equal(normalizePhone("57 300 123 4567"), "+573001234567");
  assert.equal(normalizePhone("0057 300 123 4567"), "+573001234567");
  assert.equal(normalizePhone("+1 305 555 0100"), "+13055550100");
});

test("inscripción: términos obligatorios y marketing aparte", () => {
  const base = { fullName: "Ana", phone: "3001234567", email: "", marketingConsent: false };
  assert.equal(joinSchema.safeParse({ ...base, acceptTerms: false }).success, false);
  assert.equal(joinSchema.safeParse({ ...base, acceptTerms: true }).success, true);
  assert.equal(joinSchema.safeParse({ ...base, acceptTerms: true, email: "no-es-correo" }).success, false);
});

test("configuración del comercio: datos legales opcionales pero válidos", () => {
  const base = { name: "Beauty Club", category: "Uñas", city: "Bogotá", timezone: "America/Bogota" };
  assert.ok(businessSettingsSchema.safeParse(base).success);
  assert.ok(businessSettingsSchema.safeParse({ ...base, contactEmail: "" }).success);
  assert.equal(businessSettingsSchema.safeParse({ ...base, contactEmail: "x" }).success, false);
});

test("permisos por rol", () => {
  assert.ok(can({ role: "owner", canRedeem: false }, "customers.export"));
  assert.equal(can({ role: "admin", canRedeem: true }, "customers.export"), false);
  assert.equal(can({ role: "staff", canRedeem: false }, "rewards.redeem"), false);
  assert.ok(can({ role: "staff", canRedeem: true }, "rewards.redeem"));
  assert.equal(can({ role: "staff", canRedeem: true }, "visits.reverse"), false);
});

test("estadísticas: excluyen revertidas y anuladas, y las series cuadran", () => {
  const now = new Date("2026-10-31T20:00:00");
  const at = (daysAgo: number, h = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const v = (id: string, cardId: string, daysAgo: number): Visit => ({
    id, businessId: "biz", cardId, kind: "visit", delta: 1, staffId: "s1", idempotencyKey: id, createdAt: at(daysAgo),
  });
  const visits: Visit[] = [
    v("a", "c1", 1), v("b", "c1", 3), v("c", "c2", 5), v("d", "c3", 45),
    { ...v("r", "c2", 4), kind: "reversal", delta: -1, reversesVisitId: "c", reason: "error" },
  ];
  const cards = ["c1", "c2", "c3"].map((id, i) => ({ ...card, id, currentStamps: i }));
  const rewards = [
    { id: "w1", businessId: "biz", cardId: "c1", programId: "prg", name: "M", status: "available" as const, earnedAt: at(2) },
    { id: "w2", businessId: "biz", cardId: "c2", programId: "prg", name: "M", status: "void" as const, earnedAt: at(2) },
  ];
  const s = computeStats({ visits, customers: [], cards, rewards, redemptions: [], profiles: [] }, 30, 3, now);
  assert.equal(s.visits, 2); // c está revertida y d queda fuera del periodo
  assert.equal(s.visitsPrev, 1);
  assert.equal(s.reversals, 1);
  assert.equal(s.activeCustomers, 1);
  assert.equal(s.returningCustomers, 1);
  assert.equal(s.rewardsEarned, 1);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily.reduce((a, d) => a + d.value, 0), s.visits);
  assert.equal(s.weekday.reduce((a, b) => a + b, 0), s.visits);
  assert.deepEqual(s.stampDistribution, [1, 1, 1]);
});

test("recompensas vencidas no son utilizables", () => {
  const r = { id: "w", businessId: "b", cardId: "c", programId: "p", name: "M", status: "available" as const, earnedAt: T0.toISOString() };
  assert.ok(isRewardUsable(r));
  assert.equal(isRewardUsable({ ...r, expiresAt: "2000-01-01T00:00:00Z" }), false);
});

test("CSV: escapa comas y comillas y neutraliza fórmulas", () => {
  const customers: Customer[] = [
    { id: "1", businessId: "b", fullName: 'Ana "La" Pérez, hija', phone: "+573001234567", termsAcceptedAt: "", marketingConsent: true, createdAt: "2026-10-01T00:00:00Z" },
    { id: "2", businessId: "b", fullName: "=HYPERLINK(\"x\")", phone: "+573009999999", termsAcceptedAt: "", marketingConsent: false, createdAt: "2026-10-02T00:00:00Z" },
  ];
  const csv = customersCsv(customers, [{ ...card, customerId: "1" }]);
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('"Ana ""La"" Pérez, hija",+573001234567'));
  assert.ok(lines[2].startsWith(`"'=HYPERLINK(""x"")"`));
  assert.ok(lines[1].includes("Activa"));
});

test("promociones: vigencia por fechas y días de la semana", async () => {
  const { activePromotion, localDay } = await import("../src/lib/domain/promotions.ts");
  const tue = new Date("2026-11-03T15:00:00Z"); // martes en Bogotá
  assert.equal(localDay(tue, "America/Bogota").weekday, 2);
  const base = { businessId: "b", startsOn: "2026-11-01", endsOn: "2026-11-30", active: true, createdAt: "2026-10-01T00:00:00Z" };
  const promos = [
    { ...base, id: "p1", name: "Martes doble", bonusStamps: 1, weekdays: [2] },
    { ...base, id: "p2", name: "Triple fin de semana", bonusStamps: 2, weekdays: [6, 7] },
    { ...base, id: "p3", name: "Pausada", bonusStamps: 4, weekdays: [1, 2, 3, 4, 5, 6, 7], active: false },
  ];
  assert.equal(activePromotion(promos, tue, "America/Bogota")?.id, "p1");
  assert.equal(activePromotion(promos, new Date("2026-11-04T15:00:00Z"), "America/Bogota"), null);
  assert.equal(activePromotion(promos, new Date("2026-12-01T15:00:00Z"), "America/Bogota"), null);
});

test("visita con promoción: suma sellos extra y el sobrante pasa al siguiente ciclo", () => {
  let s = empty();
  const go = (key: string, at: Date, bonus = 0) => {
    const r = registerVisit(s, program, { cardId: "crd", staffId: "x", idempotencyKey: key, now: at, bonusStamps: bonus });
    assert.ok(r.ok);
    if (r.ok) s = r.state;
    return r;
  };
  go("a", T0, 1); // 2 sellos
  const r = go("b", minutes(90), 1); // 4 → meta 3: recompensa y queda 1
  assert.ok(r.ok && r.data.reward);
  assert.equal(s.cards[0].currentStamps, 1);
  const rv = reverseVisit(s, { visitId: s.visits[0].id, staffId: "o", reason: "Prueba de reversión" });
  assert.ok(rv.ok && rv.state.cards[0].currentStamps === 0);
});

test("regalo de cumpleaños: uno por año", () => {
  const r1 = registerVisit(empty(), program, { cardId: "crd", staffId: "x", idempotencyKey: "k1", now: T0, birthday: { name: "Esmalte", year: 2026 } });
  assert.ok(r1.ok && r1.data.birthdayReward?.kind === "birthday");
  if (!r1.ok) return;
  assert.equal(r1.state.cards[0].status, "reward_available");
  const r2 = registerVisit(r1.state, program, { cardId: "crd", staffId: "x", idempotencyKey: "k2", now: minutes(120), birthday: { name: "Esmalte", year: 2026 } });
  assert.ok(r2.ok && !r2.data.birthdayReward);
});

test("estadísticas por sede", () => {
  const at = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const v = (id: string, locationId?: string): Visit => ({ id, businessId: "b", cardId: "crd", kind: "visit", delta: 1, staffId: "s", idempotencyKey: id, createdAt: at(2), locationId });
  const locations = [{ id: "l1", businessId: "b", name: "Norte", active: true, createdAt: at(10) }];
  const s = computeStats({ visits: [v("a", "l1"), v("b", "l1"), v("c")], customers: [], cards: [card], rewards: [], redemptions: [], profiles: [], locations }, 7, 3);
  assert.deepEqual(s.byLocation, [{ name: "Norte", visits: 2 }, { name: "Sin sede", visits: 1 }]);
});
