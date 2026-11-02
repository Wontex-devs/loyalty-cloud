// Une todas las migraciones en un único archivo para un proyecto Supabase nuevo
// (p. ej. el de producción del piloto). Se pega entero en el editor SQL.
// Uso: npm run db:bundle  →  supabase/setup.sql
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const body = files.map((f) => `-- >>> ${f}\n${readFileSync(join(dir, f), "utf8").trim()}\n`).join("\n");
const out = `-- Generado por npm run db:bundle. No editar: cambia las migraciones y vuelve a generarlo.\n-- Incluye: ${files.join(", ")}\nbegin;\n\n${body}\ncommit;\n`;
writeFileSync(join(root, "supabase/setup.sql"), out);
console.log(`supabase/setup.sql · ${files.length} migraciones · sha256 ${createHash("sha256").update(out).digest("hex").slice(0, 16)}…`);
