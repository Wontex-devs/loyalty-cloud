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

// El servidor de la app (service_role): único que puede llamar a join_program desde la Etapa 11.
async function asService(sql, params = []) {
  await db.query("begin");
  try {
    await db.query("set local role service_role");
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
  asService("select * from public.join_program($1, $2, $3, null, true, false)", [slug, name, phone]);

// ---------- Público (anon) ----------
console.log("\nAcceso público");
let r = await as(null, "select * from public.customers");
check("anon no puede leer clientes", expectError(r, "permission denied"), r);
r = await as(null, "select * from public.loyalty_cards");
check("anon no puede leer tarjetas", expectError(r, "permission denied"), r);

r = await joinProgram("negocio-a", "+573001112233", "Ana Prueba");
check("el servidor inscribe con join_program", r.ok && r.rows[0]?.existing === false, r);
const tokenA = r.rows[0]?.public_token;
check("token público de 22 caracteres base64url", /^[A-Za-z0-9_-]{22}$/.test(tokenA ?? ""), tokenA);

r = await joinProgram("negocio-a", "+573001112233", "Otro Nombre");
check("un celular inscrito con otro nombre no revela la tarjeta (PHONE_REGISTERED)", expectError(r, "PHONE_REGISTERED") && !JSON.stringify(r).includes(tokenA), r);
r = await joinProgram("negocio-a", "+573001112233", "  ANA   prueba ");
check("mismo celular y mismo nombre (sin importar mayúsculas ni espacios) recupera la tarjeta", r.ok && r.rows[0]?.existing === true && r.rows[0]?.public_token === tokenA, r);
r = await joinProgram("negocio-a", "+573001112233", "Ána Prueba");
check("las tildes no impiden recuperar la tarjeta", r.ok && r.rows[0]?.public_token === tokenA, r);

r = await asService("select public.join_program('negocio-a', 'X Y', '+573009999999', null, false, false)");
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

// Personalización (Etapa 10): logo en Storage, icono del sello y tipografía.
const logoA = `https://abc123.supabase.co/storage/v1/object/public/brand-assets/${A}/logo-1.webp`;
const logoB = `https://abc123.supabase.co/storage/v1/object/public/brand-assets/${B}/logo-1.webp`;
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ logoUrl: logoA, stampIcon: "heart", font: "sans" })]);
check("propietario guarda logo, icono y tipografía", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ logoUrl: logoB })]);
check("no puede usar un logo de la carpeta de otro comercio", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ logoUrl: "javascript:alert(1)" })]);
check("logo con URL arbitraria es rechazado", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ stampIcon: "skull" })]);
check("icono de sello desconocido es rechazado", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ coverUrl: logoA })]);
check("la foto de fondo se acepta desde la carpeta del propio comercio", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ coverUrl: logoB })]);
check("la foto de fondo de otro comercio se rechaza", !r.ok && r.error.includes("INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ coverUrl: "" })]);
check("la foto de fondo se puede quitar", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ logoUrl: "" })]);
check("propietario puede quitar su logo", r.ok, r);
r = await as(U.ownerA, "insert into storage.objects (bucket_id, name) values ('brand-assets', $1)", [`${A}/logo-2.webp`]);
check("propietario sube un archivo a su carpeta", r.ok, r);
r = await as(U.ownerA, "insert into storage.objects (bucket_id, name) values ('brand-assets', $1)", [`${B}/logo-2.webp`]);
check("propietario no puede subir a la carpeta de otro comercio", !r.ok, r);
r = await as(U.staffA, "insert into storage.objects (bucket_id, name) values ('brand-assets', $1)", [`${A}/logo-3.webp`]);
check("empleado no puede subir logos", !r.ok, r);
r = await as(U.ownerA, "insert into storage.objects (bucket_id, name) values ('brand-assets', 'sin-carpeta.webp')");
check("archivo fuera de una carpeta de comercio es rechazado", !r.ok, r);

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
  r = await asService("select * from public.join_program('negocio-b', 'Cumple Prueba', '+573118880001', null, true, true, 2, 30)");
  check("fecha de cumpleaños imposible → INVALID_BIRTHDAY", expectError(r, "INVALID_BIRTHDAY"), r);
  r = await asService("select * from public.join_program('negocio-b', 'Cumple Prueba', '+573118880001', null, true, true, $1, 15)", [mm]);
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

  const noConsent = (await asService("select * from public.join_program('negocio-b', 'Sin Permiso', '+573118880002', null, true, false)")).rows[0];
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
  await db.query("update public.plans set max_customers = 300 where id = 'plan_pro'");

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
r = await asService("select * from public.join_program('negocio-b', 'Masivo 1', '+573100000001', null, true, false)");
check("un cliente existente sigue recuperando su tarjeta durante el freno", r.ok, r);

console.log("\nSellos de bienvenida");
r = await as(U.ownerA, "update public.loyalty_programs set welcome_stamps = 3 where business_id = $1", [A]);
check("la bienvenida no puede igualar la meta del programa", !r.ok && r.error.includes("welcome_lt_required"), r);
r = await as(U.ownerA, "update public.loyalty_programs set welcome_stamps = 1 where business_id = $1", [A]);
check("propietario configura 1 sello de bienvenida", r.ok && r.affected === 1, r);
r = await joinProgram("negocio-a", "+573148880001", "Clienta Bienvenida");
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
console.log("\nDerechos de la clienta y freno a inscripciones (Etapa 11)");
{
  await db.query("update public.businesses set status = 'active' where id = $1", [A]); // la sección anterior lo suspendió
  r = await as(null, "select * from public.join_program('negocio-a', 'Directa Anon', '+573009990001', null, true, false)");
  check("la clave pública ya no puede llamar a join_program", expectError(r, "permission denied"), r);
  r = await as(null, "select * from public.join_program_limited('k', 'negocio-a', 'Directa Anon', '+573009990001', null, true, false)");
  check("ni a join_program_limited", expectError(r, "permission denied"), r);
  r = await asService("select * from public.join_program_limited('ip-1', 'negocio-a', 'Por Servidor', '+573009990002', null, true, true)");
  check("el servidor inscribe con límite por IP", r.ok && r.rows[0]?.existing === false, r);
  const anonToken = r.rows?.[0]?.public_token;
  let limited = null;
  for (let i = 0; i < 25 && !limited; i++) {
    const t = await asService("select * from public.join_program_limited('ip-2', 'negocio-a', 'Misma Persona', '+573009990003', null, true, false)");
    if (!t.ok) limited = { i, t };
  }
  check("más de 20 intentos por hora desde la misma IP → RATE_LIMITED", limited && limited.i === 20 && expectError(limited.t, "RATE_LIMITED"), limited);
  r = await asService("select * from public.join_program_limited('ip-3', 'negocio-a', 'Otra Conexion', '+573009990004', null, true, false)");
  check("otra IP no se ve afectada", r.ok, r);
  r = await db.query("select count(*)::int n from private.join_attempts where client_key like 'ip-%'");
  check("solo se guarda la clave de la conexión", r.rows[0].n > 0, r.rows);

  // Baja de marketing desde la tarjeta
  r = await as(null, "select public.get_public_card($1) as c", [anonToken]);
  check("la tarjeta pública indica el consentimiento de marketing", r.rows?.[0]?.c?.marketing_consent === true, r);
  r = await as(null, "select public.unsubscribe_marketing($1) as ok", [anonToken]);
  check("la clienta se da de baja desde su tarjeta", r.ok && r.rows[0].ok === true, r);
  r = await as(null, "select public.get_public_card($1) as c", [anonToken]);
  check("después de la baja ya no figura con consentimiento", r.rows?.[0]?.c?.marketing_consent === false, r);
  r = await as(null, "select public.unsubscribe_marketing('tokenInexistente0000000') as ok");
  check("un token inexistente no da de baja a nadie", r.ok && r.rows[0].ok === false, r);

  // Retiro desde el panel
  const cust = (await db.query("select id from public.customers where phone_e164 = '+573009990004'")).rows[0].id;
  await db.query("update public.customers set marketing_consent = true, marketing_consent_at = now() where id = $1", [cust]);
  r = await as(U.staffA, "select public.revoke_marketing_consent($1)", [cust]);
  check("una empleada no retira consentimientos", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select public.revoke_marketing_consent($1)", [cust]);
  check("otro comercio no retira consentimientos", expectError(r, "FORBIDDEN"), r);
  r = await as(U.adminA, "select public.revoke_marketing_consent($1)", [cust]);
  const c1 = (await db.query("select marketing_consent, marketing_consent_at from public.customers where id = $1", [cust])).rows[0];
  check("admin retira el consentimiento de marketing", r.ok && c1.marketing_consent === false && c1.marketing_consent_at === null, { r, c1 });
  r = await as(U.ownerA, "select count(*)::int n from public.audit_logs where action = 'customer.marketing_revoked'");
  check("los retiros quedan en la auditoría", r.rows?.[0]?.n === 2, r);

  // Anonimizar (supresión de datos)
  const victim = (await db.query("select c.id, k.id card_id, k.public_token from public.customers c join public.loyalty_cards k on k.customer_id = c.id where c.phone_e164 = '+573009990002'")).rows[0];
  r = await as(U.ownerA, "select public.register_visit($1, 'anon-visit-0001')", [victim.card_id]);
  check("visita previa a la eliminación", r.ok, r);
  r = await as(U.adminA, "select public.anonymize_customer($1)", [victim.id]);
  check("solo el propietario elimina datos de clientas (admin no)", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select public.anonymize_customer($1)", [victim.id]);
  check("otro comercio no elimina datos ajenos", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerA, "select public.anonymize_customer($1)", [victim.id]);
  check("el propietario elimina los datos de una clienta", r.ok, r);
  const after = (await db.query("select full_name, phone_e164, email, birth_month, marketing_consent, anonymized_at from public.customers where id = $1", [victim.id])).rows[0];
  check("no queda nombre, teléfono, correo ni cumpleaños", after.full_name === "Datos eliminados" && after.phone_e164 === null && after.email === null && after.birth_month === null && after.anonymized_at, after);
  const card2 = (await db.query("select status, public_token from public.loyalty_cards where id = $1", [victim.card_id])).rows[0];
  check("la tarjeta queda bloqueada y con otro enlace", card2.status === "blocked" && card2.public_token !== victim.public_token, card2);
  r = await as(null, "select public.get_public_card($1) as c", [victim.public_token]);
  check("el enlace anterior ya no muestra nada", r.ok && r.rows[0].c === null, r);
  r = await as(null, "select public.get_public_card($1) as c", [card2.public_token]);
  check("ni siquiera el enlace nuevo muestra la tarjeta", r.ok && r.rows[0].c === null, r);
  const visitsKept = (await db.query("select count(*)::int n from public.visits where card_id = $1", [victim.card_id])).rows[0].n;
  check("las visitas siguen en el historial (sin datos personales)", visitsKept >= 1, visitsKept);
  r = await as(U.ownerA, "select public.set_card_blocked($1, false)", [victim.card_id]);
  check("su tarjeta no se puede reactivar", expectError(r, "CUSTOMER_ANONYMIZED"), r);
  r = await as(U.ownerA, "update public.customers set full_name = 'Recuperada' where id = $1", [victim.id]);
  check("sus datos ya no se pueden editar", (r.ok && r.affected === 0) || !r.ok, r);
  r = await as(U.ownerA, "select public.anonymize_customer($1)", [victim.id]);
  check("anonimizar dos veces → ALREADY_ANONYMIZED", expectError(r, "ALREADY_ANONYMIZED"), r);
  r = await asService("select * from public.join_program('negocio-a', 'Vuelve Luego', '+573009990002', null, true, false)");
  check("el mismo celular puede volver a inscribirse desde cero", r.ok && r.rows[0]?.existing === false, r);
  r = await as(U.ownerA, "select count(*)::int n from public.audit_logs where action = 'customer.anonymized'");
  check("la eliminación queda en la auditoría", r.rows?.[0]?.n === 1, r);
}

console.log("\nEtapa 12 · Avisos en la billetera");
{
  const today = (await db.query("select extract(month from now() at time zone 'America/Bogota')::int m, extract(day from now() at time zone 'America/Bogota')::int d")).rows[0];
  const join = async (name, phone, consent, month = null, day = null) => {
    const r = await asService("select * from public.join_program('negocio-a', $1, $2, null, true, $3, $4, $5)", [name, phone, consent, month, day]);
    if (!r.ok) throw new Error(r.error);
    const card = (await db.query("select c.id card_id, c.customer_id from public.loyalty_cards c where c.public_token = $1", [r.rows[0].public_token])).rows[0];
    return { token: r.rows[0].public_token, ...card };
  };
  const ana = await join("Ana Avisos", "+573165550001", true, today.m, today.d);
  const sin = await join("Sin Permiso", "+573165550002", false, today.m, today.d);
  const blo = await join("Bloqueada Avisos", "+573165550003", true);
  await db.query("update public.loyalty_cards set status = 'blocked' where id = $1", [blo.card_id]);

  let r = await as(U.ownerA, "select wallet_notifications s from public.businesses where id = $1", [A]);
  check("los avisos vienen activados por defecto (45 días para 'te extrañamos')", r.rows?.[0]?.s?.stamp === true && r.rows[0].s.winbackDays === 45, r);
  const settings = { stamp: true, near: false, reward: true, birthday: true, winback: true, winbackDays: 30 };
  r = await as(U.staffA, "select public.update_wallet_settings($1, $2)", [A, settings]);
  check("un empleado no cambia los avisos", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select public.update_wallet_settings($1, $2)", [A, settings]);
  check("otro comercio no cambia los avisos", expectError(r, "FORBIDDEN"), r);
  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, { ...settings, winbackDays: 5 }]);
  check("'te extrañamos' con menos de 14 días → rechazado", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, { ...settings, extra: true }]);
  check("ajustes con claves desconocidas → rechazados", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, settings]);
  check("el administrador cambia los avisos", r.ok, r);

  const ids = [ana.customer_id, sin.customer_id, blo.customer_id];
  r = await as(U.staffA, "select * from public.queue_wallet_campaign($1, $2, 'Hola', 'Hola {nombre}')", [A, ids]);
  check("un empleado no envía campañas", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select * from public.queue_wallet_campaign($1, $2, 'Hola', 'Hola {nombre}')", [A, ids]);
  check("otro comercio no envía campañas a mis clientes", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerA, "select * from public.queue_wallet_campaign($1, $2, '', 'Hola')", [A, ids]);
  check("campaña sin título → rechazada", expectError(r, "INVALID_WALLET_MESSAGE"), r);
  r = await as(U.ownerA, "select * from public.queue_wallet_campaign($1, $2, 'Martes doble', 'Hola {nombre}, hoy doble sello')", [A, ids]);
  check("la campaña solo llega a quien aceptó mensajes y tiene la tarjeta activa", r.ok && r.rows.length === 1 && r.rows[0].public_token === ana.token, r);
  check("el mensaje lleva el nombre de la clienta", r.rows?.[0]?.body === "Hola Ana, hoy doble sello", r.rows?.[0]);
  r = await as(U.ownerA, "select * from public.queue_wallet_campaign($1, $2, 'Otra', 'Otra campaña')", [A, ids]);
  check("máximo una campaña por clienta a la semana", r.ok && r.rows.length === 0, r);

  r = await as(U.staffA, "select count(*)::int n from public.wallet_notifications");
  check("un empleado no ve el registro de avisos", r.rows?.[0]?.n === 0, r);
  r = await as(U.ownerB, "select count(*)::int n from public.wallet_notifications");
  check("otro comercio no ve mis avisos", r.rows?.[0]?.n === 0, r);
  r = await as(U.ownerA, "select count(*)::int n from public.wallet_notifications");
  check("el propietario ve sus avisos", r.rows?.[0]?.n === 1, r);
  r = await as(U.ownerA, "insert into public.wallet_notifications (business_id, card_id, kind, ref, title, body) values ($1, $2, 'stamp', 'visit:x', 'a', 'b')", [A, ana.card_id]);
  check("desde el panel no se escriben avisos a mano", !r.ok, r);
  r = await as(U.ownerA, "update public.wallet_notifications set status = 'sent'");
  check("ni se cambia su estado", (r.ok && r.affected === 0) || !r.ok, r);

  r = await as(U.ownerA, "select * from public.wallet_daily_candidates()");
  check("el proceso diario no se puede llamar desde el panel", !r.ok, r);
  r = await as(null, "select * from public.wallet_daily_candidates()");
  check("ni con la clave pública", !r.ok, r);
  await db.query("update public.loyalty_cards set last_visit_at = now() - interval '40 days' where id = $1", [ana.card_id]);
  r = await asService("select * from public.wallet_daily_candidates()");
  const mine = (r.rows ?? []).filter((x) => [ana.card_id, sin.card_id, blo.card_id].includes(x.card_id));
  check("cumpleaños de hoy, solo con permiso de mensajes", mine.some((x) => x.kind === "birthday" && x.card_id === ana.card_id) && !mine.some((x) => x.card_id === sin.card_id), mine);
  check("'te extrañamos' a los 30 días configurados", mine.some((x) => x.kind === "winback" && x.card_id === ana.card_id && x.first_name === "Ana"), mine);
  check("nunca a tarjetas bloqueadas", !mine.some((x) => x.card_id === blo.card_id), mine);
  await db.query("update public.loyalty_cards set last_visit_at = now() - interval '200 days' where id = $1", [ana.card_id]);
  r = await asService("select * from public.wallet_daily_candidates() where kind = 'winback' and card_id = $1", [ana.card_id]);
  check("no se escribe a quien dejó de venir hace mucho", r.ok && r.rows.length === 0, r);
  await db.query("update public.loyalty_cards set last_visit_at = null where id = $1", [ana.card_id]);
  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, { ...settings, birthday: false }]);
  r = await asService("select * from public.wallet_daily_candidates() where kind = 'birthday' and card_id = $1", [ana.card_id]);
  check("con el aviso de cumpleaños apagado no se envía", r.ok && r.rows.length === 0, r);
  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, { ...settings, near: true, winbackDays: 45 }]);
}

console.log("\nEtapa 13 · Visita por toque NFC");
{
  let r = await joinProgram("negocio-a", "+573001110001", "Toque Uno");
  const tokNfc = r.rows?.[0]?.public_token;
  const cardNfc = (await db.query("select id from public.loyalty_cards where public_token = $1", [tokNfc])).rows[0]?.id;
  r = await joinProgram("negocio-b", "+573001110002", "Otro Comercio");
  const tokB = r.rows?.[0]?.public_token;

  r = await as(U.ownerA, "select public.get_nfc_settings($1) as s", [A]);
  const inicial = r.rows?.[0]?.s;
  check("el dueño ve los ajustes de NFC: apagado y con secreto de 22 caracteres", r.ok && inicial?.enabled === false && /^[A-Za-z0-9_-]{22}$/.test(inicial?.secret ?? ""), r);
  r = await as(U.staffA, "select public.get_nfc_settings($1)", [A]);
  check("un empleado no puede ver el secreto (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select public.get_nfc_settings($1)", [A]);
  check("otro comercio tampoco (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(U.staffA, "select * from private.business_nfc");
  check("la tabla del secreto no se puede leer desde la API", expectError(r, "permission denied"), r);

  r = await as(U.ownerA, "select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0001')", [inicial?.secret, tokNfc]);
  check("la clave pública y los usuarios no pueden registrar por NFC (solo el servidor)", expectError(r, "permission denied"), r);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0001')", [inicial?.secret, tokNfc]);
  check("con el NFC apagado → NFC_DISABLED", expectError(r, "NFC_DISABLED"), r);

  r = await as(U.staffA, "select public.set_nfc_settings($1, true, 120, false)", [A]);
  check("un empleado no puede encender el NFC (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerA, "select public.set_nfc_settings($1, true, 5000, false)", [A]);
  check("tiempo mínimo fuera de rango → INVALID_NFC_SETTINGS", expectError(r, "INVALID_NFC_SETTINGS"), r);
  r = await as(U.adminA, "select public.set_nfc_settings($1, true, 120, false) as s", [A]);
  check("el administrador enciende el NFC", r.ok && r.rows[0].s.enabled === true && r.rows[0].s.secret === inicial.secret, r);

  r = await asService("select public.register_nfc_visit('negocio-a', 'secreto-incorrecto', $1, 'nfc-key-0002')", [tokNfc]);
  check("etiqueta con secreto incorrecto → INVALID_TAG", expectError(r, "INVALID_TAG"), r);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0003')", [inicial.secret, tokB]);
  check("la tarjeta de otro comercio no se acepta (CARD_NOT_FOUND)", expectError(r, "CARD_NOT_FOUND"), r);
  r = await asService("select public.register_nfc_visit('no-existe', $1, $2, 'nfc-key-0004')", [inicial.secret, tokNfc]);
  check("comercio inexistente → BUSINESS_NOT_FOUND", expectError(r, "BUSINESS_NOT_FOUND"), r);

  const sellosAntes = (await db.query("select current_stamps from public.loyalty_cards where id = $1", [cardNfc])).rows[0].current_stamps;
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0005') as res", [inicial.secret, tokNfc]);
  const visitaNfc = r.rows?.[0]?.res;
  check("el toque correcto registra la visita y suma un sello", r.ok && visitaNfc?.current_stamps === sellosAntes + 1 && visitaNfc?.card_id === cardNfc, r);
  const v = (await db.query("select source, staff_id from public.visits where id = $1", [visitaNfc?.visit_id])).rows[0];
  check("la visita queda con origen 'nfc' y sin empleado", v?.source === "nfc" && v?.staff_id === null, v);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0006')", [inicial.secret, tokNfc]);
  check("un segundo toque enseguida → TOO_SOON", expectError(r, "TOO_SOON"), r);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0005')", [inicial.secret, tokNfc]);
  check("repetir la misma petición → DUPLICATE_REQUEST", expectError(r, "DUPLICATE_REQUEST"), r);

  // El NFC exige más tiempo (120 min) que el programa (60 min); el escáner del empleado solo el del programa.
  await db.query("update public.loyalty_cards set last_visit_at = now() - interval '90 minutes' where id = $1", [cardNfc]);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0007')", [inicial.secret, tokNfc]);
  check("a los 90 min el toque aún no vale (el comercio exige 120)", expectError(r, "TOO_SOON"), r);
  r = await as(U.adminA, "select public.register_visit($1, 'nfc-key-0008') as res", [cardNfc]);
  check("a los 90 min el empleado sí puede sellar (mismas reglas de siempre)", r.ok, r);
  const vs = (await db.query("select source from public.visits where idempotency_key = 'nfc-key-0008'")).rows[0];
  check("la visita del empleado queda con origen 'staff'", vs?.source === "staff", vs);

  // Rotar el secreto invalida las etiquetas viejas.
  r = await as(U.ownerA, "select public.set_nfc_settings($1, true, 120, true) as s", [A]);
  const rotado = r.rows?.[0]?.s;
  check("rotar el secreto genera uno nuevo", r.ok && rotado?.secret && rotado.secret !== inicial.secret, r);
  await db.query("update public.loyalty_cards set last_visit_at = now() - interval '3 hours' where id = $1", [cardNfc]);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0009')", [inicial.secret, tokNfc]);
  check("la etiqueta con el secreto viejo ya no funciona", expectError(r, "INVALID_TAG"), r);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0010')", [rotado.secret, tokNfc]);
  check("la etiqueta con el secreto nuevo sí", r.ok, r);

  // Reversión y auditoría.
  r = await as(U.adminA, "select public.reverse_visit($1, 'Toque hecho por error') as res", [visitaNfc?.visit_id]);
  check("una visita por NFC se puede revertir con motivo", r.ok, r);
  const aud = (await db.query("select count(*)::int n from public.audit_logs where business_id = $1 and metadata::text like '%' || $2 || '%'", [A, rotado?.secret])).rows[0];
  check("el secreto nunca aparece en la auditoría", aud.n === 0, aud);
  const audNfc = (await db.query("select count(*)::int n from public.audit_logs where business_id = $1 and action = 'visit.created' and metadata->>'source' = 'nfc'", [A])).rows[0];
  check("la auditoría registra el origen 'nfc' de las visitas", audNfc.n >= 2, audNfc);

  // Con el comercio suspendido, el toque no funciona.
  await db.query("update public.businesses set status = 'suspended' where id = $1", [A]);
  r = await asService("select public.register_nfc_visit('negocio-a', $1, $2, 'nfc-key-0011')", [rotado.secret, tokNfc]);
  check("comercio suspendido → BUSINESS_SUSPENDED", expectError(r, "BUSINESS_SUSPENDED"), r);
  await db.query("update public.businesses set status = 'active' where id = $1", [A]);
}

console.log("\nAdministradores de la plataforma");
{
  let r = await as(U.ownerA, "update public.profiles set platform_role = 'superadmin' where id = $1", [U.ownerA]);
  check("un usuario no puede darse a sí mismo el rol de superadministrador", !r.ok || r.affected === 0, r);
  const antes = (await db.query("select platform_role from public.profiles where id = $1", [U.ownerA])).rows[0].platform_role;
  check("y su rol sigue siendo 'user'", antes === "user", antes);
  // La invitación de Auth crea la persona y su perfil; el servidor le da el rol.
  const nuevo = (await db.query("insert into auth.users (email, raw_user_meta_data) values ('invitado@test.local', '{\"full_name\":\"Invitado\"}') returning id")).rows[0].id;
  r = await asService("update public.profiles set platform_role = 'superadmin' where id = $1 returning platform_role", [nuevo]);
  check("el servidor sí puede dar el rol (después de comprobar a quien invita)", r.ok && r.rows[0]?.platform_role === "superadmin", r);
  r = await asService(
    "insert into public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata) values (null, $1, 'platform.superadmin_granted', 'profile', $2, '{\"invited\":true}')",
    [U.super, nuevo],
  );
  check("el cambio queda en la auditoría, sin comercio", r.ok, r);
}

console.log("\nEliminar comercios y usuarios");
{
  let r = await as(U.ownerA, "select public.admin_delete_business($1, 'negocio-a')", [A]);
  check("un dueño no puede eliminar comercios", !r.ok && r.error.includes("FORBIDDEN"), r);
  r = await as(U.super, "select public.admin_delete_business($1, 'otro-nombre')", [A]);
  check("el superadministrador debe escribir el identificador exacto", !r.ok && r.error.includes("CONFIRMATION_MISMATCH"), r);
  const visitasA = (await db.query("select count(*)::int n from public.visits where business_id = $1", [A])).rows[0].n;
  r = await as(U.ownerA, "select set_config('lazo.eliminando_comercio', $1, true); delete from public.visits where business_id = $1::uuid", [A]);
  const visitasDespues = (await db.query("select count(*)::int n from public.visits where business_id = $1", [A])).rows[0].n;
  check("nadie puede borrar visitas a mano, aunque ponga la marca de borrado", visitasA > 0 && visitasDespues === visitasA, { visitasA, visitasDespues, r });
  r = await asService("delete from public.visits where business_id = $1", [A]);
  check("tampoco el servidor (service_role)", !r.ok || r.affected === 0, r);

  // Eliminar un usuario que registró visitas: su cuenta se va y el historial queda sin su nombre.
  const conStaff = (await db.query("select count(*)::int n from public.visits where staff_id = $1", [U.staffA2])).rows[0].n;
  let borrado = true;
  try {
    await db.query("delete from auth.users where id = $1", [U.staffA2]);
  } catch (e) {
    borrado = e.message;
  }
  const sigue = (await db.query("select count(*)::int n from public.profiles where id = $1", [U.staffA2])).rows[0].n;
  const sinNombre = (await db.query("select count(*)::int n from public.visits where staff_id is null and business_id = $1", [A])).rows[0].n;
  check("se puede eliminar un usuario que registró visitas", borrado === true && sigue === 0, borrado);
  check("sus visitas siguen en el historial, sin su nombre", conStaff === 0 || sinNombre >= conStaff, { conStaff, sinNombre });
}

console.log("\nPanel de la plataforma: usuarios, roles y suspensión");
{
  const soporte = "00000000-0000-0000-0000-0000000000c1";
  const super2 = "00000000-0000-0000-0000-0000000000c2";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'soporte@test.local', '{}'), ($2, 'super2@test.local', '{}')", [soporte, super2]);
  await db.query("update public.profiles set platform_role = 'support' where id = $1", [soporte]);

  // Soporte: ve el panel, no cambia nada.
  let r = await as(soporte, "select count(*)::int n from public.businesses");
  check("Soporte ve todos los comercios", r.ok && r.rows[0].n >= 2, r);
  r = await as(soporte, "select * from public.admin_list_users()");
  check("Soporte ve el listado de usuarios", r.ok && r.rows.length >= 7, r);
  r = await as(soporte, "select * from public.platform_business_stats()");
  check("Soporte ve las estadísticas de la plataforma", r.ok, r);
  r = await as(soporte, "select count(*)::int n from public.customers");
  check("Soporte NO ve datos personales de clientes", r.ok && r.rows[0].n === 0, r);
  r = await as(soporte, "select public.admin_set_user_suspension($1, true, 'prueba')", [U.ownerB]);
  check("Soporte no puede suspender cuentas", expectError(r, "FORBIDDEN"), r);
  r = await as(soporte, "select public.admin_set_platform_role($1, 'superadmin')", [soporte]);
  check("Soporte no puede darse más permisos", expectError(r, "FORBIDDEN") || expectError(r, "CANNOT_CHANGE_SELF"), r);
  r = await as(soporte, "select public.set_business_status($1, 'suspended', null)", [B]);
  check("Soporte no puede suspender comercios", !r.ok, r);
  r = await as(U.ownerA, "select * from public.admin_list_users()");
  check("un propietario no ve el listado de usuarios de la plataforma", expectError(r, "FORBIDDEN"), r);

  // Roles: protecciones.
  r = await as(U.super, "select public.admin_set_platform_role($1, 'user')", [U.super]);
  check("nadie se cambia su propio rol", expectError(r, "CANNOT_CHANGE_SELF"), r);
  r = await as(U.super, "select public.admin_set_platform_role($1, 'superadmin')", [super2]);
  check("el superadministrador nombra a otro", r.ok, r);
  r = await as(super2, "select public.admin_set_platform_role($1, 'user')", [U.super]);
  check("se puede quitar un superadministrador si queda otro", r.ok, r);
  r = await as(super2, "select public.admin_set_user_suspension($1, true, null)", [super2]);
  check("nadie se suspende a sí mismo", expectError(r, "CANNOT_CHANGE_SELF"), r);
  await db.query("update public.profiles set platform_role = 'superadmin' where id = $1", [U.super]);
  await db.query("update public.profiles set platform_role = 'user' where id = $1", [super2]);
  const cambio = (await db.query("select metadata from public.audit_logs where action = 'platform.role_changed' and entity_id = $1 order by id desc limit 1", [super2])).rows[0];
  check("el cambio de rol queda en la auditoría con antes y después", cambio?.metadata?.from === "user" && cambio?.metadata?.to === "superadmin", cambio);
  r = await as(U.super, "select public.admin_set_platform_role($1, 'support')", [U.super]);
  check("el último superadministrador no puede quedarse sin rol", expectError(r, "CANNOT_CHANGE_SELF") || expectError(r, "LAST_SUPERADMIN"), r);

  // Suspensión: corta el acceso de inmediato y se puede revertir.
  r = await as(U.ownerB, "select count(*)::int n from public.businesses");
  const antes = r.rows?.[0]?.n;
  r = await as(U.super, "select public.admin_set_user_suspension($1, true, 'Falta de pago')", [U.ownerB]);
  check("el superadministrador suspende una cuenta", r.ok, r);
  r = await as(U.ownerB, "select count(*)::int n from public.businesses");
  check("la cuenta suspendida deja de ver su comercio", antes === 1 && r.ok && r.rows[0].n === 0, { antes, r });
  r = await as(U.ownerB, "select * from public.register_visit((select id from public.loyalty_cards where business_id = $1 limit 1), 'susp-1')", [B]);
  check("la cuenta suspendida no puede registrar visitas", !r.ok, r);
  const susp = (await db.query("select suspended_reason, suspended_by from public.profiles where id = $1", [U.ownerB])).rows[0];
  check("queda el motivo y quién suspendió", susp.suspended_reason === "Falta de pago" && susp.suspended_by === U.super, susp);
  r = await as(U.super, "select public.admin_set_user_suspension($1, false, null)", [U.ownerB]);
  r = await as(U.ownerB, "select count(*)::int n from public.businesses");
  check("al reactivarla recupera el acceso", r.ok && r.rows[0].n === 1, r);
  const evs = (await db.query("select action from public.audit_logs where entity_id = $1 and action like 'platform.user_%' order by id", [U.ownerB])).rows.map((x) => x.action);
  check("suspensión y reactivación quedan en la auditoría", evs.join() === "platform.user_suspended,platform.user_reactivated", evs);

  // Edición y acciones registradas.
  r = await as(U.super, "select public.admin_update_profile($1, 'Dueña B')", [U.ownerB]);
  const nombre = (await db.query("select full_name from public.profiles where id = $1", [U.ownerB])).rows[0].full_name;
  check("el superadministrador corrige el nombre de una cuenta", r.ok && nombre === "Dueña B", r);
  r = await as(U.super, "select public.admin_update_profile($1, 'x')", [U.ownerB]);
  check("no acepta nombres de menos de 2 letras", expectError(r, "INVALID_INPUT"), r);
  r = await as(U.super, "select public.admin_record_action('platform.users_exported', 'usuarios', '{\"filas\": 7}')");
  check("la exportación queda registrada", r.ok, r);
  r = await as(U.super, "select public.admin_record_action('visit.created', 'x', '{}')");
  check("no se pueden registrar acciones inventadas", expectError(r, "INVALID_INPUT"), r);

  // Inicios de sesión.
  r = await as(U.ownerA, "select public.record_login('password')");
  await as(U.ownerA, "select public.record_login('password')");
  const logins = (await db.query("select count(*)::int n from public.login_events where profile_id = $1", [U.ownerA])).rows[0].n;
  check("el inicio de sesión queda registrado una sola vez", r.ok && logins === 1, { r, logins });
  r = await as(U.ownerB, "select count(*)::int n from public.login_events");
  check("cada persona solo ve sus propios inicios de sesión", r.ok && r.rows[0].n === 0, r);
  r = await as(soporte, "select count(*)::int n from public.login_events");
  check("Soporte ve los inicios de sesión de todos", r.ok && r.rows[0].n === 1, r);
  r = await as(U.ownerA, "insert into public.login_events (profile_id, method) values ($1, 'password')", [U.ownerB]);
  check("nadie escribe inicios de sesión a nombre de otra persona", !r.ok, r);
  r = await as(U.ownerA, "select public.record_login('hack')");
  check("solo acepta métodos conocidos", expectError(r, "INVALID_INPUT"), r);
}

console.log("\nPlanes comerciales");
{
  const p = (await db.query("select id, price_monthly::int price, max_customers from public.plans order by id")).rows;
  const by = Object.fromEntries(p.map((x) => [x.id, x]));
  check("Starter: $79.990 y 100 clientes", by.plan_starter.price === 79990 && by.plan_starter.max_customers === 100, by.plan_starter);
  check("Pro: $139.990 y 300 clientes", by.plan_pro.price === 139990 && by.plan_pro.max_customers === 300, by.plan_pro);
}

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

    // Eliminar un comercio con todo su historial (visitas, canjes, contactos, auditoría).
    const biz = (await seedDb.query("select id, slug from public.businesses where slug = 'beautyclub'")).rows[0];
    const otros = (await seedDb.query("select count(*)::int n from public.businesses where id <> $1", [biz.id])).rows[0].n;
    const sup = (await seedDb.query("select id from public.profiles limit 1")).rows[0].id;
    await seedDb.query("update public.profiles set platform_role = 'superadmin' where id = $1", [sup]);
    let error = null;
    await seedDb.query("begin");
    try {
      await seedDb.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: sup, role: "authenticated" })]);
      await seedDb.query("set local role authenticated");
      await seedDb.query("select public.admin_delete_business($1, $2)", [biz.id, biz.slug]);
      await seedDb.query("commit");
    } catch (e) {
      error = e.message;
      await seedDb.query("rollback");
    }
    check("el superadministrador elimina un comercio con todo su historial", error === null, error);
    const quedan = (await seedDb.query(
      `select (select count(*) from public.businesses where id = $1)::int b,
              (select count(*) from public.customers where business_id = $1)::int c,
              (select count(*) from public.visits where business_id = $1)::int v,
              (select count(*) from public.redemptions where business_id = $1)::int r,
              (select count(*) from public.audit_logs where business_id = $1)::int a`,
      [biz.id],
    )).rows[0];
    check("no queda nada de ese comercio", Object.values(quedan).every((x) => x === 0), quedan);
    const reg = (await seedDb.query("select count(*)::int n from public.audit_logs where action = 'platform.business_deleted' and entity_id = $1 and business_id is null", [biz.id])).rows[0].n;
    check("la eliminación queda en la auditoría de la plataforma", reg === 1, reg);
    const otrosDespues = (await seedDb.query("select count(*)::int n from public.businesses")).rows[0].n;
    check("los demás comercios siguen intactos", otrosDespues === otros, { otros, otrosDespues });
  }
}

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
