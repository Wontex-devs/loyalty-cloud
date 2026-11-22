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

// Código de barras: cada tarjeta tiene su número de 12 dígitos, que solo el equipo del comercio convierte en visita.
{
  const code = (await db.query("select scan_code from public.loyalty_cards where id = $1", [cardA])).rows[0].scan_code;
  check("la tarjeta nueva trae su número de código de barras (12 dígitos)", /^[0-9]{12}$/.test(code), code);
  let q = await as(null, "select public.get_public_card($1) as card", [tokenA]);
  check("la tarjeta pública devuelve su número de código de barras", q.ok && q.rows[0].card.scan_code === code, q);
  q = await as(U.staffA, "select id from public.loyalty_cards where business_id = $1 and scan_code = $2", [A, code]);
  check("el equipo del comercio encuentra la tarjeta por su código", q.ok && q.rows.length === 1 && q.rows[0].id === cardA, q);
  q = await as(U.ownerB, "select id from public.loyalty_cards where scan_code = $1", [code]);
  check("otro comercio no encuentra la tarjeta por su código", q.ok && q.rows.length === 0, q);
  q = await as(null, "select id from public.loyalty_cards where scan_code = $1", [code]);
  check("sin sesión no se puede buscar por código", !q.ok || q.rows.length === 0, q);
  const dup = await db.query("select count(*)::int n from (select scan_code from public.loyalty_cards group by scan_code having count(*) > 1) x");
  check("no hay dos tarjetas con el mismo código", dup.rows[0].n === 0, dup.rows[0]);
}
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
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ stampIcon: "coffee" })]);
check("el sello de café se acepta", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ illustrationUrl: logoA })]);
check("la ilustración de la franja se acepta desde la carpeta del propio comercio", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ illustrationUrl: logoB })]);
check("no puede usar una ilustración de la carpeta de otro comercio", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ illustrationUrl: "" })]);
check("la ilustración se puede quitar", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ coverUrl: logoA })]);
check("la foto de fondo se acepta desde la carpeta del propio comercio", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ coverUrl: logoB })]);
check("la foto de fondo de otro comercio se rechaza", !r.ok && r.error.includes("INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ coverUrl: "" })]);
check("la foto de fondo se puede quitar", r.ok, r);
// Etapa 22: sello propio y más tipografías.
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ stampUrl: logoA.replace("logo-1", "sello-1") })]);
check("el sello propio se acepta desde la carpeta del propio comercio", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ stampUrl: logoB })]);
check("el sello de otro comercio se rechaza", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ stampUrl: "https://evil.example/sello.png" })]);
check("un sello de otro sitio se rechaza", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ stampUrl: "" })]);
check("el sello propio se puede quitar", r.ok, r);
for (const font of ["elegante", "manuscrita", "redondeada", "impacto", "geometrica"]) {
  r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ font })]);
  if (!r.ok) break;
}
check("se aceptan las cinco tipografías nuevas", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ font: "comic-sans" })]);
check("una tipografía desconocida se rechaza", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.staffA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ font: "impacto" })]);
check("un empleado no puede cambiar la tipografía", expectError(r, "FORBIDDEN"), r);
await db.query("update public.businesses set branding = branding || '{\"font\":\"sans\"}'::jsonb where id = $1", [A]);
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

// Letra propia (migración 42): un archivo de letra de su carpeta y su nombre.
{
  const letraA = logoA.replace(/logo-1[^/]*$/, "letra-1.ttf");
  let rl = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ font: "propia", fontUrl: letraA, fontName: "Mi Letra Bonita" })]);
  check("el dueño sube su propia letra (TTF de su carpeta) y la elige", rl.ok, rl);
  rl = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ fontUrl: letraA.replace(".ttf", ".otf") })]);
  check("también acepta OTF", rl.ok, rl);
  rl = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ fontUrl: letraA.replace(".ttf", ".png") })]);
  check("una imagen no sirve como letra", expectError(rl, "INVALID_BRANDING"), rl);
  rl = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ fontUrl: logoB.replace(/logo-1[^/]*$/, "letra-1.ttf") })]);
  check("la letra de otro comercio se rechaza", expectError(rl, "INVALID_BRANDING"), rl);
  rl = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ fontName: 'x"><script>' })]);
  check("el nombre de la letra no admite comillas ni etiquetas", expectError(rl, "INVALID_BRANDING"), rl);
  rl = await as(U.staffA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ fontUrl: letraA })]);
  check("un empleado no cambia la letra", expectError(rl, "FORBIDDEN"), rl);
  rl = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ font: "serif", fontUrl: "", fontName: "" })]);
  check("la letra propia se puede quitar", rl.ok, rl);
  rl = await as(U.ownerA, "insert into storage.objects (bucket_id, name) values ('brand-assets', $1)", [`${A}/letra-2.ttf`]);
  check("el dueño sube un archivo de letra a su carpeta", rl.ok, rl);
}

// Etapa 27: estilos premium de la tarjeta.
for (const cardStyle of ["noche", "cristal", "negro", "marfil", "clasico"]) {
  r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ cardStyle })]);
  if (!r.ok) break;
}
check("se aceptan los cinco estilos de tarjeta", r.ok, r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ cardStyle: "dorado" })]);
check("un estilo de tarjeta desconocido se rechaza", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.staffA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ cardStyle: "negro" })]);
check("un empleado no puede cambiar el estilo de la tarjeta", expectError(r, "FORBIDDEN"), r);

// Etapa 30: el comercio decide si la tarjeta y el pase llevan código QR.
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ passQr: false })]);
check("el propietario quita el código QR de la tarjeta", r.ok, r);
r = await db.query("select branding->'passQr' as v from public.businesses where id = $1", [A]);
check("queda guardado como falso", r.rows[0].v === false, r.rows[0]);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ passQr: "no" })]);
check("un valor que no es verdadero o falso se rechaza", expectError(r, "INVALID_BRANDING"), r);
r = await as(U.ownerB, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ passQr: true })]);
check("otro comercio no puede cambiarlo (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
r = await as(U.ownerA, "select public.update_business_profile($1, null, null, null, null, $2::jsonb)", [A, JSON.stringify({ passQr: true })]);
check("y lo vuelve a poner", r.ok, r);

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
  await db.query("update public.plans set max_customers = 1000 where id = 'plan_pro'");

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
  // La campaña de arriba fue hace más de una semana (máximo un recordatorio por semana, migración 43).
  await db.query("update public.wallet_notifications set created_at = now() - interval '8 days' where card_id = $1 and kind = 'campaign'", [ana.card_id]);
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
  r = await as(U.adminA, "select public.set_nfc_settings($1, true, 120, false, 20) as s", [A]);
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

  // Sumar el sello escribiendo el celular: la etiqueta se comprueba ANTES de mirar el número.
  {
    const secreto = rotado.secret;
    const tel = "+573001110001";
    let q = await as(U.ownerA, "select public.register_nfc_visit_by_phone('negocio-a', $1, $2, 'cel-key-0001', 'k1')", [secreto, tel]);
    check("por celular: solo el servidor puede llamarla", expectError(q, "permission denied"), q);
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', 'secreto-incorrecto-000', $1, 'cel-key-0002', 'k1')", [tel]);
    const conNumero = q;
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', 'secreto-incorrecto-000', '+573009998877', 'cel-key-0003', 'k1')");
    check(
      "por celular: sin la etiqueta correcta la respuesta es la misma exista o no el número (INVALID_TAG)",
      expectError(conNumero, "INVALID_TAG") && expectError(q, "INVALID_TAG"),
      { conNumero, q },
    );
    q = await asService("select public.register_nfc_visit_by_phone('no-existe', $1, $2, 'cel-key-0004', 'k1')", [secreto, tel]);
    check("por celular: comercio inexistente también da INVALID_TAG", expectError(q, "INVALID_TAG"), q);
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, '+573009998877', 'cel-key-0005', 'k1') as res", [secreto]);
    check("por celular: número que no es cliente → PHONE_NOT_FOUND", q.ok && q.rows[0].res?.error === "PHONE_NOT_FOUND", q);
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, '+573001110002', 'cel-key-0006', 'k1') as res", [secreto]);
    check("por celular: el cliente de otro comercio no se encuentra aquí", q.ok && q.rows[0].res?.error === "PHONE_NOT_FOUND", q);
    await db.query("update public.loyalty_cards set last_visit_at = now() - interval '3 hours' where id = $1", [cardNfc]);
    const antes = (await db.query("select current_stamps from public.loyalty_cards where id = $1", [cardNfc])).rows[0].current_stamps;
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, $2, 'cel-key-0007', 'k2') as res", [secreto, tel]);
    const despues = (await db.query("select current_stamps from public.loyalty_cards where id = $1", [cardNfc])).rows[0].current_stamps;
    check("por celular: con la etiqueta correcta suma el sello", q.ok && q.rows[0].res?.card_id === cardNfc && despues === antes + 1, { q, antes, despues });
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, $2, 'cel-key-0007', 'k2')", [secreto, tel]);
    check("por celular: el reintento con la misma clave no suma otro (DUPLICATE_REQUEST)", expectError(q, "DUPLICATE_REQUEST"), q);
    await db.query("update public.loyalty_cards set status = 'blocked' where id = $1", [cardNfc]);
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, $2, 'cel-key-0008', 'k3') as res", [secreto, tel]);
    check("por celular: tarjeta bloqueada responde igual que un número que no existe", q.ok && q.rows[0].res?.error === "PHONE_NOT_FOUND", q);
    await db.query("update public.loyalty_cards set status = 'active' where id = $1", [cardNfc]);
    // Límite por conexión: los intentos fallidos también cuentan.
    for (let i = 0; i < 10; i++) {
      await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, '+573009990000', $2, 'k-limite')", [secreto, `cel-lim-${i}`]);
    }
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, '+573009990000', 'cel-lim-x', 'k-limite')", [secreto]);
    check("por celular: más de 10 intentos en 10 minutos por conexión → RATE_LIMITED", expectError(q, "RATE_LIMITED"), q);
    q = await asService("select public.register_nfc_visit_by_phone('negocio-a', $1, '+573009990000', 'cel-lim-y', 'k-otra') as res", [secreto]);
    check("por celular: otra conexión sigue pudiendo", q.ok, q);
    q = await as(U.staffA, "select * from private.nfc_phone_attempts");
    check("por celular: los intentos no se pueden leer desde la API", expectError(q, "permission denied"), q);
  }

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

console.log("\nEtapa 20 · Apple Wallet (iPhone registrados)");
{
  let r = await joinProgram("negocio-a", "+573001120001", "Ana iPhone");
  const tok = r.rows?.[0]?.public_token;
  const card = (await db.query("select id, business_id from public.loyalty_cards where public_token = $1", [tok])).rows[0];

  r = await asService("insert into public.apple_wallet_registrations (device_library_id, card_id, business_id, push_token) values ('iphone-1', $1, $2, 'abc123def4567890')", [card.id, card.business_id]);
  check("el servidor registra el iPhone que guardó el pase", r.ok, r);
  r = await asService("insert into public.apple_wallet_registrations (device_library_id, card_id, business_id, push_token) values ('iphone-1', $1, $2, 'abc123def4567890')", [card.id, card.business_id]);
  check("el mismo iPhone no se registra dos veces para la misma tarjeta", !r.ok, r);
  r = await asService("insert into public.apple_wallet_registrations (device_library_id, card_id, business_id, push_token) values ('iphone-2', $1, $2, 'abc123def4567890')", [card.id, B]);
  check("no se puede asociar la tarjeta a otro comercio", !r.ok, r);

  r = await as(U.ownerA, "select * from public.apple_wallet_registrations");
  check("el dueño del comercio no ve los dispositivos (solo el servidor)", expectError(r, "permission denied"), r);
  r = await as(null, "select * from public.apple_wallet_registrations");
  check("el público tampoco", expectError(r, "permission denied"), r);
  r = await as(U.ownerA, "insert into public.apple_wallet_registrations (device_library_id, card_id, business_id, push_token) values ('x', $1, $2, 'y')", [card.id, card.business_id]);
  check("nadie registra dispositivos desde la API", expectError(r, "permission denied"), r);

  r = await asService("update public.apple_wallet_registrations set pass_updated_at = now() where card_id = $1 returning push_token", [card.id]);
  check("el servidor marca el pase como cambiado y obtiene el token de aviso", r.ok && r.rows.length === 1 && r.rows[0].push_token === "abc123def4567890", r);
}

console.log("\nEtapa 21 · Ver como el comercio (soporte, solo lectura)");
{
  let r = await joinProgram("negocio-a", "+573001130001", "Clienta Soporte");
  const tok = r.rows?.[0]?.public_token;
  const cardS = (await db.query("select id from public.loyalty_cards where public_token = $1", [tok])).rows[0]?.id;
  const soporte = "00000000-0000-0000-0000-0000000005e5";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'soporte-comercio@test.local', '{}')", [soporte]);
  await db.query("update public.profiles set platform_role = 'support' where id = $1", [soporte]);

  r = await as(U.super, "select count(*)::int n from public.customers where business_id = $1", [A]);
  check("sin sesión de soporte, la plataforma no ve los clientes", r.ok && r.rows[0].n === 0, r);
  r = await as(U.super, "select public.start_support_session($1, 'hola')", [A]);
  check("abrir la sesión exige un motivo", expectError(r, "REASON_REQUIRED"), r);
  r = await as(U.ownerB, "select public.start_support_session($1, 'Quiero ver sus clientes')", [A]);
  check("un comercio no puede abrir sesión de soporte en otro (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerA, "insert into public.support_sessions (profile_id, business_id, reason, expires_at) values ($1, $2, 'por mi cuenta', now() + interval '1 hour')", [U.ownerA, A]);
  check("nadie crea sesiones directamente desde la API", expectError(r, "permission denied"), r);

  r = await as(soporte, "select public.start_support_session($1, 'El comercio no ve sus visitas', 500) as hasta", [A]);
  const hasta = r.rows?.[0]?.hasta;
  check("Soporte abre una sesión con motivo, de máximo 2 horas", r.ok && new Date(hasta).getTime() - Date.now() <= 2 * 3600_000 + 5000, r);
  r = await as(soporte, "select count(*)::int n from public.customers where business_id = $1", [A]);
  check("durante la sesión ve los clientes del comercio", r.ok && r.rows[0].n > 0, r);
  r = await as(soporte, "select count(*)::int n from public.wallet_notifications where business_id = $1", [A]);
  check("y los avisos y contactos que ve el dueño", r.ok, r);
  r = await as(soporte, "select count(*)::int n from public.customers where business_id = $1", [B]);
  check("pero no los de otro comercio", r.ok && r.rows[0].n === 0, r);

  r = await as(soporte, "update public.customers set full_name = 'Cambiado' where business_id = $1", [A]);
  check("no puede cambiar clientes (solo lectura)", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);
  r = await as(soporte, "select public.register_visit($1, 'soporte-visita-001')", [cardS]);
  check("no puede registrar visitas (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);

  r = await as(U.ownerA, "select action, metadata->>'reason' motivo from public.audit_logs where business_id = $1 and action = 'support.view_started' and actor_id = $2", [A, soporte]);
  check("el dueño ve en su auditoría quién entró y por qué", r.ok && r.rows.length === 1 && r.rows[0].motivo === "El comercio no ve sus visitas", r);
  r = await as(U.staffA, "select count(*)::int n from public.support_sessions");
  check("un empleado no ve las sesiones de soporte", r.ok && r.rows[0].n === 0, r);

  r = await as(soporte, "select public.end_support_session($1)", [A]);
  check("Soporte cierra la sesión", r.ok, r);
  r = await as(soporte, "select count(*)::int n from public.customers where business_id = $1", [A]);
  check("al cerrarla deja de ver los clientes", r.ok && r.rows[0].n === 0, r);
  r = await as(U.ownerA, "select count(*)::int n from public.audit_logs where business_id = $1 and action = 'support.view_ended'", [A]);
  check("el cierre también queda en la auditoría", r.ok && r.rows[0].n === 1, r);

  await db.query("insert into public.support_sessions (profile_id, business_id, reason, started_at, expires_at) values ($1, $2, 'sesión vieja', now() - interval '2 hours', now() - interval '1 hour')", [U.super, A]);
  r = await as(U.super, "select count(*)::int n from public.customers where business_id = $1", [A]);
  check("una sesión vencida ya no da acceso", r.ok && r.rows[0].n === 0, r);

  await db.query("update public.profiles set suspended_at = now() where id = $1", [soporte]);
  await db.query("insert into public.support_sessions (profile_id, business_id, reason, expires_at) values ($1, $2, 'sesión abierta', now() + interval '1 hour')", [soporte, A]);
  r = await as(soporte, "select count(*)::int n from public.customers where business_id = $1", [A]);
  check("una cuenta suspendida pierde el acceso aunque tenga sesión abierta", r.ok && r.rows[0].n === 0, r);
}

console.log("\nEtapa 27 · El superadministrador entra a editar un comercio");
{
  let r = await joinProgram("negocio-a", "+573001190001", "Clienta Edición");
  const tok = r.rows?.[0]?.public_token;
  const cardE = (await db.query("select id from public.loyalty_cards where public_token = $1", [tok])).rows[0]?.id;
  const soporte = "00000000-0000-0000-0000-0000000005e7";
  const super2 = "00000000-0000-0000-0000-0000000005e8";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'soporte-edita@test.local', '{}'), ($2, 'super-dos@test.local', '{\"full_name\":\"Super Dos\"}')", [soporte, super2]);
  await db.query("update public.profiles set platform_role = 'support' where id = $1", [soporte]);
  await db.query("update public.profiles set platform_role = 'superadmin' where id = $1", [super2]);
  // Sin sesiones abiertas de otras pruebas.
  await db.query("update public.support_sessions set ended_at = now() where ended_at is null");

  r = await as(super2, "update public.customers set full_name = 'Antes' where business_id = $1", [A]);
  check("sin sesión de edición, el superadministrador no cambia clientes", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);
  r = await as(soporte, "select public.start_support_session($1, 'Quiero cambiar la tarjeta', 30, 'edit')", [A]);
  check("Soporte no puede abrir el modo edición (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerB, "select public.start_support_session($1, 'Quiero cambiar la tarjeta', 30, 'edit')", [A]);
  check("un comercio no puede abrir el modo edición en otro (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(super2, "select public.start_support_session($1, 'hola', 30, 'edit')", [A]);
  check("el modo edición también exige motivo", expectError(r, "REASON_REQUIRED"), r);
  r = await as(super2, "select public.start_support_session($1, 'Mover el sello', 30, 'borrar')", [A]);
  check("un modo desconocido se rechaza (INVALID_INPUT)", expectError(r, "INVALID_INPUT"), r);

  r = await as(super2, "select public.start_support_session($1, 'El dueño pidió ayuda con su tarjeta', 500, 'edit') as hasta", [A]);
  check("el superadministrador abre el modo edición, de máximo 2 horas", r.ok && new Date(r.rows[0].hasta).getTime() - Date.now() <= 2 * 3600_000 + 5000, r);
  r = await as(super2, "update public.loyalty_programs set reward_name = 'Manicura completa' where business_id = $1", [A]);
  check("durante la sesión cambia el programa del comercio", r.ok && r.affected === 1, r);
  r = await as(super2, "update public.customers set full_name = 'Clienta Corregida' where id = (select customer_id from public.loyalty_cards where id = $1)", [cardE]);
  check("corrige los datos de una clienta", r.ok && r.affected === 1, r);
  r = await as(super2, "select public.register_visit($1, 'super-edita-0001') as res", [cardE]);
  check("y registra visitas como el comercio", r.ok, r);
  r = await as(super2, "update public.customers set full_name = 'Intruso' where business_id = $1", [B]);
  check("pero no cambia otro comercio sin abrir su sesión", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);

  r = await as(U.ownerA, "select metadata->>'reason' motivo, metadata->>'by' quien from public.audit_logs where business_id = $1 and action = 'support.edit_started' and actor_id = $2", [A, super2]);
  check("el dueño ve en su auditoría quién entró a editar y por qué", r.ok && r.rows.length === 1 && r.rows[0].motivo === "El dueño pidió ayuda con su tarjeta" && r.rows[0].quien === "Super Dos", r);
  r = await as(U.ownerA, "select count(*)::int n from public.audit_logs where business_id = $1 and actor_id = $2 and action not like 'support.%'", [A, super2]);
  check("y cada cambio queda a nombre del superadministrador", r.ok && r.rows[0].n > 0, r);

  r = await as(super2, "select public.end_support_session($1)", [A]);
  check("el superadministrador cierra la sesión de edición", r.ok, r);
  r = await as(U.ownerA, "select count(*)::int n from public.audit_logs where business_id = $1 and action = 'support.edit_ended' and actor_id = $2", [A, super2]);
  check("el cierre queda como «salió del modo edición»", r.ok && r.rows[0].n === 1, r);
  r = await as(super2, "update public.customers set full_name = 'Después' where business_id = $1", [A]);
  check("al cerrarla ya no puede cambiar nada", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);

  r = await as(super2, "select public.start_support_session($1, 'Solo quiero mirar las visitas', 30)", [A]);
  check("sin indicar el modo, la sesión es de solo lectura", r.ok, r);
  r = await as(super2, "update public.customers set full_name = 'Solo lectura' where business_id = $1", [A]);
  check("y en solo lectura el superadministrador tampoco cambia nada", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);
  await as(super2, "select public.end_support_session($1)", [A]);

  await db.query("insert into public.support_sessions (profile_id, business_id, reason, started_at, expires_at, mode) values ($1, $2, 'edición vieja', now() - interval '2 hours', now() - interval '1 hour', 'edit')", [super2, A]);
  r = await as(super2, "update public.customers set full_name = 'Vencida' where business_id = $1", [A]);
  check("una sesión de edición vencida no da permisos", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);

  await db.query("insert into public.support_sessions (profile_id, business_id, reason, expires_at, mode) values ($1, $2, 'edición de soporte', now() + interval '1 hour', 'edit')", [soporte, A]);
  r = await as(soporte, "update public.customers set full_name = 'Soporte' where business_id = $1", [A]);
  check("aunque existiera una sesión de edición de Soporte, no da permisos", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);

  await db.query("insert into public.support_sessions (profile_id, business_id, reason, expires_at, mode) values ($1, $2, 'edición abierta', now() + interval '1 hour', 'edit')", [super2, A]);
  await db.query("update public.profiles set suspended_at = now() where id = $1", [super2]);
  r = await as(super2, "update public.customers set full_name = 'Suspendido' where business_id = $1", [A]);
  check("un superadministrador suspendido pierde el modo edición", (r.ok && r.affected === 0) || expectError(r, "permission denied"), r);
  await db.query("update public.support_sessions set ended_at = now() where ended_at is null");
}

console.log("\nEtapa 23 · Sumar visita a mano");
{
  let r = await joinProgram("negocio-a", "+573001140001", "Cliente Manual");
  const tok = r.rows?.[0]?.public_token;
  const cardM = (await db.query("select id from public.loyalty_cards where public_token = $1", [tok])).rows[0]?.id;
  const antes = (await db.query("select current_stamps from public.loyalty_cards where id = $1", [cardM])).rows[0]?.current_stamps;
  const minAntes = (await db.query("select min_minutes_between_visits m from public.loyalty_programs where business_id = $1", [A])).rows[0]?.m;
  await db.query("update public.loyalty_programs set min_minutes_between_visits = 120 where business_id = $1", [A]);

  r = await as(U.staffA2, "select public.register_manual_visit($1, 'manual-0001', 'no')", [cardM]);
  check("sin motivo no se suma (REASON_REQUIRED)", expectError(r, "REASON_REQUIRED"), r);
  r = await as(U.ownerB, "select public.register_manual_visit($1, 'manual-0002', 'El NFC no funcionó')", [cardM]);
  check("otro comercio no puede sumar visitas a mano (FORBIDDEN)", expectError(r, "FORBIDDEN"), r);
  r = await as(null, "select public.register_manual_visit($1, 'manual-0003', 'El NFC no funcionó')", [cardM]);
  check("el público tampoco", !r.ok, r);

  r = await as(U.staffA2, "select public.register_manual_visit($1, 'manual-0004', 'El NFC no le funcionó al cliente') as res", [cardM]);
  check("un empleado suma la visita a mano con motivo", r.ok && r.rows[0].res?.current_stamps === antes + 1, { r, antes });
  r = await asService("select source, staff_id from public.visits where card_id = $1", [cardM]);
  check("la visita queda con origen «manual» y el empleado que la sumó", r.ok && r.rows.length === 1 && r.rows[0].source === "manual" && r.rows[0].staff_id === U.staffA2, r);
  r = await as(U.ownerA, "select metadata->>'reason' motivo, actor_id from public.audit_logs where business_id = $1 and action = 'visit.manual' and entity_id = $2", [A, cardM]);
  check("el dueño ve en la auditoría el motivo y quién la sumó", r.ok && r.rows.length === 1 && r.rows[0].motivo === "El NFC no le funcionó al cliente" && r.rows[0].actor_id === U.staffA2, r);

  r = await as(U.staffA2, "select public.register_manual_visit($1, 'manual-0005', 'Otra vez el NFC')", [cardM]);
  check("respeta el tiempo mínimo entre visitas", !r.ok && !r.error.includes("REASON_REQUIRED"), r);
  r = await as(U.staffA2, "select public.register_manual_visit($1, 'manual-0004', 'Doble clic en el botón')", [cardM]);
  check("un doble clic no suma dos veces", !r.ok, r);
  await db.query("update public.loyalty_programs set min_minutes_between_visits = $2 where business_id = $1", [A, minAntes]);
}

console.log("\nEtapa 24 · Nombre aparte para los avisos");
{
  let r = await joinProgram("negocio-a", "+573001150001", "María José Pérez");
  const tok = r.rows?.[0]?.public_token;
  const cus = (await db.query("select cu.id, cu.first_name from public.customers cu join public.loyalty_cards c on c.customer_id = cu.id where c.public_token = $1", [tok])).rows[0];
  check("sin nombre aparte, toma la primera palabra", cus?.first_name === "María", cus);
  await db.query("update public.customers set first_name = 'María José', marketing_consent = true, marketing_consent_at = now() where id = $1", [cus.id]);
  r = await as(U.ownerA, "select body from public.queue_wallet_campaign($1, $2, 'Hola', 'Hola {nombre}, te esperamos')", [A, [cus.id]]);
  check("la campaña saluda con el nombre aparte (compuesto) y sin apellido", r.ok && r.rows[0]?.body === "Hola María José, te esperamos", r);
  await db.query("update public.customers set full_name = 'Laura Pérez' where id = $1", [cus.id]);
  let fn = (await db.query("select first_name from public.customers where id = $1", [cus.id])).rows[0].first_name;
  check("si corrigen el nombre completo, el nombre aparte se actualiza", fn === "Laura", fn);
  r = await as(U.ownerA, "select public.anonymize_customer($1)", [cus.id]);
  fn = (await db.query("select first_name from public.customers where id = $1", [cus.id])).rows[0].first_name;
  check("al eliminar los datos personales también se borra el nombre", r.ok && fn === null, { r, fn });
  r = await as(U.ownerA, "update public.customers set first_name = repeat('x', 80) where business_id = $1", [A]);
  check("el nombre aparte tiene un largo máximo", !r.ok, r);
}

console.log("\nEtapa 25 · Ubicación de cada sede");
{
  const loc = (await db.query("insert into public.locations (business_id, name) values ($1, 'Sede Ubicada') returning id", [A])).rows[0].id;
  let r = await as(U.ownerA, "update public.locations set latitude = 4.698712, longitude = -74.041234 where id = $1 returning latitude, longitude", [loc]);
  check("el propietario guarda la ubicación de su sede", r.ok && r.rows[0]?.latitude === 4.698712 && r.rows[0]?.longitude === -74.041234, r);
  r = await as(U.ownerA, "update public.locations set latitude = null where id = $1", [loc]);
  check("no se puede guardar solo una de las dos coordenadas", !r.ok, r);
  r = await as(U.ownerA, "update public.locations set latitude = 95, longitude = 10 where id = $1", [loc]);
  check("latitud fuera de rango se rechaza", !r.ok, r);
  r = await as(U.ownerA, "update public.locations set latitude = 4, longitude = -190 where id = $1", [loc]);
  check("longitud fuera de rango se rechaza", !r.ok, r);
  r = await as(U.staffA2, "update public.locations set latitude = 1, longitude = 1 where id = $1", [loc]);
  const after = (await db.query("select latitude from public.locations where id = $1", [loc])).rows[0].latitude;
  check("un empleado no cambia la ubicación", (!r.ok || r.affected === 0) && after === 4.698712, { r, after });
  r = await as(U.ownerB, "update public.locations set latitude = 1, longitude = 1 where id = $1", [loc]);
  check("otro comercio no cambia la ubicación", (!r.ok || r.affected === 0), r);
  r = await as(U.ownerA, "update public.locations set latitude = null, longitude = null where id = $1 returning latitude", [loc]);
  check("se puede quitar la ubicación (sin aviso de cercanía)", r.ok && r.rows[0]?.latitude === null, r);
  await db.query("delete from public.locations where id = $1", [loc]);
}

console.log("\nEtapa 26 · Mensaje de cercanía editable");
{
  const base = { stamp: true, near: true, reward: true, birthday: true, winback: true, winbackDays: 45 };
  let r = await as(U.ownerA, "select public.update_wallet_settings($1, $2)", [A, JSON.stringify(base)]);
  check("los ajustes sin mensaje de cercanía siguen siendo válidos", r.ok, r);
  r = await as(U.ownerA, "select public.update_wallet_settings($1, $2)", [A, JSON.stringify({ ...base, nearbyText: "¡Hola {nombre}! Pasa por {comercio}" })]);
  const saved = (await db.query("select wallet_notifications ->> 'nearbyText' as t from public.businesses where id = $1", [A])).rows[0].t;
  check("el dueño guarda su mensaje de cercanía", r.ok && saved === "¡Hola {nombre}! Pasa por {comercio}", { r, saved });
  r = await as(U.ownerA, "select public.update_wallet_settings($1, $2)", [A, JSON.stringify({ ...base, nearbyText: "hey" })]);
  check("un mensaje demasiado corto se rechaza", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.ownerA, "select public.update_wallet_settings($1, $2)", [A, JSON.stringify({ ...base, nearbyText: "x".repeat(121) })]);
  check("un mensaje demasiado largo se rechaza", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.ownerA, "select public.update_wallet_settings($1, $2)", [A, JSON.stringify({ ...base, nearbyText: 7 })]);
  check("el mensaje debe ser texto", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.staffA2, "select public.update_wallet_settings($1, $2)", [A, JSON.stringify({ ...base, nearbyText: "Mensaje del empleado" })]);
  check("un empleado no cambia el mensaje", !r.ok, r);
  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, JSON.stringify(base)]);
}

console.log("\nEtapa 29 · Reverso del pase");
{
  const info = { whatsapp: "+573001234567", instagram: "prueba.salon", website: "https://prueba.example.com", hours: "Lun a sáb 9:00–19:00" };
  let r = await as(U.ownerA, "select public.update_pass_info($1, $2)", [A, JSON.stringify(info)]);
  const saved = (await db.query("select pass_info from public.businesses where id = $1", [A])).rows[0].pass_info;
  check("el dueño guarda WhatsApp, Instagram, web y horario", r.ok && saved.instagram === "prueba.salon", { r, saved });
  r = await as(U.ownerA, "select public.update_pass_info($1, $2)", [A, JSON.stringify({})]);
  check("todo es opcional: se puede dejar vacío", r.ok, r);
  for (const bad of [{ whatsapp: "300-123" }, { instagram: "@con espacio" }, { website: "http://inseguro.com" }, { website: "javascript:alert(1)" }, { hours: "x".repeat(301) }, { otra: "cosa" }]) {
    r = await as(U.ownerA, "select public.update_pass_info($1, $2)", [A, JSON.stringify(bad)]);
    if (!expectError(r, "INVALID_PASS_INFO")) break;
  }
  check("datos inválidos se rechazan (teléfono, usuario, enlace, horario, claves)", expectError(r, "INVALID_PASS_INFO"), r);
  r = await as(U.staffA, "select public.update_pass_info($1, $2)", [A, JSON.stringify(info)]);
  check("un empleado no cambia el reverso del pase", expectError(r, "FORBIDDEN"), r);
  r = await as(U.ownerA, "select public.update_pass_info($1, $2)", [B, JSON.stringify(info)]);
  check("no se cambia el reverso de otro comercio", expectError(r, "FORBIDDEN"), r);
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
  const p = (await db.query("select id, price_monthly::int price, max_customers, max_locations, features from public.plans order by id")).rows;
  const by = Object.fromEntries(p.map((x) => [x.id, x]));
  check("Starter: $79.990, 300 clientes y 1 sede", by.plan_starter.price === 79990 && by.plan_starter.max_customers === 300 && by.plan_starter.max_locations === 1, by.plan_starter);
  check("Pro: $139.990, 1.000 clientes y sedes sin límite", by.plan_pro.price === 139990 && by.plan_pro.max_customers === 1000 && by.plan_pro.max_locations === null, by.plan_pro);
  check("las características que ve el dueño dicen lo mismo", by.plan_starter.features.includes("Hasta 300 clientes") && by.plan_pro.features.includes("Hasta 1.000 clientes") && by.plan_pro.features.includes("Sedes ilimitadas"), p);
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
    // Como en un comercio real: visitas hechas en una sede y con una promoción. Esos enlaces
    // bloqueaban el borrado (la sede o la promoción se iban antes que sus visitas).
    const sede = (await seedDb.query("insert into public.locations (business_id, name) values ($1, 'Sede de prueba') returning id", [biz.id])).rows[0].id;
    const promo = (await seedDb.query("insert into public.promotions (business_id, name, bonus_stamps, starts_on, ends_on) values ($1, 'Promo de prueba', 1, current_date, current_date) returning id", [biz.id])).rows[0].id;
    const tarjeta = (await seedDb.query("select id from public.loyalty_cards where business_id = $1 limit 1", [biz.id])).rows[0].id;
    await seedDb.query("insert into public.visits (business_id, card_id, kind, delta, idempotency_key, location_id, promotion_id) values ($1, $2, 'visit', 1, 'visita-con-sede-y-promo', $3, $4)", [biz.id, tarjeta, sede, promo]);
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

// ---------- NFC: límite por día y ubicación ----------
{
  console.log("\nNFC: límite por día y ubicación");
  const N = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id, status)
    values ('negocio-nfc', 'Negocio NFC', 'Café', 'Barranquilla', 'plan_pro', 'active') returning id`)).rows[0].id;
  await db.query(`insert into public.loyalty_programs (business_id, name, stamps_required, reward_name, min_minutes_between_visits)
    values ($1, 'Club NFC', 6, 'Café', 0)`, [N]);
  const dueno = "00000000-0000-0000-0000-0000000000d7";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'dueno-nfc@test.local', '{}') on conflict do nothing", [dueno]);
  await db.query("insert into public.business_memberships (business_id, profile_id, role, can_redeem) values ($1, $2, 'owner', true)", [N, dueno]);
  const alta = async (tel) => (await asService("select * from public.join_program('negocio-nfc', $1, $2, null, true, false)", ["Cliente Prueba", tel])).rows[0]?.public_token;
  const t1 = await alta("+573000000101");
  const t2 = await alta("+573000000102");

  // Sin tiempo mínimo entre toques: lo único que frena es el límite del día.
  let q = await as(dueno, "select public.set_nfc_settings($1, true, 0, false) as s", [N]);
  const secreto = q.rows[0]?.s?.secret;
  check("nfc: por defecto el límite es 1 sello al día y no exige ubicación", q.ok && q.rows[0].s.max_per_day === 1 && q.rows[0].s.require_location === false, q);
  const toque = (token, clave, lat = null, lng = null) =>
    asService("select public.register_nfc_visit('negocio-nfc', $1, $2, $3, $4, $5) as r", [secreto, token, clave, lat, lng]);

  q = await toque(t1, "nfc37-toque-0001");
  check("nfc: el primer toque del día suma", q.ok, q);
  q = await toque(t1, "nfc37-toque-0002");
  check("nfc: el segundo toque del mismo día se rechaza (NFC_DAILY_LIMIT)", expectError(q, "NFC_DAILY_LIMIT"), q);
  q = await toque(t1, "nfc37-toque-0001");
  check("nfc: reintentar el toque ya registrado no choca con el límite (DUPLICATE_REQUEST)", expectError(q, "DUPLICATE_REQUEST"), q);
  q = await toque(t2, "nfc37-toque-0003");
  check("nfc: el límite es por tarjeta: otro cliente sí suma", q.ok, q);

  // Un sello de ayer no cuenta para hoy.
  await db.query("alter table public.visits disable trigger visits_immutable");
  await db.query("update public.visits set created_at = now() - interval '26 hours' where idempotency_key = 'nfc37-toque-0001'");
  await db.query("alter table public.visits enable trigger visits_immutable");
  await db.query("update public.loyalty_cards set last_visit_at = now() - interval '26 hours' where public_token = $1", [t1]);
  q = await toque(t1, "nfc37-toque-0004");
  check("nfc: al día siguiente vuelve a sumar", q.ok, q);

  // Si el comercio revierte el sello de hoy, el cliente puede volver a sumar.
  const v = (await db.query("select id from public.visits where idempotency_key = 'nfc37-toque-0004'")).rows[0].id;
  q = await as(dueno, "select public.reverse_visit($1, 'Sello por error')", [v]);
  q = await toque(t1, "nfc37-toque-0005");
  check("nfc: un sello revertido no cuenta para el límite del día", q.ok, q);

  q = await as(dueno, "select public.set_nfc_settings($1, true, 0, false, 3) as s", [N]);
  check("nfc: el dueño puede subir el límite del día", q.ok && q.rows[0].s.max_per_day === 3, q);
  q = await as(dueno, "select public.set_nfc_settings($1, true, 0, false, 99)", [N]);
  check("nfc: no se acepta un límite fuera de 1 a 20", expectError(q, "INVALID_NFC_SETTINGS"), q);
  q = await toque(t1, "nfc37-toque-0006");
  check("nfc: con límite 3, el segundo sello válido del día suma", q.ok, q);
  await as(dueno, "select public.set_nfc_settings($1, true, 0, false, 1)", [N]);

  // Ubicación.
  q = await as(dueno, "select public.set_nfc_settings($1, true, 0, false, null, true)", [N]);
  check("nfc: no se puede exigir ubicación sin una sede con ubicación", expectError(q, "NFC_NEEDS_LOCATION"), q);
  await db.query("insert into public.locations (business_id, name, latitude, longitude) values ($1, 'Sede con mapa', 10.9878, -74.7889)", [N]);
  q = await as(dueno, "select public.set_nfc_settings($1, true, 0, false, null, true) as s", [N]);
  check("nfc: con una sede con ubicación sí se puede exigir", q.ok && q.rows[0].s.require_location === true && q.rows[0].s.can_require_location === true, q);

  const t3 = await alta("+573000000103");
  q = await toque(t3, "nfc37-ubica-0001");
  check("nfc: sin ubicación se rechaza (LOCATION_REQUIRED)", expectError(q, "LOCATION_REQUIRED"), q);
  q = await toque(t3, "nfc37-ubica-0002", 4.711, -74.0721);
  check("nfc: desde otra ciudad se rechaza (TOO_FAR)", expectError(q, "TOO_FAR"), q);
  q = await toque(t3, "nfc37-ubica-0003", 10.9952, -74.7889);
  check("nfc: a 800 m del local se rechaza (TOO_FAR)", expectError(q, "TOO_FAR"), q);
  q = await toque(t3, "nfc37-ubica-0004", 10.9886, -74.7891);
  check("nfc: a unos 90 m del local suma", q.ok, q);
  const guardada = (await db.query("select count(*)::int n from information_schema.columns where table_schema in ('public','private') and table_name in ('visits','nfc_phone_attempts') and column_name ~ 'lat|lng|longitude'")).rows[0].n;
  check("nfc: la ubicación del cliente no se guarda en ninguna tabla de visitas", guardada === 0, guardada);

  // Por celular: lejos del local, la respuesta es la misma exista o no el número.
  const porCelular = (tel, clave, lat = null, lng = null) =>
    asService("select public.register_nfc_visit_by_phone('negocio-nfc', $1, $2, $3, 'conexion-prueba-37', $4, $5) as r", [secreto, tel, clave, lat, lng]);
  const lejosExiste = await porCelular("+573000000102", "nfc37-cel-0001", 4.711, -74.0721);
  const lejosNoExiste = await porCelular("+573009999999", "nfc37-cel-0002", 4.711, -74.0721);
  check(
    "nfc por celular: lejos del local responde igual (TOO_FAR) exista o no el número",
    expectError(lejosExiste, "TOO_FAR") && expectError(lejosNoExiste, "TOO_FAR"),
    { lejosExiste, lejosNoExiste },
  );
  q = await porCelular("+573009999999", "nfc37-cel-0003", 10.9886, -74.7891);
  check("nfc por celular: en el local, un número que no existe da PHONE_NOT_FOUND", q.ok && q.rows[0].r.error === "PHONE_NOT_FOUND", q);
  q = await porCelular("+573000000102", "nfc37-cel-0004", 10.9886, -74.7891);
  check("nfc por celular: el límite del día también aplica", expectError(q, "NFC_DAILY_LIMIT"), q);

  q = await as(U.ownerA, "select public.set_nfc_settings($1, true, 0, false, 5, false)", [N]);
  check("nfc: el dueño de otro comercio no cambia estos ajustes", expectError(q, "FORBIDDEN"), q);
  q = await as(dueno, "select public.register_nfc_visit('negocio-nfc', $1, $2, 'nfc37-directo-01', 10.9886, -74.7891)", [secreto, t3]);
  check("nfc: nadie con sesión puede llamar directamente a la función de sumar", expectError(q, "permission denied"), q);
}

// ---------- Control de cobros ----------
{
  console.log("\nControl de cobros");
  const soporte = "00000000-0000-0000-0000-0000000000c5";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'cobros-soporte@test.local', '{}') on conflict do nothing", [soporte]);
  await db.query("update public.profiles set platform_role = 'support' where id = $1", [soporte]);

  const fecha = async (id) => (await db.query("select to_char(paid_until, 'YYYY-MM-DD') d from public.business_billing where business_id = $1", [id])).rows[0]?.d;
  const nuevo = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id)
    values ('cobro-nuevo', 'Cobro Nuevo', 'Café', 'Cali', 'plan_starter') returning id`)).rows[0].id;
  const hoy = (await db.query("select to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD') d")).rows[0].d;
  check("cobros: un comercio nuevo empieza sin meses pagados (por cobrar desde hoy)", (await fecha(nuevo)) === hoy, await fecha(nuevo));
  check("cobros: los comercios que ya existían también tienen fecha", !!(await fecha(A)) && !!(await fecha(B)));

  let q = await as(U.ownerA, "select * from public.business_billing where business_id = $1", [A]);
  check("cobros: el dueño del comercio no ve sus datos de cobro", q.ok && q.rows.length === 0, q);
  q = await as(U.ownerA, "select * from public.business_payments");
  check("cobros: el dueño no ve el historial de pagos", q.ok && q.rows.length === 0, q);
  q = await as(soporte, "select * from public.business_billing where business_id = $1", [A]);
  check("cobros: soporte sí ve la fecha de pago", q.ok && q.rows.length === 1, q);
  q = await as(U.ownerA, "update public.business_billing set paid_until = '2099-01-01' where business_id = $1", [A]);
  check("cobros: nadie cambia la fecha directamente en la tabla", !q.ok || q.affected === 0, q);
  q = await as(U.ownerA, "select public.register_business_payment($1, 79990, current_date, 1, null)", [A]);
  check("cobros: el dueño no puede registrar pagos", expectError(q, "FORBIDDEN"), q);
  q = await as(soporte, "select public.register_business_payment($1, 79990, current_date, 1, null)", [A]);
  check("cobros: soporte no puede registrar pagos", expectError(q, "FORBIDDEN"), q);
  q = await as(U.super, "select public.register_business_payment($1, 79990, current_date, 13, null)", [A]);
  check("cobros: no se aceptan más de 12 meses por pago", expectError(q, "INVALID_INPUT"), q);

  // Estas pruebas son del ciclo normal (sin el mes gratis del Starter): el comercio A pasa al plan Pro.
  const planA = (await db.query("select plan_id from public.businesses where id = $1", [A])).rows[0].plan_id;
  await db.query("update public.businesses set plan_id = 'plan_pro' where id = $1", [A]);
  // A se creó en la prueba (como comercio nuevo): se marca como uno que ya existía, sin mes gratis pendiente.
  await db.query("update public.business_billing set free_month_pending = false where business_id = $1", [A]);
  await db.query("update public.business_billing set paid_until = '2026-01-31' where business_id = $1", [A]);
  q = await as(U.super, "select to_char(public.register_business_payment($1, 79990, '2026-02-05', 1, '  Transferencia  '), 'YYYY-MM-DD') d", [A]);
  check("cobros: el pago avanza desde la fecha anterior, no desde hoy (31 ene → 28 feb)", q.ok && q.rows[0].d === "2026-02-28", q);
  q = await as(U.super, "select to_char(public.register_business_payment($1, 159980, '2026-03-01', 2, null), 'YYYY-MM-DD') d", [A]);
  check("cobros: pagar 2 meses suma 2 meses", q.ok && q.rows[0].d === "2026-04-28", q);
  const pagos = (await db.query("select amount, months, note, created_by from public.business_payments where business_id = $1 order by created_at", [A])).rows;
  check("cobros: cada pago queda en el historial con quién lo registró", pagos.length === 2 && pagos[0].note === "Transferencia" && pagos[1].months === 2 && pagos[0].created_by === U.super, pagos);
  const aud = (await db.query("select count(*)::int n from public.audit_logs where business_id = $1 and action = 'billing.payment_registered'", [A])).rows[0].n;
  check("cobros: los pagos quedan en la auditoría", aud === 2, aud);

  await db.query("update public.businesses set plan_id = $2 where id = $1", [A, planA]);
  q = await as(U.super, "select public.set_business_paid_until($1, '2026-12-15', 'ok')", [A]);
  check("cobros: corregir la fecha exige un motivo", expectError(q, "INVALID_INPUT"), q);
  q = await as(U.super, "select public.set_business_paid_until($1, '2026-12-15', 'Acuerdo con el dueño')", [A]);
  check("cobros: el superadministrador corrige la fecha con motivo", q.ok && (await fecha(A)) === "2026-12-15", q);
  const audFecha = (await db.query("select metadata->>'reason' r from public.audit_logs where business_id = $1 and action = 'billing.paid_until_changed'", [A])).rows[0]?.r;
  check("cobros: la corrección queda en la auditoría con su motivo", audFecha === "Acuerdo con el dueño", audFecha);

  check("cobros: los comercios que ya existían no reciben otro mes gratis", (await db.query("select free_month_pending p from public.business_billing where business_id = $1", [A])).rows[0].p === false);
  // Oferta Starter: pagas el primer mes y el segundo es gratis. Comercio aparte (sus pagos quedan en la auditoría).
  const oferta = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id)
    values ('cobro-oferta', 'Cobro Oferta', 'Café', 'Cali', 'plan_starter') returning id`)).rows[0].id;
  await db.query("update public.business_billing set paid_until = '2026-03-01' where business_id = $1", [oferta]);
  q = await as(U.super, "select to_char(public.register_business_payment($1, 79990, '2026-03-10', 1, null), 'YYYY-MM-DD') d", [oferta]);
  check("cobros: el primer pago del Starter suma el mes gratis, desde el día en que pagó (10 mar → 10 may)", q.ok && q.rows[0].d === "2026-05-10", q);
  q = await as(U.super, "select to_char(public.register_business_payment($1, 79990, '2026-05-08', 1, null), 'YYYY-MM-DD') d", [oferta]);
  check("cobros: el segundo pago ya no trae mes gratis (10 may → 10 jun)", q.ok && q.rows[0].d === "2026-06-10", q);
  const gratis = (await db.query("select free_months from public.business_payments where business_id = $1 order by created_at", [oferta])).rows.map((r) => r.free_months);
  check("cobros: el historial marca el mes gratis solo en el primer pago", JSON.stringify(gratis) === "[1,0]", gratis);
  const audGratis = (await db.query("select metadata->>'free_months' g from public.audit_logs where business_id = $1 and action = 'billing.payment_registered' order by created_at limit 1", [oferta])).rows[0]?.g;
  check("cobros: el mes gratis queda en la auditoría", audGratis === "1", audGratis);
  const pro = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id)
    values ('cobro-pro', 'Cobro Pro', 'Café', 'Cali', 'plan_pro') returning id`)).rows[0].id;
  await db.query("update public.business_billing set paid_until = '2026-03-01' where business_id = $1", [pro]);
  q = await as(U.super, "select to_char(public.register_business_payment($1, 139990, '2026-03-01', 1, null), 'YYYY-MM-DD') d", [pro]);
  check("cobros: el plan Pro no tiene mes gratis (1 mar → 1 abr)", q.ok && q.rows[0].d === "2026-04-01", q);

  await db.query("delete from public.businesses where id = $1", [nuevo]);
  const resto = (await db.query("select count(*)::int n from public.business_billing where business_id = $1", [nuevo])).rows[0].n;
  check("cobros: al eliminar un comercio se borran sus datos de cobro", resto === 0, resto);
}

// ---------- Pago del plan en línea (Wompi) ----------
{
  console.log("\nPago del plan en línea (Wompi)");
  // Comercio nuevo en Starter: su dueño es ownerA (se agrega como propietario).
  const tienda = (await db.query(`insert into public.businesses (slug, name, category, city, plan_id)
    values ('pago-linea', 'Pago Línea', 'Café', 'Cali', 'plan_starter') returning id`)).rows[0].id;
  const dueno = "00000000-0000-0000-0000-0000000000d1";
  const empleado = "00000000-0000-0000-0000-0000000000d2";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'pago-dueno@test.local', '{}'), ($2, 'pago-empleado@test.local', '{}') on conflict do nothing", [dueno, empleado]);
  await db.query("insert into public.business_memberships (business_id, profile_id, role, active) values ($1, $2, 'owner', true), ($1, $3, 'staff', true)", [tienda, dueno, empleado]);
  const precio = (await db.query("select price_monthly from public.plans where id = 'plan_starter'")).rows[0].price_monthly;

  let q = await as(empleado, "select * from public.start_online_payment($1, 1)", [tienda]);
  check("pago en línea: un empleado no puede iniciar el pago del plan", expectError(q, "FORBIDDEN"), q);
  q = await as(U.ownerB, "select * from public.start_online_payment($1, 1)", [tienda]);
  check("pago en línea: el dueño de otro comercio no puede pagar por este", expectError(q, "FORBIDDEN"), q);
  q = await as(dueno, "select * from public.start_online_payment($1, 13)", [tienda]);
  check("pago en línea: no más de 12 meses", expectError(q, "INVALID_INPUT"), q);
  q = await as(dueno, "select * from public.start_online_payment($1, 1)", [tienda]);
  const orden = q.rows?.[0];
  check("pago en línea: el dueño inicia el pago y el valor sale del plan (en centavos)", q.ok && Number(orden.amount_cents) === precio * 100 && /^lazo-[a-z0-9]+$/.test(orden.reference), q);

  q = await as(dueno, "select public.confirm_online_payment($1, 'tx-1', 'APPROVED', $2)", [orden.reference, orden.amount_cents]);
  check("pago en línea: nadie con sesión confirma pagos (solo el servidor)", !q.ok, q);
  q = await as(dueno, "insert into public.online_payments (reference, business_id, months, amount_cents) values ('lazo-trampa-0001', $1, 12, 100)", [tienda]);
  check("pago en línea: nadie crea órdenes directamente en la tabla", !q.ok, q);

  q = await asService("select public.confirm_online_payment($1, 'tx-1', 'APPROVED', $2) r", [orden.reference, Number(orden.amount_cents) - 100]);
  check("pago en línea: si el valor no coincide no se aplica", q.ok && q.rows[0].r === "mismatch", q);
  q = await as(dueno, "select * from public.start_online_payment($1, 1)", [tienda]);
  const orden2 = q.rows[0];
  const hoy = (await db.query("select (now() at time zone 'America/Bogota')::date d")).rows[0].d;
  q = await asService("select public.confirm_online_payment($1, 'tx-2', 'DECLINED', $2) r", [orden2.reference, orden2.amount_cents]);
  check("pago en línea: un pago rechazado solo cambia el estado", q.ok && q.rows[0].r === "updated", q);
  q = await as(dueno, "select * from public.start_online_payment($1, 1)", [tienda]);
  const orden3 = q.rows[0];
  q = await asService("select public.confirm_online_payment($1, 'tx-3', 'APPROVED', $2) r", [orden3.reference, orden3.amount_cents]);
  check("pago en línea: un pago aprobado se registra", q.ok && q.rows[0].r === "applied", q);
  const esperado = (await db.query("select to_char(($1::date + interval '2 months'), 'YYYY-MM-DD') d", [hoy])).rows[0].d;
  const tras = (await db.query("select to_char(paid_until, 'YYYY-MM-DD') d, free_month_pending p from public.business_billing where business_id = $1", [tienda])).rows[0];
  check("pago en línea: el primer pago del Starter suma el segundo mes gratis", tras.d === esperado && tras.p === false, tras);
  const pago = (await db.query("select amount, months, free_months, note, created_by from public.business_payments where business_id = $1", [tienda])).rows;
  check("pago en línea: queda en el historial con nota de Wompi y quién pagó", pago.length === 1 && pago[0].amount === precio && pago[0].free_months === 1 && /^Pago en línea · tx-3$/.test(pago[0].note) && pago[0].created_by === dueno, pago);
  q = await asService("select public.confirm_online_payment($1, 'tx-3', 'APPROVED', $2) r", [orden3.reference, orden3.amount_cents]);
  const pagos = (await db.query("select count(*)::int n from public.business_payments where business_id = $1", [tienda])).rows[0].n;
  check("pago en línea: si Wompi repite el aviso, no se cobra dos veces", q.ok && q.rows[0].r === "already" && pagos === 1, { q, pagos });
  q = await asService("select public.confirm_online_payment('lazo-noexiste123', 'tx-9', 'APPROVED', 100) r");
  check("pago en línea: una referencia desconocida se ignora", q.ok && q.rows[0].r === "unknown", q);

  q = await as(dueno, "select * from public.my_billing($1)", [tienda]);
  check("pago en línea: el dueño ve su fecha de pago y su plan", q.ok && q.rows.length === 1 && q.rows[0].plan_id === "plan_starter", q);
  q = await as(empleado, "select * from public.my_billing($1)", [tienda]);
  check("pago en línea: un empleado no ve el cobro", q.ok && q.rows.length === 0, q);
  q = await as(dueno, "select reference, status from public.online_payments where business_id = $1", [tienda]);
  check("pago en línea: el dueño ve sus órdenes de pago", q.ok && q.rows.length === 3, q);
  q = await as(U.ownerB, "select reference from public.online_payments where business_id = $1", [tienda]);
  check("pago en línea: otro comercio no ve esas órdenes", q.ok && q.rows.length === 0, q);
}

console.log("\nRecordatorios automáticos (migración 43)");
{
  const join = async (name, phone) => {
    const r = await asService("select * from public.join_program('negocio-a', $1, $2, null, true, true)", [name, phone]);
    if (!r.ok) throw new Error(r.error);
    return (await db.query("select c.id card_id, c.public_token from public.loyalty_cards c where c.public_token = $1", [r.rows[0].public_token])).rows[0];
  };
  const req = (await db.query("select p.stamps_required n from public.loyalty_programs p join public.businesses b on b.id = p.business_id where b.id = $1 limit 1", [A])).rows[0].n;
  const cerca = await join("Carla Cerca", "+573165559001");
  const lejos = await join("Luis Lejos", "+573165559002");
  await db.query("update public.loyalty_cards set current_stamps = $2, last_visit_at = now() - interval '12 days' where id = $1", [cerca.card_id, req - 1]);
  await db.query("update public.loyalty_cards set current_stamps = 1, last_visit_at = now() - interval '12 days' where id = $1", [lejos.card_id]);
  const base = { stamp: true, near: true, reward: true, birthday: true, winback: true, winbackDays: 45 };
  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, base]);
  const candidatos = async (card) => (await asService("select * from public.wallet_daily_candidates() where card_id = $1", [card])).rows ?? [];

  let r = await candidatos(cerca.card_id);
  check("«te falta poco» viene activo por defecto: a 1 sello y 12 días sin venir", r.length === 1 && r[0].kind === "almost" && r[0].first_name === "Carla", r);
  r = await candidatos(lejos.card_id);
  check("«te falta poco» no le llega a quien no lleva ni la mitad de la tarjeta", r.length === 0, r);

  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, { ...base, almost: true, almostDays: 3 }]);
  check("«te falta poco» con menos de 5 días → rechazado", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, { ...base, winbackText: "hey" }]);
  check("mensaje de «te extrañamos» muy corto → rechazado", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, { ...base, almost: "si" }]);
  check("«te falta poco» que no es sí/no → rechazado", expectError(r, "INVALID_WALLET_SETTINGS"), r);
  r = await as(U.adminA, "select public.update_wallet_settings($1, $2)", [A, { ...base, almost: true, almostDays: 15, winbackText: "Hola {nombre}, vuelve a {comercio}. {progreso}" }]);
  check("el administrador guarda los recordatorios", r.ok, r);
  r = await candidatos(cerca.card_id);
  check("respeta los días configurados (15: a los 12 días aún no)", r.length === 0, r);

  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, { ...base, almost: false }]);
  await db.query("update public.loyalty_cards set last_visit_at = now() - interval '20 days' where id = $1", [cerca.card_id]);
  r = await candidatos(cerca.card_id);
  check("con «te falta poco» apagado no se envía", r.length === 0, r);

  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, { ...base, winbackDays: 14, winbackText: "Hola {nombre}, vuelve. {progreso}" }]);
  r = await candidatos(cerca.card_id);
  check("si ya toca «te extrañamos», va ese con el mensaje propio (y no los dos)", r.length === 1 && r[0].kind === "winback" && r[0].message === "Hola {nombre}, vuelve. {progreso}", r);

  await db.query("insert into public.wallet_notifications (business_id, card_id, kind, ref, title, body, created_at) values ($1, $2, 'campaign', 'campaign:prueba-43', 'Hola', 'Hola', now() - interval '2 days')", [A, cerca.card_id]);
  r = await candidatos(cerca.card_id);
  check("máximo un recordatorio por semana: con una campaña hace 2 días, nada", r.length === 0, r);
  await db.query("update public.wallet_notifications set created_at = now() - interval '8 days' where ref = 'campaign:prueba-43'");
  r = await candidatos(cerca.card_id);
  check("pasada la semana vuelve a tocar", r.length === 1 && r[0].kind === "winback", r);

  r = await asService("insert into public.wallet_notifications (business_id, card_id, kind, ref, title, body) values ($1, $2, 'almost', 'almost:x', 'a', 'b')", [A, lejos.card_id]);
  check("el registro admite el tipo «te falta poco»", r.ok, r);
  r = await as(U.ownerA, "select * from public.wallet_daily_candidates()");
  check("el proceso diario sigue sin poder llamarse desde el panel", !r.ok, r);
  await db.query("update public.businesses set wallet_notifications = $2 where id = $1", [A, { ...base, near: true }]);
}

console.log("\nDemo: sello de prueba (migración 44)");
{
  const tokA = (await joinProgram("negocio-a", "+573177770001", "Demo No")).rows?.[0]?.public_token;
  // Una prueba anterior dejó a B con el freno de inscripciones masivas: esas inscripciones pasan a ayer.
  await db.query("update public.customers set created_at = now() - interval '1 day' where business_id = $1 and created_at > now() - interval '1 hour'", [B]);
  const tokB = (await joinProgram("negocio-b", "+573177770002", "Demo Sí")).rows?.[0]?.public_token;
  const cardB = (await db.query("select id from public.loyalty_cards where public_token = $1", [tokB])).rows[0].id;
  const sello = (tok, key) => asService("select public.demo_add_stamp($1, $2) r", [tok, key]);
  // Las visitas no se pueden modificar (registro inmutable): solo para la prueba se apaga ese bloqueo un momento.
  const atrasar = async (sql, params) => {
    await db.query("set session_replication_role = replica");
    try {
      await db.query(sql, params);
    } finally {
      await db.query("set session_replication_role = origin");
    }
  };

  let r = await sello(tokB, "demo-0001");
  check("demo: un comercio que no es demo no acepta sellos de prueba", expectError(r, "NOT_DEMO"), r);
  r = await sello(tokA, "demo-0002");
  check("demo: tampoco en otro comercio normal", expectError(r, "NOT_DEMO"), r);
  r = await as(U.ownerB, "update public.businesses set is_demo = true where id = $1", [B]);
  check("demo: el dueño no puede marcar su comercio como demo", !r.ok || r.affected === 0, r);
  r = await as(null, "select public.demo_add_stamp($1, 'demo-0003')", [tokB]);
  check("demo: no se llama con la clave pública", !r.ok, r);
  r = await as(U.ownerB, "select public.demo_add_stamp($1, 'demo-0003')", [tokB]);
  check("demo: ni desde el panel", !r.ok, r);

  await db.query("update public.loyalty_programs set min_minutes_between_visits = 60 where business_id = $1", [B]);
  await db.query("update public.businesses set is_demo = true where id = $1", [B]);
  r = await sello(tokB, "demo-0004");
  const v1 = (await db.query("select source from public.visits where card_id = $1 and kind = 'visit'", [cardB])).rows;
  check("demo: suma el sello de prueba (origen «demo»)", r.ok && r.rows[0].r.current_stamps === 1 && v1.length === 1 && v1[0].source === "demo", { r, v1 });
  r = await sello(tokB, "demo-0005");
  check("demo: freno de 10 segundos entre sellos", expectError(r, "DEMO_TOO_FAST"), r);
  r = await sello(tokB, "demo-0004");
  check("demo: un reintento con la misma clave no suma otro", !r.ok && /DUPLICATE_REQUEST/.test(r.error), r);
  // El programa B pide 60 minutos entre visitas: la demo no lo usa, solo su freno de 10 segundos.
  let premio = null;
  for (let i = 0; i < 4; i++) {
    await atrasar("update public.visits set created_at = created_at - interval '20 seconds' where card_id = $1", [cardB]);
    r = await sello(tokB, `demo-01${i}0`);
    if (!r.ok) break;
    premio = r.rows[0].r.reward_id ?? premio;
  }
  const c = (await db.query("select current_stamps, status from public.loyalty_cards where id = $1", [cardB])).rows[0];
  check("demo: con 5 sellos de prueba se gana el premio (sin esperar los 60 minutos del programa)", r.ok && premio && c.current_stamps === 0 && c.status === "reward_available", { r, c });

  await db.query(`insert into public.visits (business_id, card_id, kind, delta, idempotency_key, source, created_at)
    select $1, $2, 'visit', 1, 'demo-masivo-' || g, 'demo', now() - interval '1 hour' from generate_series(1, 30) g`, [B, cardB]);
  await atrasar("update public.visits set created_at = created_at - interval '20 seconds' where card_id = $1 and created_at > now() - interval '1 minute'", [cardB]);
  r = await sello(tokB, "demo-0099");
  check("demo: máximo 30 sellos de prueba al día", expectError(r, "DEMO_DAILY_LIMIT"), r);

  const tokB2 = (await joinProgram("negocio-b", "+573177770003", "Visita Normal")).rows?.[0]?.public_token;
  const cardB2 = (await db.query("select id from public.loyalty_cards where public_token = $1", [tokB2])).rows[0].id;
  r = await as(U.ownerB, "select * from public.register_visit($1, 'staff-demo-1', null)", [cardB2]);
  const r2 = await as(U.ownerB, "select * from public.register_visit($1, 'staff-demo-2', null)", [cardB2]);
  check("demo: las visitas normales siguen respetando el tiempo mínimo del programa", r.ok && expectError(r2, "TOO_SOON"), { r, r2 });
  await db.query("update public.businesses set is_demo = false where id = $1", [B]);
}

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
