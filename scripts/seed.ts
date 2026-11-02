// Carga los datos de demostración de Beauty Club en un proyecto Supabase.
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// Uso: npm run db:seed   (idempotente: puede ejecutarse varias veces)
//
// Crea los usuarios de demostración con contraseñas aleatorias y las guarda en
// .seed-credentials.local.json (ignorado por Git). SEED_SUPERADMIN_EMAIL permite
// usar tu propio correo para el superadministrador.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildSeed, demoUsers, SEED_ORDER } from "./seed-data.ts";

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const CREDENTIALS_FILE = ".seed-credentials.local.json";
const saved: Record<string, { email: string; password: string }> = existsSync(CREDENTIALS_FILE)
  ? JSON.parse(readFileSync(CREDENTIALS_FILE, "utf8"))
  : {};

// 1. Usuarios de Auth (el trigger crea su fila en profiles)
const profileIds: Record<string, string> = {};
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const u of demoUsers) {
  const email = u.superadmin && process.env.SEED_SUPERADMIN_EMAIL ? process.env.SEED_SUPERADMIN_EMAIL : u.email;
  const existing = list.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    profileIds[u.demoId] = existing.id;
    continue;
  }
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.fullName },
  });
  if (error) throw error;
  profileIds[u.demoId] = data.user.id;
  saved[u.demoId] = { email, password };
  console.log(`  usuario creado: ${email}`);
}
writeFileSync(CREDENTIALS_FILE, JSON.stringify(saved, null, 2));

const superId = profileIds[demoUsers.find((u) => u.superadmin)!.demoId];
{
  const { error } = await supabase.from("profiles").update({ platform_role: "superadmin" }).eq("id", superId);
  if (error) throw error;
}

// 2. Datos operativos (service_role omite RLS; los triggers y restricciones sí se aplican)
const rows = buildSeed(profileIds);
for (const table of SEED_ORDER) {
  const data: Record<string, unknown>[] = rows[table];
  for (let i = 0; i < data.length; i += 500) {
    const { error } = await supabase.from(table).upsert(data.slice(i, i + 500), { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error(`Error en ${table}:`, error.message);
      process.exit(1);
    }
  }
  console.log(`  ${table}: ${data.length}`);
}

console.log(`\nListo. Credenciales de los usuarios nuevos en ${CREDENTIALS_FILE}`);
