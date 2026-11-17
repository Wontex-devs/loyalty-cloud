// Prueba de humo contra un despliegue (local o en internet). Solo hace lecturas públicas.
// Uso: npm run smoke -- https://tu-dominio.com [slug] [token-de-una-tarjeta]
// Con el token (o SMOKE_CARD_TOKEN) también revisa el pase de Apple Wallet de esa tarjeta.
import { createHash } from "node:crypto";
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const slug = process.argv[3] ?? "beautyclub";
const cardToken = process.argv[4] ?? process.env.SMOKE_CARD_TOKEN ?? "";

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
// Lo público se puede rastrear; las secciones privadas no (robots.txt) y además llevan noindex.
const robots = await (await get("/robots.txt")).text();
const privadas = ["/card", "/join", "/business", "/admin", "/api"];
check("robots.txt deja rastrear la parte pública", /^Allow: \/\s*$/m.test(robots) && !/^Disallow: \/\s*$/m.test(robots), robots);
check("robots.txt bloquea las secciones privadas", privadas.every((p) => new RegExp(`^Disallow: ${p}\\s*$`, "m").test(robots)), robots);
check("robots.txt enlaza el sitemap", /^Sitemap: https?:\/\/\S+\/sitemap\.xml/m.test(robots), robots);
check("las tarjetas llevan noindex", (bad.headers.get("x-robots-tag") ?? "").includes("noindex"), bad.headers.get("x-robots-tag"));
const sitemap = await get("/sitemap.xml");
check("el sitemap responde", sitemap.status === 200, sitemap.status);

// ---------- Apple Wallet ----------
const log = await fetch(base + "/api/apple-wallet/v1/log", { method: "POST", headers: { "content-type": "application/json" }, body: '{"logs":[]}' });
check("el servicio de Apple Wallet responde", log.status === 200, log.status);

/** Lee un ZIP sin compresión (así se arma el .pkpass). */
function unzip(buf: Buffer) {
  const files: Record<string, Buffer> = {};
  let at = 0;
  while (at + 30 <= buf.length && buf.readUInt32LE(at) === 0x04034b50) {
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const name = buf.subarray(at + 30, at + 30 + nameLen).toString("utf8");
    files[name] = buf.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    at += 30 + nameLen + size;
  }
  return files;
}

if (cardToken) {
  const res = await get(`/card/${cardToken}/apple-wallet`);
  const type = res.headers.get("content-type") ?? "";
  check("la tarjeta entrega el pase de Apple Wallet", res.status === 200 && type.includes("application/vnd.apple.pkpass"), { status: res.status, type });
  if (res.status === 200) {
    const files = unzip(Buffer.from(await res.arrayBuffer()));
    const names = Object.keys(files);
    check("el pase trae pass.json, manifest, firma e ícono", ["pass.json", "manifest.json", "signature", "icon.png"].every((n) => names.includes(n)), names);
    let manifest: Record<string, string> = {};
    let pass: { passTypeIdentifier?: string; serialNumber?: string; webServiceURL?: string } = {};
    try {
      manifest = JSON.parse(files["manifest.json"]?.toString() ?? "{}");
      pass = JSON.parse(files["pass.json"]?.toString() ?? "{}");
    } catch {}
    const okHashes = Object.entries(manifest).every(([n, h]) => files[n] && createHash("sha1").update(files[n]).digest("hex") === h);
    check("el manifest coincide con cada archivo (SHA-1)", Object.keys(manifest).length > 0 && okHashes, Object.keys(manifest));
    const sig = files.signature ?? Buffer.alloc(0);
    check("la firma incluye el certificado de Apple (WWDR)", sig.length > 1000 && sig.includes(Buffer.from("Apple Worldwide Developer Relations")), sig.length);
    check("el pase es de esta tarjeta y tiene servicio de actualizaciones", pass.serialNumber === cardToken && !!pass.webServiceURL?.startsWith("https://"), pass);
    if (pass.passTypeIdentifier) {
      const sinToken = await get(`/api/apple-wallet/v1/passes/${pass.passTypeIdentifier}/${cardToken}`);
      check("el servicio de Apple no entrega el pase sin su token", sinToken.status === 401, sinToken.status);
    }
  }
} else {
  console.log("  · (sin token de tarjeta: no se revisa el pase de Apple; pásalo como tercer argumento o SMOKE_CARD_TOKEN)");
}

console.log(`\n${passed} correctas, ${failed} fallidas\n`);
process.exit(failed ? 1 : 0);
