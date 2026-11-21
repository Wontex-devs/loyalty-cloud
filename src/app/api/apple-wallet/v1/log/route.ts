import { rateLimit } from "@/lib/data/rate-limit";

/** Deja solo texto imprimible en una línea: sin saltos de línea ni caracteres de control. */
function enUnaLinea(texto: string) {
  let salida = "";
  for (const c of texto) {
    const codigo = c.codePointAt(0) ?? 0;
    salida += codigo < 32 || codigo === 127 ? " " : c;
  }
  return salida;
}

/**
 * Errores que reporta el iPhone sobre nuestros pases: van al registro del servidor.
 * Apple no manda credenciales a esta dirección, así que cualquiera puede llamarla: se limita cuánto
 * acepta (tamaño, cantidad y frecuencia por conexión) y se quitan los saltos de línea, para que nadie
 * pueda llenar el registro ni escribir líneas falsas en él.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`apple-log:${ip}`, 20, 10 * 60_000)) return new Response(null, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > 20_000) return new Response(null, { status: 413 });
  const texto = (await req.text().catch(() => "")).slice(0, 20_000);
  let body: { logs?: unknown } | null = null;
  try {
    body = JSON.parse(texto) as { logs?: unknown };
  } catch {
    body = null;
  }
  const logs = Array.isArray(body?.logs) ? body.logs.filter((l): l is string => typeof l === "string").slice(0, 10) : [];
  for (const l of logs) console.warn("[apple-wallet] iPhone:", enUnaLinea(l.slice(0, 300)));
  return new Response(null, { status: 200 });
}
