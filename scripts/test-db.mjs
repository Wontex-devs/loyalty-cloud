// Pruebas de base de datos: aplica las migraciones sobre Postgres (PGlite, en memoria)
// y verifica aislamiento multiempresa (RLS), permisos por rol y reglas de negocio.
// Uso: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(readFileSync(join(root, "supabase/tests/supabase-shim.sql"), "utf8"));
const migrationsDir = join(root, "supabase/migrations");
for (const f of readdirSync(migrationsDir).sort()) {
  await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
}

// ---------- Fixture (como superusuario, equivalente a service_role) ----------
const U = {
  super: "00000000-0000-0000-0000-000000000001",
  ownerA: "00000000-0000-0000-0000-00000000000a",
  adminA: "00000000-0000-0000-0000-0000000000aa",
  staffA: "00000000-0000-0000-0000-0000000000a1", // sin permiso de canje
  staffA2: "00000000-0000-0000-0000-0000000000a2", // con permiso de canje
  ownerB: "00000000-0000-0000-0000-00000000000b",
};
for (const [k, id] of Object.entries(U)) {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, `${k}@test.local`, { full_name: k }]);
}
await db.query("update public.profiles set platform_role = 'superadmin' where id = $1", [U.super]);
const A = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id, status)
  values ('negocio-a', 'Negocio A', 'Salón', 'Bogotá', 'plan_pro', 'active') returning id`)).rows[0].id;
const B = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id, status)
  values ('negocio-b', 'Negocio B', 'Café', 'Cali', 'plan_starter', 'active') returning id`)).rows[0].id;
await db.query(`insert into public.loyalty_programs (business_id, name, stamps_required, reward_name, min_minutes_between_visits)
  values ($1, 'Club A', 3, 'Manicura', 60), ($2, 'Club B', 5, 'Café', 60)`, [A, B]);
await db.query(`insert into public.business_memberships (business_id, profile_id, role, can_redeem) values
  ($1, $2, 'owner', true), ($1, $3, 'admin', true), ($1, $4, 'staff', false), ($1, $5, 'staff', true), ($6, $7, 'owner', true)`,
  [A, U.ownerA, U.adminA, U.staffA, U.staffA2, B, U.ownerB]);

// ---------- Utilidades ----------
async function as(user, sql, params = []) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(user ? { sub: user, role: "authenticated" } : { role: "anon" })]);
    await db.query(`set local role ${user ? "authenticated" : "anon"}`);
    const res = await db.query(sql, params);
    await db.query("commit");
    return { ok: true, rows: res.rows, affected: res.affectedRows ?? 0 };
  } catch (e) {
    await db.query("rollback");
    return { ok: false, error: e.message };
  }
}

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n      → ${JSON.stringify(detail)}` : ""}`);
  }
}
const expectError = (r, code) => !r.ok && r.error.includes(code);

const joinProgram = (slug, phone, name = "Cliente Prueba") =>
  as(null, "select * from public.join_program($1, $2, $3, null, true, false)", [slug, name, phone]);

// ---------- Público (anon) ----------
console.log("\nAcceso público");
let r = await as(null, "select * from public.customers");
check("anon no puede leer clientes", expectError(r, "permission denied"), r);
r = await as(null, "select * from public.loyalty_cards");
check("anon no puede leer tarjetas", expectError(r, "permission denied"), r);

r = await joinProgram("negocio-a", "+573001112233", "Ana Prueba");
check("anon se inscribe con join_program", r.ok && r.rows[0]?.existing === false, r);
const tokenA = r.rows[0]?.public_token;
check("token público de 22 caracteres base64url", /^[A-Za-z0-9_-]{22}$/.test(tokenA ?? ""), tokenA);

r = await joinProgram("negocio-a", "+573001112233", "Otro Nombre");
check("un celular inscrito con otro nombre no revela la tarjeta (PHONE_REGISTERED)", expectError(r, "PHONE_REGISTERED") && !JSON.stringify(r).includes(tokenA), r);
r = await joinProgram("negocio-a", "+573001112233", "  ANA   prueba ");
check("mismo celular y mismo nombre (sin importar mayúsculas ni espacios) recupera la tarjeta", r.ok && r.rows[0]?.existing === true && r.rows[0]?.public_token === tokenA, r);
r = await joinProgram("negocio-a", "+573001112233", "Ána Prueba");
check("las tildes no impiden recuperar la tarjeta", r.ok && r.rows[0]?.public_token === tokenA, r);

r = await as(null, "select public.join_program('negocio-a', 'X Y', '+573009999999', null, false, false)");
check("inscripción sin aceptar términos es rechazada", expectError(r, "TERMS_REQUIRED"), r);

r = await as(null, "select public.get_public_card($1) as card", [tokenA]);
const card = r.rows?.[0]?.card;
check("anon ve su tarjeta por token", r.ok && card?.customer_name === "Ana Prueba" && card?.program?.stamps_required === 3, r);
check("la vista pública no expone teléfono ni correo", card && !JSON.stringify(card).includes("300111") && !("email" in card), card);
r = await as(null, "select public.get_public_card('tokenInexistente0000000') as card");
check("token inexistente devuelve null", r.ok && r.rows[0].card === null, r);

r = await as(null, "select public.get_public_business('negocio-a') as b");
check("anon ve la ficha pública del comercio", r.ok && r.rows[0].b?.program?.stamps_required === 3 && !/phone_e164|\+573/.test(JSON.stringify(r.rows[0].b)), r);
r = await as(null, "select public.get_public_business('no-existe') as b");
check("comercio inexistente devuelve null", r.ok && r.rows[0].b === null, r);

r = await as(null, "select public.register_visit(gen_random_uuid(), 'anon-attempt-1')");
check("anon no puede registrar visitas", !r.ok, r);

// ---------- Aislamiento multiempresa ----------
console.log("\nAislamiento multiempresa");
const cardA = (await db.query("select id from public.loyalty_cards where public_token = $1", [tokenA])).rows[0].id;
r = await as(U.ownerB, "select * from public.customers");
check("el comercio B no ve clientes de A", r.ok && r.rows.length === 0, r);
r = await as(U.ownerB, "select * from public.loyalty_cards where id = $1", [cardA]);
check("el comercio B no ve tarjetas de A", r.ok && r.rows.length === 0, r);
r = await as(U.ownerB, "select * from public.businesses");
check("el comercio B solo ve su propio negocio", r.ok && r.rows.length === 1 && r.rows[0].id === B, r);
r = await as(U.staffA, "select * from public.customers");
check("empleado de A ve los clientes de A", r.ok && r.rows.length === 1, r);
r = await as(U.super, "select * from public.businesses");
check("superadmin ve todos los comercios", r.ok && r.rows.length === 2, r);
r = await as(U.super, "select * from public.customers");
check("superadmin NO ve datos personales de clientes", r.ok && r.rows.length === 0, r);
r = await as(U.ownerB, "select public.register_visit($1, 'cross-tenant-001')", [cardA]);
check("B no puede registrar visitas en tarjetas de A", expectError(r, "FORBIDDEN"), r);

// ---------- Visitas ----------
console.log("\nRegistro de visitas");
r = await as(U.staffA, "insert into public.visits (business_id, card_id, kind, delta, idempotency_key) values ($1, $2, 'visit', 1, 'direct-insert-1')", [A, cardA]);
check("no se pueden insertar visitas directamente (solo RPC)", expectError(r, "permission denied"), r);
r = await as(U.staffA, "update public.loyalty_cards set current_stamps = 99 where id = $1", [cardA]);
check("no se pueden modificar sellos directamente", expectError(r, "permission denied"), r);

r = await as(U.staffA, "select public.register_visit($1, 'op-key-0001') as res", [cardA]);
check("empleado registra una visita", r.ok && r.rows[0].res.current_stamps === 1, r);
r = await as(U.staffA, "select public.register_visit($1, 'op-key-0001')", [cardA]);
check("misma clave de idempotencia → DUPLICATE_REQUEST", expectError(r, "DUPLICATE_REQUEST"), r);
r = await as(U.staffA, "select public.register_visit($1, 'op-key-0002')", [cardA]);
check("segunda visita inmediata → TOO_SOON", expectError(r, "TOO_SOON"), r);

// ---------- Programa y roles ----------
console.log("\nRoles y configuración");
r = await as(U.staffA, "update public.loyalty_programs set stamps_required = 2 where business_id = $1", [A]);
check("empleado no puede editar el programa", (r.ok && r.affected === 0) || !r.ok, r);
r = await as(U.ownerA, "update public.loyalty_programs set min_minutes_between_visits = 0 where business_id = $1", [A]);
check("propietario edita el programa", r.ok && r.affected === 1, r);
r = await as(U.ownerB, "update public.loyalty_programs set stamps_required = 2 where business_id = $1", [A]);
check("B no puede editar el programa de A", (r.ok && r.affected === 0) || !r.ok, r);
r = await as(U.adminA, "insert into public.business_memberships (business_id, profile_id, role) values ($1, $2, 'owner')", [A, U.ownerB]);
check("admin no puede crear otro propietario", !r.ok, r);
r = await as(U.adminA, "update public.business_memberships set active = false where profile_id = $1 and business_id = $2", [U.ownerA, A]);
check("admin no puede desactivar al propietario", r.ok && r.affected === 0, r);
r = await as(U.adminA, "update public.business_memberships set can_redeem = true where profile_id = $1 and business_id = $2", [U.staffA, A]);
check("admin cambia permisos de un empleado", r.ok && r.affected === 1, r);
await as(U.adminA, "update public.business_memberships set can_redeem = false where profile_id = $1 and business_id = $2", [U.staffA, A]);
r = await as(U.staffA, "update public.business_memberships set role = 'admin' where profile_id = $1", [U.staffA]);
check("empleado no puede auto-ascenderse", (r.ok && r.affected === 0) || !r.ok, r);
r = await as(U.staffA, "select public.update_business_profile($1, 'Hack', null, null, null, null)", [A]);
check("empleado no puede editar el comercio", expectError(r, "FORBIDDEN"), r);
r = await as(U.ownerA, `select public.update_business_profile($1, null, null, null, null, '{"primary":"red"}'::jsonb)`, [A]);
check("branding con color inválido es rechazado", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, `select public.update_business_profile($1, null, null, null, null, '{"primary":"#112233"}'::jsonb)`, [A]);
check("propietario actualiza su identidad visual", r.ok, r);

// ---------- Recompensas ----------
console.log("\nRecompensas y canjes");
await as(U.staffA, "select public.register_visit($1, 'op-key-0003')", [cardA]);
r = await as(U.staffA, "select public.register_visit($1, 'op-key-0004') as res", [cardA]);
const rewardId = r.rows?.[0]?.res?.reward_id;
check("al completar la meta se emite la recompensa y se reinicia el ciclo", r.ok && rewardId && r.rows[0].res.current_stamps === 0, r);
r = await as(U.staffA, "select status from public.loyalty_cards where id = $1", [cardA]);
check("la tarjeta queda en reward_available", r.rows?.[0]?.status === "reward_available", r);
r = await as(U.staffA, "select public.redeem_reward($1)", [rewardId]);
check("empleado sin permiso no puede canjear", expectError(r, "FORBIDDEN"), r);
r = await as(U.ownerB, "select public.redeem_reward($1)", [rewardId]);
check("otro comercio no puede canjear", expectError(r, "FORBIDDEN"), r);
r = await as(U.staffA2, "select public.redeem_reward($1)", [rewardId]);
check("empleado con permiso canjea", r.ok, r);
r = await as(U.staffA2, "select public.redeem_reward($1)", [rewardId]);
check("segundo canje de la misma recompensa → ALREADY_REDEEMED", expectError(r, "ALREADY_REDEEMED"), r);
r = await as(U.staffA2, "select status from public.loyalty_cards where id = $1", [cardA]);
check("la tarjeta vuelve a activa tras el canje", r.rows?.[0]?.status === "active", r);

// ---------- Reversiones ----------
console.log("\nReversiones auditadas");
const visits = (await db.query("select id, idempotency_key from public.visits where card_id = $1 and kind = 'visit' order by created_at", [cardA])).rows;
const rewardVisit = visits.find((v) => v.idempotency_key === "op-key-0004").id;
r = await as(U.staffA, "select public.reverse_visit($1, 'Registro por error')", [visits[0].id]);
check("empleado no puede revertir visitas", expectError(r, "FORBIDDEN"), r);
r = await as(U.ownerA, "select public.reverse_visit($1, 'no')", [visits[0].id]);
check("reversión sin motivo suficiente es rechazada", expectError(r, "REASON_REQUIRED"), r);
r = await as(U.ownerA, "select public.reverse_visit($1, 'Visita registrada por error')", [rewardVisit]);
check("no se revierte una visita cuya recompensa ya se canjeó", expectError(r, "REWARD_ALREADY_REDEEMED"), r);
await as(U.staffA, "select public.register_visit($1, 'op-key-0005')", [cardA]);
const v5 = (await db.query("select id from public.visits where idempotency_key = 'op-key-0005'")).rows[0].id;
r = await as(U.ownerA, "select public.reverse_visit($1, 'Visita registrada por error') as res", [v5]);
check("propietario revierte una visita (−1)", r.ok && r.rows[0].res.current_stamps === 0, r);
r = await as(U.ownerA, "select public.reverse_visit($1, 'Visita registrada por error')", [v5]);
check("doble reversión → ALREADY_REVERSED", expectError(r, "ALREADY_REVERSED"), r);
r = await as(U.ownerA, "select count(*)::int as n from public.visits where card_id = $1", [cardA]);
check("las visitas originales siguen en el historial", r.rows?.[0]?.n === 5, r);

// Reversión de la visita que generó una recompensa NO canjeada → se anula la recompensa.
await as(U.staffA, "select public.register_visit($1, 'op-key-0006')", [cardA]);
await as(U.staffA, "select public.register_visit($1, 'op-key-0007')", [cardA]);
r = await as(U.staffA, "select public.register_visit($1, 'op-key-0008') as res", [cardA]);
const reward2 = r.rows?.[0]?.res?.reward_id;
const v8 = (await db.query("select id from public.visits where idempotency_key = 'op-key-0008'")).rows[0].id;
r = await as(U.ownerA, "select public.reverse_visit($1, 'Servicio no realizado') as res", [v8]);
const rw2 = (await db.query("select status from public.rewards where id = $1", [reward2])).rows[0];
check("revertir la visita de una recompensa pendiente la anula y devuelve los sellos", r.ok && rw2.status === "void" && r.rows[0].res.current_stamps === 2, { r, rw2 });

// Recompensa vencida: no se canjea (el vencimiento se calcula al leer).
const expired = (await db.query(`insert into public.rewards (business_id, card_id, program_id, name, expires_at)
  select business_id, id, program_id, 'Vencida', now() - interval '1 day' from public.loyalty_cards where id = $1 returning id`, [cardA])).rows[0].id;
r = await as(U.staffA2, "select public.redeem_reward($1)", [expired]);
check("una recompensa vencida no se puede canjear", expectError(r, "REWARD_EXPIRED"), r);
const fresh = (await db.query(`insert into public.rewards (business_id, card_id, program_id, name)
  select business_id, id, program_id, 'Prueba bloqueo' from public.loyalty_cards where id = $1 returning id`, [cardA])).rows[0].id;
r = await as(U.staffA, "select public.set_card_blocked($1, true)", [cardA]);
check("empleado no puede bloquear tarjetas", expectError(r, "FORBIDDEN"), r);
r = await as(U.adminA, "select public.set_card_blocked($1, true)", [cardA]);
check("admin bloquea una tarjeta", r.ok, r);
r = await as(U.staffA2, "select public.redeem_reward($1)", [fresh]);
check("una tarjeta bloqueada no admite canjes", expectError(r, "CARD_BLOCKED"), r);
r = await as(U.adminA, "select public.set_card_blocked($1, false)", [cardA]);
r = await as(U.adminA, "select status from public.loyalty_cards where id = $1", [cardA]);
check("al reactivarla recupera el estado de recompensa pendiente", r.rows?.[0]?.status === "reward_available", r);
await db.query("update public.rewards set status = 'void' where id = $1", [fresh]);

r = await as(U.ownerA, "select public.log_customers_export($1, 3)", [A]);
check("la exportación de clientes queda auditada", r.ok, r);
r = await as(U.adminA, "select public.log_customers_export($1, 3)", [A]);
check("solo el propietario exporta clientes", expectError(r, "FORBIDDEN"), r);

// ---------- Estadísticas ----------
console.log("\nEstadísticas del comercio");
r = await as(U.staffA, "select public.business_stats($1, 30)", [A]);
check("empleado no consulta estadísticas", expectError(r, "FORBIDDEN"), r);
r = await as(U.ownerB, "select public.business_stats($1, 30)", [A]);
check("otro comercio no consulta estadísticas ajenas", expectError(r, "FORBIDDEN"), r);
r = await as(U.adminA, "select public.business_stats($1, 30) as s", [A]);
const st = r.rows?.[0]?.s;
const netVisits = (await db.query(`select count(*)::int n from public.visits v where business_id = $1 and kind = 'visit'
  and not exists (select 1 from public.visits x where x.reverses_visit_id = v.id)`, [A])).rows[0].n;
check("admin obtiene las estadísticas", r.ok && st?.days === 30, r);
check("las visitas revertidas no cuentan", st?.visits === netVisits && st?.reversals === 2, { visits: st?.visits, netVisits, reversals: st?.reversals });
check("la serie diaria cubre el periodo y suma el total", st?.daily?.length === 30 && st.daily.reduce((a, d) => a + d.value, 0) === st.visits, st?.daily?.length);
check("día de la semana (7) y hora (24) cuadran con el total",
  st?.weekday?.length === 7 && st?.hourly?.length === 24 && st.weekday.reduce((a, b) => a + b, 0) === st.visits && st.hourly.reduce((a, b) => a + b, 0) === st.visits);
check("recompensas anuladas no cuentan como emitidas; canjes = 1", st?.rewards_earned === 2 && st?.redemptions === 1, { earned: st?.rewards_earned, red: st?.redemptions });
check("la vencida no figura como disponible", st?.rewards_available === 0, st?.rewards_available);
check("ranking por empleado con visitas y canjes", st?.by_staff?.some((s) => s.name === "staffA" && s.visits > 0) && st.by_staff.some((s) => s.name === "staffA2" && s.redemptions === 1), st?.by_staff);
check("distribución de sellos según la meta del programa", st?.stamp_distribution?.length === 3, st?.stamp_distribution);

// ---------- Inmutabilidad ----------
console.log("\nHistorial inmutable");
r = await db.query("delete from public.visits where id = $1", [v5]).then(() => ({ ok: true }), (e) => ({ ok: false, error: e.message }));
check("ni siquiera el superusuario puede borrar visitas", expectError(r, "IMMUTABLE_LEDGER"), r);
r = await db.query("update public.audit_logs set action = 'x'").then(() => ({ ok: true }), (e) => ({ ok: false, error: e.message }));
check("el registro de auditoría no se puede modificar", expectError(r, "IMMUTABLE_LEDGER"), r);
r = await db.query("delete from auth.users where id = $1", [U.staffA]).then(() => ({ ok: true }), (e) => ({ ok: false, error: e.message }));
check("eliminar un usuario anonimiza su autoría sin romper el historial", r.ok, r);

// ---------- Auditoría y plataforma ----------
console.log("\nAuditoría y plataforma");
r = await as(U.staffA2, "select * from public.audit_logs");
check("empleado no ve la auditoría", r.ok && r.rows.length === 0, r);
r = await as(U.ownerA, "select action from public.audit_logs where business_id = $1", [A]);
const actions = new Set(r.rows?.map((x) => x.action));
check("propietario ve la auditoría de su comercio", ["visit.created", "reward.redeemed", "visit.reversed", "loyalty_programs.update", "customer.registered"].every((a) => actions.has(a)), [...actions]);
r = await as(U.ownerA, "select * from public.platform_business_stats()");
check("solo el superadmin consulta estadísticas de plataforma", expectError(r, "FORBIDDEN"), r);
r = await as(U.super, "select * from public.platform_business_stats()");
check("superadmin obtiene agregados por comercio", r.ok && r.rows.length === 2, r);
r = await as(U.ownerA, "select public.set_business_status($1, 'suspended')", [B]);
check("un comercio no puede suspender a otro", expectError(r, "FORBIDDEN"), r);
r = await as(U.super, "select public.create_business('Nuevo', 'nuevo-negocio', 'Barbería', 'Medellín', 'plan_starter')");
check("superadmin crea un comercio con programa inicial", r.ok, r);
r = await as(U.super, "select public.create_business('Otro', 'nuevo-negocio', 'Barbería', 'Medellín', 'plan_starter')");
check("slug duplicado es rechazado", expectError(r, "SLUG_TAKEN"), r);

console.log("\nPromociones, cumpleaños y contactos");
{
  const bog = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [yy, mm] = bog.split("-").map(Number);
  await db.query("update public.loyalty_programs set min_minutes_between_visits = 0, birthday_reward = 'Esmalte gratis' where business_id = $1", [B]);
  r = await as(U.staffA, "insert into public.promotions (business_id, name, bonus_stamps, starts_on, ends_on) values ($1, 'Hack', 3, current_date, current_date)", [B]);
  check("otro comercio no crea promociones ajenas", !r.ok, r);
  r = await as(U.ownerB, `insert into public.promotions (business_id, name, bonus_stamps, starts_on, ends_on)
    values ($1, 'Doble sello', 1, current_date - 1, current_date + 1) returning id`, [B]);
  check("propietario crea una promoción de doble sello", r.ok, r);
  r = await as(null, "select * from public.join_program('negocio-b', 'Cumple Prueba', '+573118880001', null, true, true, 2, 30)");
  check("fecha de cumpleaños imposible → INVALID_BIRTHDAY", expectError(r, "INVALID_BIRTHDAY"), r);
  r = await as(null, "select * from public.join_program('negocio-b', 'Cumple Prueba', '+573118880001', null, true, true, $1, 15)", [mm]);
  const bToken = r.rows?.[0]?.public_token;
  check("inscripción con cumpleaños (día y mes)", r.ok && !!bToken, r);
  const bCard = (await db.query("select id from public.loyalty_cards where public_token = $1", [bToken])).rows[0].id;

  r = await as(U.ownerB, "select public.register_visit($1, 'promo-key-01') as res", [bCard]);
  const v1 = r.rows?.[0]?.res;
  check("la promoción suma un sello extra (1 + 1)", v1?.current_stamps === 2 && v1?.bonus_stamps === 1, v1);
  check("primera visita del mes de cumpleaños entrega el regalo", !!v1?.birthday_reward_id, v1);
  r = await as(U.ownerB, "select public.register_visit($1, 'promo-key-02') as res", [bCard]);
  check("el regalo de cumpleaños es uno por año", r.rows?.[0]?.res?.birthday_reward_id === null && r.rows[0].res.current_stamps === 4, r.rows?.[0]?.res);
  r = await as(U.ownerB, "select public.register_visit($1, 'promo-key-03') as res", [bCard]);
  const v3 = r.rows?.[0]?.res;
  check("al pasar la meta con sellos extra, el sobrante pasa al siguiente ciclo", !!v3?.reward_id && v3.current_stamps === 1, v3);
  const v3id = (await db.query("select id from public.visits where idempotency_key = 'promo-key-03'")).rows[0].id;
  r = await as(U.ownerB, "select public.reverse_visit($1, 'Prueba de reversión') as res", [v3id]);
  check("revertir una visita con promoción descuenta también los sellos extra", r.ok && r.rows[0].res.current_stamps === 4, r);
  r = await as(null, "select public.get_public_card($1) as c", [bToken]);
  const pc = r.rows?.[0]?.c;
  check("la tarjeta pública anuncia la promoción del día", pc?.promotion?.bonus_stamps === 1, pc?.promotion);
  check("la tarjeta pública muestra el regalo de cumpleaños", pc?.rewards?.some((x) => x.kind === "birthday" && x.name === "Esmalte gratis"), pc?.rewards);
  await db.query("update public.promotions set active = false where business_id = $1", [B]);
  r = await as(U.ownerB, "select public.register_visit($1, 'promo-key-04') as res", [bCard]);
  check("sin promoción activa la visita vuelve a sumar 1", r.rows?.[0]?.res?.bonus_stamps === 0, r.rows?.[0]?.res);

  const noConsent = (await as(null, "select * from public.join_program('negocio-b', 'Sin Permiso', '+573118880002', null, true, false)")).rows[0];
  const noConsentId = (await db.query("select customer_id from public.loyalty_cards where public_token = $1", [noConsent.public_token])).rows[0].customer_id;
  const withConsentId = (await db.query("select customer_id from public.loyalty_cards where id = $1", [bCard])).rows[0].customer_id;
  r = await as(U.ownerB, "select public.log_customer_contact($1, 'cumpleanos')", [noConsentId]);
  check("no se registra contacto sin consentimiento de marketing", expectError(r, "NO_MARKETING_CONSENT"), r);
  r = await as(U.staffA, "select public.log_customer_contact($1, 'cumpleanos')", [withConsentId]);
  check("otro comercio no registra contactos", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select public.log_customer_contact($1, 'cumpleanos')", [withConsentId]);
  check("propietario registra un mensaje de WhatsApp enviado", r.ok, r);
  r = await as(U.ownerB, "select count(*)::int n from public.customer_contacts");
  check("el registro de contactos se puede consultar", r.rows?.[0]?.n === 1, r);
  r = await db.query("delete from public.customer_contacts").catch((e) => ({ error: e.message }));
  check("el registro de contactos no se puede borrar", !!r.error && r.error.includes("IMMUTABLE_LEDGER"), r);
  void yy;
}

console.log("\nLímites de plan y sedes");
{
  // B está en Starter: 1 sede, 2 personas de equipo (sin contar al propietario).
  r = await as(U.ownerB, "insert into public.locations (business_id, name) values ($1, 'Principal') returning id", [B]);
  const locB = r.rows?.[0]?.id;
  check("propietario crea su sede", r.ok && !!locB, r);
  r = await as(U.ownerB, "insert into public.locations (business_id, name) values ($1, 'Norte')", [B]);
  check("Starter no permite una segunda sede → PLAN_LIMIT_LOCATIONS", expectError(r, "PLAN_LIMIT_LOCATIONS"), r);
  r = await as(U.staffA, "insert into public.locations (business_id, name) values ($1, 'Intrusa')", [B]);
  check("otro comercio no crea sedes ajenas", !r.ok, r);
  const locA = (await db.query("insert into public.locations (business_id, name) values ($1, 'Sede A') returning id", [A])).rows[0].id;

  const extra = [];
  for (const k of ["e1", "e2", "e3"]) {
    extra.push((await db.query("insert into auth.users (email, raw_user_meta_data) values ($1, '{}') returning id", [`${k}@test.local`])).rows[0].id);
  }
  r = await as(U.ownerB, "insert into public.business_memberships (business_id, profile_id, role) values ($1, $2, 'staff'), ($1, $3, 'staff')", [B, extra[0], extra[1]]);
  check("Starter admite 2 personas de equipo", r.ok, r);
  r = await as(U.ownerB, "insert into public.business_memberships (business_id, profile_id, role) values ($1, $2, 'staff')", [B, extra[2]]);
  check("la tercera persona supera el plan → PLAN_LIMIT_STAFF", expectError(r, "PLAN_LIMIT_STAFF"), r);
  r = await as(U.ownerB, "update public.business_memberships set can_redeem = true where profile_id = $1 and business_id = $2", [extra[0], B]);
  check("cambiar permisos del equipo existente no cuenta como alta", r.ok && r.affected === 1, r);

  const bCard2 = (await db.query("select c.id from public.loyalty_cards c where c.business_id = $1 and c.status <> 'blocked' limit 1", [B])).rows[0].id;
  await db.query("update public.loyalty_cards set last_visit_at = null where id = $1", [bCard2]);
  r = await as(U.ownerB, "select public.register_visit($1, 'loc-key-01', $2)", [bCard2, locA]);
  check("no se registra una visita en la sede de otro comercio → INVALID_LOCATION", expectError(r, "INVALID_LOCATION"), r);
  r = await as(U.ownerB, "select public.register_visit($1, 'loc-key-02', $2)", [bCard2, locB]);
  const lv = (await db.query("select location_id from public.visits where idempotency_key = 'loc-key-02'")).rows[0];
  check("la visita guarda la sede", r.ok && lv?.location_id === locB, { r, lv });
  r = await as(U.ownerB, "select public.business_stats($1, 30) as s", [B]);
  check("estadísticas por sede", r.rows?.[0]?.s?.by_location?.some((x) => x.name === "Principal" && x.visits >= 1), r.rows?.[0]?.s?.by_location);

  const nA = (await db.query("select count(*)::int n from public.customers where business_id = $1", [A])).rows[0].n;
  await db.query("update public.plans set max_customers = $1 where id = 'plan_pro'", [nA]);
  r = await joinProgram("negocio-a", "+573229990001", "Cupo Lleno");
  check("con el cupo de clientes lleno no hay nuevas inscripciones → PLAN_LIMIT_CUSTOMERS", expectError(r, "PLAN_LIMIT_CUSTOMERS"), r);
  r = await joinProgram("negocio-a", "+573001112233", "Ana Prueba");
  check("con el cupo lleno las clientas existentes siguen recuperando su tarjeta", r.ok && r.rows[0]?.existing === true, r);
  await db.query("update public.plans set max_customers = 2000 where id = 'plan_pro'");

  r = await as(U.ownerA, "select public.set_business_plan($1, 'plan_business')", [A]);
  check("un comercio no cambia su propio plan", expectError(r, "FORBIDDEN"), r);
  r = await as(U.super, "select public.set_business_plan($1, 'plan_business')", [B]);
  const bPlan = (await db.query("select plan_id from public.businesses where id = $1", [B])).rows[0].plan_id;
  check("superadmin cambia el plan y queda auditado", r.ok && bPlan === "plan_business", r);
  r = await as(U.ownerB, "insert into public.locations (business_id, name) values ($1, 'Norte')", [B]);
  check("con el plan Business ya se puede abrir otra sede", r.ok, r);
}

console.log("\nConfiguración y piloto");
const settings = (u, tz = "America/Bogota", email = "hola@negocio-a.co") =>
  as(u, "select public.update_business_settings($1, 'Negocio A', 'Salón', 'Bogotá', $2, 'Negocio A S.A.S.', '900123456-7', $3, '+57 300 000 0000', 'Calle 1 # 2-3')", [A, tz, email]);
r = await settings(U.staffA);
check("empleado no cambia la configuración", expectError(r, "FORBIDDEN"), r);
r = await settings(U.ownerA, "Marte/Olympus");
check("zona horaria inválida es rechazada", expectError(r, "INVALID_TIMEZONE"), r);
r = await settings(U.ownerA, "America/Bogota", "no-es-correo");
check("correo de contacto inválido es rechazado", expectError(r, "contact_email_check"), r);
r = await settings(U.ownerA);
check("propietario guarda datos del responsable del tratamiento", r.ok, r);
r = await as(null, "select public.get_public_business('negocio-a') as b");
const legal = r.rows?.[0]?.b?.legal;
check("la ficha pública muestra el responsable (sin datos de clientes)", legal?.legal_name === "Negocio A S.A.S." && legal?.contact_email === "hola@negocio-a.co", r);
await db.query(`insert into public.customers (business_id, full_name, phone_e164, terms_accepted_at)
  select $1, 'Masivo ' || i, '+57310' || lpad(i::text, 7, '0'), now() from generate_series(1, 60) i`, [B]);
r = await joinProgram("negocio-b", "+573209998877");
check("inscripciones masivas en 10 min → RATE_LIMITED", expectError(r, "RATE_LIMITED"), r);
r = await as(null, "select * from public.join_program('negocio-b', 'Masivo 1', '+573100000001', null, true, false)");
check("un cliente existente sigue recuperando su tarjeta durante el freno", r.ok, r);

console.log("\nSellos de bienvenida");
r = await as(U.ownerA, "update public.loyalty_programs set welcome_stamps = 3 where business_id = $1", [A]);
check("la bienvenida no puede igualar la meta del programa", !r.ok && r.error.includes("welcome_lt_required"), r);
r = await as(U.ownerA, "update public.loyalty_programs set welcome_stamps = 1 where business_id = $1", [A]);
check("propietario configura 1 sello de bienvenida", r.ok && r.affected === 1, r);
r = await joinProgram("negocio-a", "+573007770001", "Clienta Bienvenida");
const welcomeToken = r.rows?.[0]?.public_token;
r = await as(null, "select public.get_public_card($1) as c", [welcomeToken]);
check("la tarjeta nueva empieza con el sello de regalo y sin visitas", r.rows?.[0]?.c?.current_stamps === 1 && r.rows[0].c.total_visits === 0, r.rows?.[0]?.c);
r = await as(null, "select public.get_public_business('negocio-a') as b");
check("la ficha pública anuncia los sellos de bienvenida", r.rows?.[0]?.b?.program?.welcome_stamps === 1, r.rows?.[0]?.b?.program);

console.log("\nComercio suspendido");
await as(U.super, "select public.set_business_status($1, 'suspended', 'Pago pendiente')", [A]);
r = await joinProgram("negocio-a", "+573005556666");
check("no admite inscripciones", expectError(r, "BUSINESS_UNAVAILABLE"), r);
r = await as(U.staffA2, "select public.register_visit($1, 'op-key-suspended')", [cardA]);
check("no admite visitas", expectError(r, "BUSINESS_SUSPENDED"), r);
r = await as(null, "select public.get_public_card($1) as card", [tokenA]);
check("la tarjeta pública no se muestra", r.ok && r.rows[0].card === null, r);
r = await as(null, "select public.get_public_business('negocio-a') as b");
check("la ficha pública del comercio no se muestra", r.ok && r.rows[0].b === null, r);

// ---------- Datos semilla (Beauty Club) contra las restricciones reales ----------
console.log("\nDatos de demostración");
{
  const { buildSeed, demoUsers, SEED_ORDER } = await import("./seed-data.ts");
  const seedDb = new PGlite({ extensions: { pgcrypto } });
  await seedDb.exec(readFileSync(join(root, "supabase/tests/supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(migrationsDir).sort()) await seedDb.exec(readFileSync(join(migrationsDir, f), "utf8"));
  const ids = {};
  for (const u of demoUsers) {
    ids[u.demoId] = (await seedDb.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [u.email, { full_name: u.fullName }])).rows[0].id;
  }
  const rows = buildSeed(ids);
  let seedOk = true;
  for (const table of SEED_ORDER) {
    const data = rows[table];
    const cols = Object.keys(data[0]).join(", ");
    try {
      await seedDb.query(`insert into public.${table} (${cols}) select ${cols} from json_populate_recordset(null::public.${table}, $1)`, [JSON.stringify(data)]);
    } catch (e) {
      seedOk = false;
      check(`semilla: ${table}`, false, e.message);
    }
  }
  if (seedOk) {
    const n = (await seedDb.query("select (select count(*) from public.customers)::int c, (select count(*) from public.visits)::int v, (select count(*) from public.rewards)::int r")).rows[0];
    check(`la semilla de Beauty Club cumple todas las restricciones (${n.c} clientes, ${n.v} visitas, ${n.r} recompensas)`, n.c > 0 && n.v > 0, n);
  }
}

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
