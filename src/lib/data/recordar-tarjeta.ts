/**
 * Cookie del servidor con las tarjetas de este celular. Safari borra a los ~7 días lo que guarda la página
 * (localStorage); una cookie puesta por el servidor dura mucho más. Cada visita la renueva.
 * Solo se puede escribir desde Server Actions o Route Handlers.
 */
import { cookies } from "next/headers";
import { agregarTarjeta, COOKIE_TARJETAS, DURACION_COOKIE_SEGUNDOS, escribirTarjetas, leerTarjetas } from "@/lib/domain/recordar";

/**
 * ¿Este navegador tiene la sesión del panel (dueño, empleado o equipo de Lazo)? Ahí no se recuerdan tarjetas:
 * quien atiende inscribe o abre tarjetas de clientes desde su celular, y luego, al probar la etiqueta,
 * se le sumaría el sello a ese cliente y vería su tarjeta.
 */
export async function tieneSesionDelPanel(): Promise<boolean> {
  const c = await cookies();
  return c.getAll().some((k) => /^sb-.+-auth-token(\.\d+)?$/.test(k.name));
}

export async function tarjetasRecordadas(): Promise<string[]> {
  if (await tieneSesionDelPanel()) return [];
  const c = await cookies();
  return leerTarjetas(c.get(COOKIE_TARJETAS)?.value);
}

export async function recordarTarjeta(token: string): Promise<void> {
  if (await tieneSesionDelPanel()) return;
  const c = await cookies();
  const lista = agregarTarjeta(leerTarjetas(c.get(COOKIE_TARJETAS)?.value), token);
  c.set(COOKIE_TARJETAS, escribirTarjetas(lista), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_COOKIE_SEGUNDOS,
  });
}
