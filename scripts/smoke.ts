// Prueba de humo contra un despliegue (local o en internet). Solo hace lecturas públicas.
// Uso: npm run smoke -- https://tu-dominio.com [slug]
export {};
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const slug = process.argv[3] ?? "beautyclub";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
};
const get = (path: string) => fetch(base + path, { redirect: "manual" });

console.log(`\nPrueba de humo · ${base}`);
const login = await get("/login");
check("/login responde 200", login.status === 200, login.status);
for (const h of ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "content-security-policy"]) {
  check(`cabecera ${h}`, !!login.headers.get(h));
}
check("no expone la tecnología del servidor (x-powered-by)", !login.headers.get("x-powered-by"));
if (base.startsWith("https://")) check("HSTS activo", !!login.headers.get("strict-transport-security"));

const panel = await get(`/business/${slug}`);
check("el panel exige sesión (redirige a /login)", [302, 303, 307, 308].includes(panel.status) && (panel.headers.get("location") ?? "").includes("/login"), panel.status);
const admin = await get("/admin");
check("/admin exige sesión", [302, 303, 307, 308].includes(admin.status), admin.status);

const join = await get(`/join/${slug}`);
const joinHtml = await join.text();
check(`/join/${slug} muestra el formulario`, join.status === 200 && joinHtml.includes("términos"), join.status);
const terms = await get(`/join/${slug}/terminos`);
const termsHtml = await terms.text();
check("la política de datos es pública", terms.status === 200 && termsHtml.includes("Responsable del tratamiento"), terms.status);
check("la política tiene los datos del responsable", !termsHtml.includes("aún no ha completado"), "faltan razón social, NIT o correo en Configuración");
const poster = await get(`/join/${slug}/poster`);
check("el cartel imprimible carga", poster.status === 200, poster.status);

const bad = await get("/card/token-que-no-existe-12345");
check("una tarjeta inexistente no revela nada", bad.status === 200 && (await bad.text()).includes("no encontrada"), bad.status);
const robots = await (await get("/robots.txt")).text();
check("robots.txt bloquea la indexación", /Disallow: \/\s*$/m.test(robots), robots);

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
