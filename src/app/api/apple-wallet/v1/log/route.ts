/** Errores que reporta el iPhone sobre nuestros pases: van al registro del servidor. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { logs?: unknown } | null;
  const logs = Array.isArray(body?.logs) ? body.logs.filter((l): l is string => typeof l === "string").slice(0, 20) : [];
  for (const l of logs) console.warn("[apple-wallet] iPhone:", l.slice(0, 500));
  return new Response(null, { status: 200 });
}
