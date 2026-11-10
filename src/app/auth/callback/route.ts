import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email", "email_change"];

const destinoSeguro = (valor: string | null) => (valor && valor.startsWith("/") && !valor.startsWith("//") ? valor : "/start");
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/**
 * Retorno de enlaces de correo (magic link, invitación, recuperación).
 *
 * Los enlaces con `token_hash` sirven una sola vez. Los programas de seguridad del correo (Outlook, Gmail) abren los enlaces
 * antes que la persona y los gastaban: llegaba «enlace vencido». Por eso aquí NO se consume el token al abrir el enlace:
 * se muestra un botón «Continuar» y solo al pulsarlo (POST) se valida. Esos programas no pulsan botones.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = destinoSeguro(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL(error ? "/login?error=link" : next, url.origin));
  }

  if (!tokenHash || !type || !TIPOS.includes(type)) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Continuar · Lazo</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#eef1fd;font-family:Arial,Helvetica,sans-serif;color:#0e1a52">
  <form method="post" action="/auth/callback" style="max-width:420px;width:100%;margin:16px;background:#fff;border-radius:16px;padding:32px;text-align:center">
    <p style="margin:0 0 18px;font-size:26px;font-weight:bold;color:#1b3fd8">Lazo<span style="color:#ffc928">.</span></p>
    <h1 style="margin:0 0 10px;font-size:22px">Un paso más</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5">Pulsa el botón para continuar de forma segura.</p>
    <input type="hidden" name="token_hash" value="${escapar(tokenHash)}">
    <input type="hidden" name="type" value="${escapar(type)}">
    <input type="hidden" name="next" value="${escapar(next)}">
    <button type="submit" style="background:#ffc928;color:#0e1a52;font-size:16px;font-weight:bold;border:0;padding:15px 28px;border-radius:10px;cursor:pointer">Continuar</button>
  </form>
</body>
</html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

/** Valida el token cuando la persona pulsa «Continuar». */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  const next = destinoSeguro(String(form.get("next") ?? ""));
  const origen = request.nextUrl.origin;

  if (!tokenHash || !TIPOS.includes(type)) return NextResponse.redirect(new URL("/login?error=link", origen), 303);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  return NextResponse.redirect(new URL(error ? "/login?error=link" : next, origen), 303);
}
