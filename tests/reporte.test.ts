// Reporte mensual del dueño: cifras por mes en la zona horaria del comercio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { change, monthKey, monthlyReport, previousMonth, reportHighlights, reportMonths, reportText } from "../src/lib/domain/reporte.ts";
import type { Customer, LoyaltyCard, Redemption, Reward, Visit, WalletNotice } from "../src/lib/domain/types.ts";

const TZ = "America/Bogota";
const cliente = (id: string, fullName: string, createdAt: string, extra: Partial<Customer> = {}): Customer =>
  ({ id, businessId: "b", fullName, phone: "+57300" + id, termsAcceptedAt: createdAt, marketingConsent: true, createdAt, ...extra }) as Customer;
const tarjeta = (id: string, customerId: string, currentStamps: number, lastVisitAt?: string): LoyaltyCard =>
  ({ id, businessId: "b", programId: "p", customerId, publicToken: "t" + id, status: "active", currentStamps, totalVisits: 0, lastVisitAt, createdAt: "2026-09-01T12:00:00Z" }) as LoyaltyCard;
let n = 0;
const visita = (cardId: string, createdAt: string, extra: Partial<Visit> = {}): Visit =>
  ({ id: `v${++n}`, businessId: "b", cardId, kind: "visit", delta: 1, staffId: "s", idempotencyKey: `k${n}`, createdAt, ...extra }) as Visit;

test("reporte: meses en la zona horaria del comercio", () => {
  // 1 de noviembre 03:00 UTC = 31 de octubre 22:00 en Bogotá.
  assert.equal(monthKey("2026-11-01T03:00:00Z", TZ), "2026-10");
  assert.equal(monthKey("2026-11-01T06:00:00Z", TZ), "2026-11");
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.deepEqual(reportMonths("2026-09-15T12:00:00Z", TZ, new Date("2026-11-22T12:00:00Z")), ["2026-11", "2026-10", "2026-09"]);
  assert.equal(change(15, 10), "+50 %");
  assert.equal(change(5, 10), "−50 %");
  assert.equal(change(10, 10), "igual");
  assert.equal(change(3, 0), null);
});

test("reporte: visitas, clientes, recordatorios, mejores y enfriados", () => {
  const customers = [
    cliente("1", "Ana Gómez", "2026-09-10T12:00:00Z"),
    cliente("2", "Beto Ruiz", "2026-11-05T12:00:00Z"),
    cliente("3", "Carla Díaz", "2026-10-02T12:00:00Z"),
    cliente("4", "Dani Borrado", "2026-10-02T12:00:00Z", { anonymizedAt: "2026-11-01T00:00:00Z" }),
  ];
  const cards = [
    tarjeta("c1", "1", 4, "2026-11-20T15:00:00Z"),
    tarjeta("c2", "2", 2, "2026-11-12T15:00:00Z"),
    tarjeta("c3", "3", 7, "2026-10-20T15:00:00Z"),
    tarjeta("c4", "4", 3, "2026-10-21T15:00:00Z"),
  ];
  const revertida = visita("c2", "2026-11-13T15:00:00Z");
  const visits = [
    visita("c1", "2026-10-05T15:00:00Z"),
    visita("c1", "2026-11-10T15:00:00Z"), // lunes
    visita("c1", "2026-11-20T15:00:00Z"), // viernes
    visita("c1", "2026-11-16T15:00:00Z"), // lunes
    visita("c2", "2026-11-12T15:00:00Z"),
    revertida,
    visita("c2", "2026-11-13T16:00:00Z", { kind: "reversal", delta: -1, reversesVisitId: revertida.id }),
    visita("c3", "2026-10-20T15:00:00Z"),
    visita("c4", "2026-10-21T15:00:00Z"),
  ];
  const rewards = [{ id: "r1", businessId: "b", cardId: "c1", programId: "p", name: "Café", status: "redeemed", earnedAt: "2026-11-16T15:00:00Z" }] as Reward[];
  const redemptions = [{ id: "x1", businessId: "b", rewardId: "r1", cardId: "c1", staffId: "s", createdAt: "2026-11-16T15:05:00Z" }] as Redemption[];
  const walletNotices = [
    { id: "n1", businessId: "b", cardId: "c1", kind: "winback", ref: "w", title: "t", body: "b", status: "sent", createdAt: "2026-11-08T15:00:00Z" },
    { id: "n2", businessId: "b", cardId: "c3", kind: "almost", ref: "a", title: "t", body: "b", status: "sent", createdAt: "2026-11-09T15:00:00Z" },
    { id: "n3", businessId: "b", cardId: "c3", kind: "campaign", ref: "c", title: "t", body: "b", status: "sent", createdAt: "2026-11-09T15:00:00Z" },
  ] as WalletNotice[];

  const r = monthlyReport({ customers, cards, visits, rewards, redemptions, walletNotices }, "2026-11", TZ, new Date("2026-11-22T12:00:00Z"));
  assert.equal(r.label, "noviembre de 2026");
  assert.equal(r.partial, true);
  assert.equal(r.visits, 4, "la visita revertida no cuenta");
  assert.equal(r.prevVisits, 3);
  assert.equal(r.activeCustomers, 2);
  assert.equal(r.prevActiveCustomers, 3);
  assert.equal(r.newCustomers, 1);
  assert.equal(r.returningCustomers, 1, "Ana ya había venido en octubre");
  assert.equal(r.rewardsEarned, 1);
  assert.equal(r.redemptions, 1);
  assert.equal(r.remindersSent, 2, "las campañas no cuentan como recordatorio");
  assert.equal(r.remindersReturned, 1);
  assert.deepEqual(r.topCustomers[0], { name: "Ana Gómez", visits: 3, stamps: 4 });
  assert.equal(r.bestWeekday, 0, "lunes");
  // Carla vino en octubre y no en noviembre; Dani también, pero borró sus datos.
  assert.equal(r.coolingCount, 1);
  assert.equal(r.cooling[0].name, "Carla Díaz");

  const frases = reportHighlights(r);
  assert.match(frases[0], /^En lo que va de noviembre te visitaron 2 clientes \(4 visitas en total\)\.$/);
  assert.ok(frases.some((f) => /trajeron de vuelta a 1 cliente \(de 2 enviados\)/.test(f)));
  assert.ok(frases.some((f) => /mejor día fue el lunes/.test(f)));
  const texto = reportText(r, "Selah");
  assert.match(texto, /^\*Selah · Reporte de noviembre de 2026\* \(parcial\)/);
  assert.match(texto, /1\. Ana Gómez · 3 visitas/);
  assert.match(texto, /1 cliente vino el mes anterior y aún no ha vuelto\./);

  const oct = monthlyReport({ customers, cards, visits, rewards, redemptions, walletNotices }, "2026-10", TZ, new Date("2026-11-22T12:00:00Z"));
  assert.equal(oct.partial, false);
  assert.match(reportHighlights(oct)[0], /^En octubre te visitaron 3 clientes/);
  const vacio = monthlyReport({ customers: [], cards: [], visits: [], rewards: [], redemptions: [], walletNotices: [] }, "2026-08", TZ, new Date("2026-11-22T12:00:00Z"));
  assert.deepEqual(reportHighlights(vacio), ["En agosto no se registraron visitas."]);
});
