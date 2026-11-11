import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/data/queries";

/** Enrutador tras iniciar sesión: lleva a cada rol a su panel. */
export default async function StartPage() {
  const session = await getSession();
  redirect(session ? homePathFor(session) : "/login");
}
