import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const PROTECTED = ["/admin", "/business", "/account"];

/**
 * Refresca la sesión de Supabase en cada petición y exige sesión en los paneles.
 * La autorización fina (rol, membresía) se comprueba en los layouts y en RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

/**
 * Solo las rutas que usan la sesión del panel. Antes corría en TODAS: la página de inicio, la tarjeta
 * del cliente, la inscripción y el toque NFC pagaban un arranque extra del servidor sin necesitarlo.
 */
export const config = {
  matcher: ["/admin/:path*", "/business/:path*", "/account/:path*", "/login", "/start", "/auth/:path*"],
};
