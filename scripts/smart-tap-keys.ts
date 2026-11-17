// Genera el par de claves de Smart Tap (ECDSA P-256) para el lector NFC del mostrador.
// - La clave pública se sube a Google Pay & Wallet Console (Toque inteligente → Agregar una clave).
// - La clave privada va SOLO al lector (VTAP100: archivo privateN.pem). Nunca al repositorio ni a Vercel.
// Uso: npm run smart-tap:keys -- ~/lazo-smart-tap [versión]
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const arg = process.argv[2];
const version = Number(process.argv[3] ?? "1");

if (!arg) {
  console.error("Uso: npm run smart-tap:keys -- <carpeta fuera del proyecto> [versión]\nEjemplo: npm run smart-tap:keys -- ~/lazo-smart-tap 1");
  process.exit(1);
}
if (!Number.isInteger(version) || version < 1 || version > 99) {
  console.error("La versión de la clave es un número entre 1 y 99 (la misma que se registra en Google).");
  process.exit(1);
}

const dir = resolve(arg.replace(/^~(?=$|\/)/, homedir()));
if (!relative(repo, dir).startsWith("..")) {
  console.error("Por seguridad, la carpeta debe estar FUERA del proyecto (la clave privada nunca va al repositorio).");
  process.exit(1);
}

const privPath = join(dir, `private${version}.pem`);
const pubPath = join(dir, `public${version}.pem`);
if (existsSync(privPath) || existsSync(pubPath)) {
  console.error(`Ya existe una clave versión ${version} en ${dir}. Usa otra versión o borra esos archivos a propósito.`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(privPath, privateKey.export({ type: "sec1", format: "pem" }), { mode: 0o600 });
writeFileSync(pubPath, publicKey.export({ type: "spki", format: "pem" }), { mode: 0o644 });

console.log(`
Claves de Smart Tap creadas (versión ${version}):
  Pública: ${pubPath}
  Privada: ${privPath}   ← secreta: solo se copia al lector

Siguientes pasos (docs/ETAPA-16-SMART-TAP.md):
  1. Google Pay & Wallet Console → Google Wallet API → Funciones adicionales → Toque inteligente
     → Agregar una clave: pega el contenido de public${version}.pem y la versión ${version}.
     Anota el Collector ID que te muestra Google.
  2. Copia private${version}.pem al lector y en su config.txt pon el Collector ID y la ranura ${version}.
  3. En Vercel: GOOGLE_WALLET_SMART_TAP=1 y vuelve a desplegar.
`);
