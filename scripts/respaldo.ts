// Copia de seguridad de la base de datos en ESTE computador (el plan gratis de Supabase no hace copias).
// Guarda cada tabla en un archivo JSON, la lista de cuentas (sin contraseñas) y los archivos subidos
// (logos, fotos, ilustraciones). Solo LEE la base de datos: no cambia nada.
//
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (no se muestran).
// Uso:
//   npm run respaldo                       → guarda en C:\Respaldos-Lazo\<fecha>
//   npm run respaldo -- D:\MisRespaldos    → guarda en esa carpeta
//   npm run respaldo -- --conteo           → solo cuenta filas por tabla, no guarda nada
//
// OJO (Ley 1581): la copia tiene datos personales de los clientes de cada negocio.
// Guárdela en una carpeta local que no se sincronice con OneDrive, Google Drive ni similares,
// y nunca la suba a Git ni la envíe por correo o chat.
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

// Todas las tablas del esquema público (las de src/../supabase/migrations). Si se agrega una tabla, se agrega aquí.
const TABLAS = [
  "plans",
  "businesses",
  "business_billing",
  "business_payments",
  "profiles",
  "business_memberships",
  "locations",
  "loyalty_programs",
  "customers",
  "loyalty_cards",
  "visits",
  "rewards",
  "redemptions",
  "promotions",
  "campaigns",
  "customer_contacts",
  "wallet_notifications",
  "apple_wallet_registrations",
  "support_sessions",
  "login_events",
  "audit_logs",
];

const soloConteo = process.argv.includes("--conteo");
const argCarpeta = process.argv.slice(2).find((a) => !a.startsWith("--"));
const sello = new Date().toISOString().slice(0, 16).replace(/[T:]/g, (c) => (c === "T" ? "_" : ""));
const carpeta = resolve(argCarpeta ?? join("C:\\Respaldos-Lazo", sello));

if (!soloConteo) {
  const repo = resolve(".");
  if (carpeta.toLowerCase().startsWith(repo.toLowerCase())) {
    console.error("No guarde la copia dentro del proyecto: podría terminar en Git. Elija otra carpeta.");
    process.exit(1);
  }
  if (/onedrive|google ?drive|dropbox|icloud/i.test(carpeta)) {
    console.error("Esa carpeta se sincroniza con la nube. Elija una carpeta local (por ejemplo C:\\Respaldos-Lazo).");
    process.exit(1);
  }
  mkdirSync(carpeta, { recursive: true });
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const resumen: Record<string, number | string> = {};
let fallas = 0;

for (const tabla of TABLAS) {
  const filas: unknown[] = [];
  let error: string | null = null;
  for (let desde = 0; ; desde += 1000) {
    const r = await supabase.from(tabla).select("*").range(desde, desde + 999);
    if (r.error) {
      error = r.error.message;
      break;
    }
    filas.push(...(r.data ?? []));
    if (!r.data || r.data.length < 1000) break;
  }
  if (error) {
    fallas++;
    resumen[tabla] = `ERROR: ${error}`;
    console.log(`  ✗ ${tabla}: ${error}`);
    continue;
  }
  resumen[tabla] = filas.length;
  if (!soloConteo) writeFileSync(join(carpeta, `${tabla}.json`), JSON.stringify(filas, null, 1));
  console.log(`  ✓ ${tabla}: ${filas.length}`);
}

// Cuentas del panel (sin contraseñas: Supabase no las entrega).
const cuentas: unknown[] = [];
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    fallas++;
    resumen.cuentas = `ERROR: ${error.message}`;
    break;
  }
  cuentas.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at })));
  if (data.users.length < 1000) break;
}
if (typeof resumen.cuentas !== "string") {
  resumen.cuentas = cuentas.length;
  if (!soloConteo) writeFileSync(join(carpeta, "cuentas.json"), JSON.stringify(cuentas, null, 1));
  console.log(`  ✓ cuentas del panel: ${cuentas.length}`);
}

// Archivos subidos (logos, fotos de tarjeta, ilustraciones).
let archivos = 0;
const { data: buckets } = await supabase.storage.listBuckets();
async function bajar(bucket: string, prefijo: string) {
  const { data } = await supabase.storage.from(bucket).list(prefijo, { limit: 1000 });
  for (const o of data ?? []) {
    const ruta = prefijo ? `${prefijo}/${o.name}` : o.name;
    if (!o.id) {
      await bajar(bucket, ruta); // es una carpeta
      continue;
    }
    archivos++;
    if (soloConteo) continue;
    const { data: blob } = await supabase.storage.from(bucket).download(ruta);
    if (!blob) continue;
    const destino = join(carpeta, "archivos", bucket, ...ruta.split("/"));
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, Buffer.from(await blob.arrayBuffer()));
  }
}
for (const b of buckets ?? []) await bajar(b.name, "");
resumen.archivos = archivos;
console.log(`  ✓ archivos subidos: ${archivos}`);

if (!soloConteo) {
  writeFileSync(
    join(carpeta, "LEAME.txt"),
    [
      `Copia de seguridad de Lazo — ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}`,
      "",
      "Contiene datos personales (Ley 1581): no la suba a la nube ni la comparta.",
      "No incluye contraseñas ni los secretos de las etiquetas NFC (se pueden generar de nuevo desde el panel).",
      "",
      JSON.stringify(resumen, null, 2),
    ].join("\n"),
  );
  console.log(`\nCopia guardada en: ${carpeta}`);
}
if (fallas) {
  console.error(`\n${fallas} parte(s) fallaron. Revise los mensajes de arriba.`);
  process.exit(1);
}
