// Verifica el proyecto Supabase real con los usuarios de la semilla.
// Inicia sesión como cada rol usando .seed-credentials.local.json (nunca imprime contraseñas)
// y comprueba RLS y permisos a través de la API pública, igual que la app.
// Uso: npm run db:verify          (no modifica datos)
//      npm run db:verify -- --e2e  (crea/usa el cliente de prueba "Cliente Verificación" y le suma una visita)
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const creds: Record<string, { email: string; password: string }> = JSON.parse(readFileSync(".seed-credentials.local.json", "utf8"));

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
};

async function as(demoId: string) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword(creds[demoId]);
  if (error) throw new Error(`No se pudo iniciar sesión como ${demoId}: ${error.message}`);
  return client;
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
// Desde la Etapa 11 solo el servidor (service_role) puede inscribir. La clave se lee de .env.local y nunca se imprime.
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

console.log("\nAcceso público (anon)");
{
  const { data, error } = await anon.from("customers").select("id").limit(1);
  check("anon no puede leer clientes", !!error || (data ?? []).length === 0, error?.message);
  const { data: card } = await anon.rpc("get_public_card", { p_token: "q7Lm2Xv9RkTz4pWb8NcY3a" });
  check("anon ve la tarjeta pública de Sofía por token", card?.customer_name === "Sofía Martínez", card);
  check("la tarjeta pública no expone teléfono", card && !JSON.stringify(card).includes("+57"));
  const { error: e2 } = await anon.rpc("register_visit", { p_card_id: "00000000-0000-0000-0000-000000000000", p_idempotency_key: "anon-check-1" });
  check("anon no puede registrar visitas", !!e2);
  const { error: jn } = await anon.rpc("join_program", { p_slug: "beautyclub", p_full_name: "Directa Anon", p_phone_e164: "+573000000098", p_email: null, p_accept_terms: true, p_marketing_consent: false });
  check("anon ya no puede inscribirse saltándose la app", !!jn, jn?.message);
  const { error: jl } = await anon.rpc("join_program_limited", { p_client_key: "x", p_slug: "beautyclub", p_full_name: "Directa Anon", p_phone_e164: "+573000000098", p_email: null, p_accept_terms: true, p_marketing_consent: false });
  check("ni con la versión con límite", !!jl, jl?.message);
  const { data: un } = await anon.rpc("unsubscribe_marketing", { p_token: "tokenInexistente0000000" });
  check("la baja de marketing con un token inexistente no afecta a nadie", un === false, un);
  const { error: az } = await anon.rpc("anonymize_customer", { p_customer_id: "00000000-0000-0000-0000-000000000000" });
  check("anon no puede eliminar datos de clientas", !!az, az?.message);
}

console.log("\nPropietaria de Beauty Club (Valentina)");
const owner = await as("usr_owner");
{
  const { data: biz } = await owner.from("businesses").select("slug");
  check("solo ve su comercio", biz?.length === 1 && biz[0].slug === "beautyclub", biz);
  const { count } = await owner.from("customers").select("*", { count: "exact", head: true });
  check("ve los clientes de Beauty Club", (count ?? 0) >= 38, count);
  const { count: visits } = await owner.from("visits").select("*", { count: "exact", head: true });
  check("ve el historial de visitas", (visits ?? 0) > 200, visits);
  const { data: audit } = await owner.from("audit_logs").select("id").limit(1);
  check("puede leer la auditoría", Array.isArray(audit));
  const { error } = await owner.rpc("platform_business_stats");
  check("no accede a estadísticas de plataforma", !!error && error.message.includes("FORBIDDEN"), error?.message);
}

console.log("\nEmpleada sin permiso de canje (Daniela)");
const staff = await as("usr_staff2");
{
  const { count } = await staff.from("customers").select("*", { count: "exact", head: true });
  check("puede buscar clientes", (count ?? 0) >= 38, count);
  const { data: upd } = await staff.from("loyalty_programs").update({ stamps_required: 2 }).neq("id", "00000000-0000-0000-0000-000000000000").select("id");
  check("no puede editar el programa", (upd ?? []).length === 0, upd);
  const { data: reward } = await staff.from("rewards").select("id").eq("status", "available").limit(1).maybeSingle();
  if (reward) {
    const { error } = await staff.rpc("redeem_reward", { p_reward_id: reward.id });
    check("no puede canjear recompensas", !!error && error.message.includes("FORBIDDEN"), error?.message);
  }
  const { data: audit } = await staff.from("audit_logs").select("id");
  check("no ve la auditoría", (audit ?? []).length === 0, audit?.length);
}

console.log("\nOtro comercio (Andrés, El Corte Barbería)");
const other = await as("usr_barber");
{
  const { count } = await other.from("customers").select("*", { count: "exact", head: true });
  check("no ve clientes de Beauty Club", count === 0, count);
  const { data: biz } = await other.from("businesses").select("slug");
  check("solo ve su propio comercio", biz?.length === 1 && biz[0].slug === "elcorte", biz);
  const { data: card } = await owner.from("loyalty_cards").select("id").limit(1).single();
  const { error } = await other.rpc("register_visit", { p_card_id: card!.id, p_idempotency_key: "cross-tenant-check" });
  check("no puede registrar visitas en tarjetas de Beauty Club", !!error && error.message.includes("FORBIDDEN"), error?.message);
}

console.log("\nSuperadministrador");
const sup = await as("usr_super");
{
  const { data: biz } = await sup.from("businesses").select("id");
  check("ve los 7 comercios", biz?.length === 7, biz?.length);
  const { count } = await sup.from("customers").select("*", { count: "exact", head: true });
  check("no ve datos personales de clientes", count === 0, count);
  const { data: stats, error } = await sup.rpc("platform_business_stats");
  check("obtiene agregados por comercio", !error && stats?.length === 7, error?.message);
}

console.log("\nEtapa 3 · flujo de inscripción y visita");
{
  const { data: pub } = await anon.rpc("get_public_business", { p_slug: "beautyclub" });
  check("anon ve la ficha pública de Beauty Club (sin clientes)", pub?.program?.stamps_required === 9 && !/phone_e164|\+57\d{10}/.test(JSON.stringify(pub)), pub);
}
if (process.argv.includes("--e2e")) {
  // Crea (o reutiliza) un cliente de prueba identificable. Las visitas son inmutables: queda en el historial.
  const phone = "+573000000001";
  const join = () =>
    service.rpc("join_program", { p_slug: "beautyclub", p_full_name: "Cliente Verificación", p_phone_e164: phone, p_email: null, p_accept_terms: true, p_marketing_consent: false });
  const { data: j1, error: je } = await join();
  const token = (Array.isArray(j1) ? j1[0] : j1)?.public_token as string | undefined;
  check("el servidor inscribe con join_program", !!token, je?.message);
  const { data: j2 } = await join();
  check("repetir el teléfono devuelve la misma tarjeta", (Array.isArray(j2) ? j2[0] : j2)?.public_token === token && (Array.isArray(j2) ? j2[0] : j2)?.existing === true);

  const laura = await as("usr_staff1");
  const { data: card } = await laura.from("loyalty_cards").select("id, current_stamps, total_visits, last_visit_at").eq("public_token", token!).single();
  check("la empleada encuentra la tarjeta escaneada", !!card);
  const before = card!.total_visits;
  const key = `verify-${Date.now()}`;
  const { data: v, error: ve } = await laura.rpc("register_visit", { p_card_id: card!.id, p_idempotency_key: key });
  const recent = card!.last_visit_at && Date.now() - new Date(card!.last_visit_at).getTime() < 60 * 60_000;
  if (recent) check("segunda visita en menos de 60 min → TOO_SOON", !!ve && ve.message.includes("TOO_SOON"), ve?.message);
  else {
    check("la empleada registra la visita", !ve && typeof v?.current_stamps === "number", ve?.message);
    const { error: dup } = await laura.rpc("register_visit", { p_card_id: card!.id, p_idempotency_key: key });
    check("reintento con la misma clave → DUPLICATE_REQUEST", !!dup && dup.message.includes("DUPLICATE_REQUEST"), dup?.message);
    const { data: pubCard } = await anon.rpc("get_public_card", { p_token: token });
    check("la tarjeta pública refleja la nueva visita", pubCard?.total_visits === before + 1, pubCard?.total_visits);
  }
  console.log(`  (tarjeta de prueba: /card/${token})`);
}

console.log("\nEtapa 4 · estadísticas, canjes y correcciones");
{
  const { data: biz } = await owner.from("businesses").select("id").eq("slug", "beautyclub").single();
  const bizId = biz!.id as string;
  const { data: st, error } = await owner.rpc("business_stats", { p_business_id: bizId, p_days: 90 });
  check("la propietaria obtiene estadísticas de 90 días", !error && st?.days === 90 && st.daily?.length === 90, error?.message);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + Number(b), 0);
  check("la serie diaria, por día y por hora suman el total", st && sum(st.daily.map((d: { value: number }) => d.value)) === st.visits && sum(st.weekday) === st.visits && sum(st.hourly) === st.visits);
  check("hay visitas y equipo en el ranking", st?.visits > 0 && st.by_staff.length > 0, { visits: st?.visits, staff: st?.by_staff?.length });
  const { error: e1 } = await staff.rpc("business_stats", { p_business_id: bizId, p_days: 30 });
  check("una empleada no ve estadísticas", !!e1 && e1.message.includes("FORBIDDEN"), e1?.message);
  const { error: e2 } = await other.rpc("business_stats", { p_business_id: bizId, p_days: 30 });
  check("otro comercio no ve estadísticas de Beauty Club", !!e2 && e2.message.includes("FORBIDDEN"), e2?.message);

  const { data: aVisit } = await owner.from("visits").select("id, card_id").eq("kind", "visit").limit(1).single();
  const { error: e3 } = await staff.rpc("reverse_visit", { p_visit_id: aVisit!.id, p_reason: "Prueba de permisos" });
  check("una empleada no puede revertir visitas", !!e3 && e3.message.includes("FORBIDDEN"), e3?.message);
  const { error: e4 } = await staff.rpc("set_card_blocked", { p_card_id: aVisit!.card_id, p_blocked: true });
  check("una empleada no puede bloquear tarjetas", !!e4 && e4.message.includes("FORBIDDEN"), e4?.message);
  const { error: e5 } = await other.rpc("reverse_visit", { p_visit_id: aVisit!.id, p_reason: "Prueba de permisos" });
  check("otro comercio no puede revertir visitas de Beauty Club", !!e5 && e5.message.includes("FORBIDDEN"), e5?.message);
  const { error: e6 } = await staff.rpc("log_customers_export", { p_business_id: bizId, p_count: 1 });
  check("una empleada no puede exportar clientes", !!e6 && e6.message.includes("FORBIDDEN"), e6?.message);

  if (process.argv.includes("--e2e")) {
    // Solo sobre "Cliente Verificación": bloqueo temporal y reversión de su última visita.
    const { data: card } = await owner.from("loyalty_cards").select("id, customers!inner(phone_e164)").eq("customers.phone_e164", "+573000000001").single();
    const laura = await as("usr_staff1");
    const { error: b1 } = await owner.rpc("set_card_blocked", { p_card_id: card!.id, p_blocked: true });
    check("la propietaria bloquea la tarjeta de prueba", !b1, b1?.message);
    const { error: b2 } = await laura.rpc("register_visit", { p_card_id: card!.id, p_idempotency_key: `verify-blocked-${Date.now()}` });
    check("una tarjeta bloqueada no admite visitas", !!b2 && b2.message.includes("CARD_BLOCKED"), b2?.message);
    const { error: b3 } = await owner.rpc("set_card_blocked", { p_card_id: card!.id, p_blocked: false });
    check("la propietaria la reactiva", !b3, b3?.message);

    const { data: vs } = await owner.from("visits").select("id, kind, reverses_visit_id").eq("card_id", card!.id).order("created_at", { ascending: false });
    const reversed = new Set((vs ?? []).map((v) => v.reverses_visit_id).filter(Boolean));
    const target = (vs ?? []).find((v) => v.kind === "visit" && !reversed.has(v.id));
    if (target) {
      const { data: rv, error: r1 } = await owner.rpc("reverse_visit", { p_visit_id: target.id, p_reason: "Prueba de verificación (Etapa 4)" });
      check("la propietaria revierte una visita con motivo", !r1 && typeof rv?.current_stamps === "number", r1?.message);
      const { error: r2 } = await owner.rpc("reverse_visit", { p_visit_id: target.id, p_reason: "Prueba de verificación (Etapa 4)" });
      check("no se puede revertir dos veces", !!r2 && r2.message.includes("ALREADY_REVERSED"), r2?.message);
      const { count } = await owner.from("visits").select("*", { count: "exact", head: true }).eq("id", target.id);
      check("la visita original sigue en el historial", count === 1, count);
    } else console.log("  (sin visitas por revertir en la tarjeta de prueba: ejecuta antes --e2e otra vez pasada 1 h)");

    const { error: x1 } = await owner.rpc("log_customers_export", { p_business_id: bizId, p_count: 0 });
    const { data: lastAudit } = await owner.from("audit_logs").select("action").order("created_at", { ascending: false }).limit(1).single();
    check("la exportación queda en la auditoría", !x1 && lastAudit?.action === "customers.exported", x1?.message ?? lastAudit);
  }
}

console.log("\nEtapa 5 · preparación del piloto");
{
  const { data: pub } = await anon.rpc("get_public_business", { p_slug: "beautyclub" });
  check("la ficha pública incluye el bloque del responsable del tratamiento", !!pub && "legal" in pub && "city" in pub, pub && Object.keys(pub));
  const { data: biz } = await owner.from("businesses").select("id, name, category, city, timezone").eq("slug", "beautyclub").single();
  const args = { p_business_id: biz!.id, p_name: biz!.name, p_category: biz!.category, p_city: biz!.city, p_timezone: biz!.timezone,
    p_legal_name: null, p_tax_id: null, p_contact_email: null, p_contact_phone: null, p_address: null };
  const { error: e1 } = await staff.rpc("update_business_settings", args);
  check("una empleada no cambia la configuración", !!e1 && e1.message.includes("FORBIDDEN"), e1?.message);
  const { error: e2 } = await anon.rpc("update_business_settings", args);
  check("anon no cambia la configuración", !!e2, e2?.message);
  const { error: e3 } = await other.rpc("update_business_settings", args);
  check("otro comercio no cambia la configuración de Beauty Club", !!e3 && e3.message.includes("FORBIDDEN"), e3?.message);
}

console.log("\nEtapa 6 · experiencia de la clienta");
{
  const { data: pub } = await anon.rpc("get_public_business", { p_slug: "beautyclub" });
  check("la ficha pública anuncia los sellos de bienvenida", typeof pub?.program?.welcome_stamps === "number", pub?.program);
  if (process.argv.includes("--e2e")) {
    const { error } = await service.rpc("join_program", { p_slug: "beautyclub", p_full_name: "Otra Persona", p_phone_e164: "+573000000001", p_email: null, p_accept_terms: true, p_marketing_consent: false });
    check("un celular inscrito con otro nombre no revela la tarjeta", !!error && error.message.includes("PHONE_REGISTERED"), error?.message);
    const { data } = await service.rpc("join_program", { p_slug: "beautyclub", p_full_name: "cliente verificacion", p_phone_e164: "+573000000001", p_email: null, p_accept_terms: true, p_marketing_consent: false });
    check("el mismo nombre sin tildes ni mayúsculas la recupera", (Array.isArray(data) ? data[0] : data)?.existing === true);
  }
}

console.log("\nEtapa 7 · promociones, cumpleaños y contactos");
{
  const { data: biz } = await owner.from("businesses").select("id").eq("slug", "beautyclub").single();
  const { data: anonPromos, error: ap } = await anon.from("promotions").select("id").limit(1);
  check("anon no lee promociones", !!ap || (anonPromos ?? []).length === 0, ap?.message);
  const { error: sp } = await staff.from("promotions").insert({ business_id: biz!.id, name: "Hack", bonus_stamps: 3, starts_on: "2026-01-01", ends_on: "2026-01-02" });
  check("una empleada no crea promociones", !!sp, sp?.message);
  const { error: op } = await owner.from("promotions").select("id").limit(1);
  check("la propietaria consulta sus promociones", !op, op?.message);
  const { data: cust } = await owner.from("customers").select("id").eq("marketing_consent", true).limit(1).single();
  const { error: sc } = await staff.rpc("log_customer_contact", { p_customer_id: cust!.id, p_segment: "prueba" });
  check("una empleada no registra contactos de campañas", !!sc && sc.message.includes("FORBIDDEN"), sc?.message);
  const { data: contacts, error: cc } = await staff.from("customer_contacts").select("id").limit(1);
  check("una empleada no ve el registro de contactos", !cc && (contacts ?? []).length === 0, cc?.message);
  const { data: card } = await anon.rpc("get_public_card", { p_token: "q7Lm2Xv9RkTz4pWb8NcY3a" });
  check("la tarjeta pública incluye la promoción del día (o null)", card && "promotion" in card, card && Object.keys(card));
  const { error: bd } = await service.rpc("join_program", { p_slug: "beautyclub", p_full_name: "Fecha Imposible", p_phone_e164: "+573000000099", p_email: null, p_accept_terms: true, p_marketing_consent: false, p_birth_month: 2, p_birth_day: 31 });
  check("un cumpleaños imposible se rechaza", !!bd && bd.message.includes("INVALID_BIRTHDAY"), bd?.message);
}

console.log("\nEtapa 8 · planes y sedes");
{
  const { data: plans } = await owner.from("plans").select("id, max_locations");
  check("los planes tienen límite de sedes", plans?.find((p) => p.id === "plan_starter")?.max_locations === 1 && plans?.find((p) => p.id === "plan_pro")?.max_locations === 3, plans);
  const { data: biz } = await owner.from("businesses").select("id").eq("slug", "beautyclub").single();
  const { error: sl } = await staff.from("locations").insert({ business_id: biz!.id, name: "Intrusa" });
  check("una empleada no crea sedes", !!sl, sl?.message);
  const { error: ol } = await other.from("locations").insert({ business_id: biz!.id, name: "Intrusa" });
  check("otro comercio no crea sedes en Beauty Club", !!ol, ol?.message);
  const { error: pl } = await owner.rpc("set_business_plan", { p_business_id: biz!.id, p_plan_id: "plan_business" });
  check("un comercio no cambia su propio plan", !!pl && pl.message.includes("FORBIDDEN"), pl?.message);
  const { data: st } = await owner.rpc("business_stats", { p_business_id: biz!.id, p_days: 30 });
  check("las estadísticas incluyen visitas por sede", Array.isArray(st?.by_location), st && Object.keys(st));
}

console.log("\nEtapa 10 · logotipo en Storage");
{
  // PNG de 1×1 px: basta para probar permisos sin dejar nada visible.
  const png = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")], { type: "image/png" });
  const { data: biz } = await owner.from("businesses").select("id, branding").eq("slug", "beautyclub").single();
  const path = `${biz!.id}/verify-${Date.now()}.png`;
  const { error: su } = await staff.storage.from("brand-assets").upload(path, png, { contentType: "image/png" });
  check("una empleada no sube logos", !!su, su?.message);
  const { error: ou } = await other.storage.from("brand-assets").upload(path, png, { contentType: "image/png" });
  check("otro comercio no sube logos a la carpeta de Beauty Club", !!ou, ou?.message);
  const foreign = `${url}/storage/v1/object/public/brand-assets/00000000-0000-0000-0000-000000000000/x.png`;
  const { error: fu } = await owner.rpc("update_business_profile", { p_business_id: biz!.id, p_name: null, p_category: null, p_city: null, p_timezone: null, p_branding: { logoUrl: foreign } });
  check("no acepta un logo de otra carpeta", !!fu && fu.message.includes("INVALID_BRANDING"), fu?.message);
  if (process.argv.includes("--e2e")) {
    const bucket = owner.storage.from("brand-assets");
    const { error: up } = await bucket.upload(path, png, { contentType: "image/png" });
    check("la propietaria sube un logo a su carpeta", !up, up?.message);
    const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
    const res = await fetch(publicUrl);
    check("el logo se ve sin iniciar sesión", res.ok && res.headers.get("content-type") === "image/png", res.status);
    const previous = biz!.branding?.logoUrl ?? "";
    const { error: sv } = await owner.rpc("update_business_profile", { p_business_id: biz!.id, p_name: null, p_category: null, p_city: null, p_timezone: null, p_branding: { logoUrl: publicUrl } });
    check("la propietaria guarda la URL de su logo", !sv, sv?.message);
    await owner.rpc("update_business_profile", { p_business_id: biz!.id, p_name: null, p_category: null, p_city: null, p_timezone: null, p_branding: { logoUrl: previous } });
    const { error: rm } = await bucket.remove([path]);
    check("la propietaria borra su archivo", !rm, rm?.message);
  }
}

console.log("\nEtapa 12 · avisos en la billetera");
{
  const { data: biz } = await owner.from("businesses").select("id, wallet_notifications").eq("slug", "beautyclub").single();
  check("los ajustes de avisos existen en el comercio", typeof biz?.wallet_notifications?.winbackDays === "number", biz?.wallet_notifications);
  const { error: a1 } = await anon.rpc("wallet_daily_candidates");
  check("la clave pública no llama al proceso diario", !!a1, a1?.message);
  const { error: a2 } = await owner.rpc("wallet_daily_candidates");
  check("tampoco la propietaria desde el panel", !!a2, a2?.message);
  const { data: cands, error: a3 } = await service.rpc("wallet_daily_candidates");
  check("el servidor sí lo llama", !a3 && Array.isArray(cands), a3?.message);
  const current = biz!.wallet_notifications;
  const { error: s1 } = await staff.rpc("update_wallet_settings", { p_business_id: biz!.id, p_settings: current });
  check("una empleada no cambia los avisos", !!s1 && s1.message.includes("FORBIDDEN"), s1?.message);
  const { error: s2 } = await owner.rpc("update_wallet_settings", { p_business_id: biz!.id, p_settings: { ...current, winbackDays: 3 } });
  check("ajustes fuera de rango → rechazados", !!s2 && s2.message.includes("INVALID_WALLET_SETTINGS"), s2?.message);
  const { error: s3 } = await owner.rpc("update_wallet_settings", { p_business_id: biz!.id, p_settings: current });
  check("la propietaria guarda sus ajustes", !s3, s3?.message);
  const { error: c1 } = await other.rpc("queue_wallet_campaign", { p_business_id: biz!.id, p_customer_ids: ["00000000-0000-0000-0000-000000000000"], p_title: "x", p_body: "y" });
  check("otro comercio no envía campañas a Beauty Club", !!c1 && c1.message.includes("FORBIDDEN"), c1?.message);
  const { error: c2 } = await owner.rpc("queue_wallet_campaign", { p_business_id: biz!.id, p_customer_ids: ["00000000-0000-0000-0000-000000000000"], p_title: " ", p_body: "y" });
  check("campaña sin título → rechazada", !!c2 && c2.message.includes("INVALID_WALLET_MESSAGE"), c2?.message);
  const { data: sn } = await staff.from("wallet_notifications").select("id").limit(1);
  check("una empleada no ve el registro de avisos", (sn ?? []).length === 0, sn);
  const { error: ow } = await owner.from("wallet_notifications").insert({ business_id: biz!.id, card_id: biz!.id, kind: "stamp", ref: "visit:x", title: "a", body: "b" });
  check("desde el panel no se escriben avisos a mano", !!ow, ow?.message);
}

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
