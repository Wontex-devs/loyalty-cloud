// Crea (o reutiliza) el superadministrador de un proyecto nuevo y le envía un enlace
// de acceso por correo. No usa ni guarda contraseñas: la persona define la suya.
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_APP_URL.
// Uso: npm run admin:bootstrap -- tu-correo@dominio.com
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const app = process.env.NEXT_PUBLIC_APP_URL;
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Uso: npm run admin:bootstrap -- tu-correo@dominio.com");
  process.exit(1);
}
if (!url || !key || !app) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_APP_URL en .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
let id = existing?.id as string | undefined;
if (!id) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: `${app}/auth/callback?next=/account/password` });
  if (error || !data.user) {
    console.error(`No se pudo invitar: ${error?.message}`);
    process.exit(1);
  }
  id = data.user.id;
  console.log(`✓ Invitación enviada a ${email}`);
} else console.log(`✓ ${email} ya existía`);

const { error } = await supabase.from("profiles").update({ platform_role: "superadmin" }).eq("id", id);
if (error) {
  console.error(`No se pudo asignar el rol: ${error.message}`);
  process.exit(1);
}
console.log("✓ Rol de superadministrador asignado. Entra con el enlace del correo y crea tu contraseña.");
