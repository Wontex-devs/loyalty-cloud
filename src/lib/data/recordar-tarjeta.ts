/**
 * Cookie del servidor con las tarjetas de este celular. Safari borra a los ~7 días lo que guarda la página
 * (localStorage); una cookie puesta por el servidor dura mucho más. Cada visita la renueva.
 * Solo se puede escribir desde Server Actions o Route Handlers.
 */
import { cookies } from "next/headers";
import { agregarTarjeta, COOKIE_TARJETAS, DURACION_COOKIE_SEGUNDOS, escribirTarjetas, leerTarjetas } from "@/lib/domain/recordar";

export async function tarjetasRecordadas(): Promise<string[]> {
  const c = await cookies();
  return leerTarjetas(c.get(COOKIE_TARJETAS)?.value);
}

export async function recordarTarjeta(token: string): Promise<void> {
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
