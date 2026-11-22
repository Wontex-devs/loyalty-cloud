"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Stamp } from "lucide-react";
import { demoSelloAction } from "@/lib/data/demo-actions";
import { SALES_WHATSAPP } from "@/lib/config";

/**
 * Demo para vender: en las tarjetas del comercio demo, el visitante se suma un sello de prueba él mismo
 * y ve llegar el sello (y el aviso, si guardó la tarjeta en su billetera).
 */
export function DemoSello({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sumar = async () => {
    setBusy(true);
    setMsg(null);
    const r = await demoSelloAction(token, `demo-${crypto.randomUUID()}`).catch(() => ({ ok: false as const, message: "No hay conexión. Inténtalo de nuevo." }));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({
      ok: true,
      text: r.premio
        ? "¡Completaste la tarjeta! Así le llega el premio a tu cliente."
        : "¡Sello sumado! Si guardaste la tarjeta en tu billetera, mira el aviso en tu celular.",
    });
    router.refresh();
  };

  const whatsapp = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent("Hola, probé la demo de Lazo y quiero la tarjeta para mi negocio.")}`;

  return (
    // Con los colores de Lazo (no los del comercio): siempre con buen contraste.
    <div className="mt-4 rounded-2xl border-2 border-dashed border-cobalt/30 bg-white p-4 text-sm shadow-card">
      <p className="font-semibold">Estás probando la demo de Lazo</p>
      <p className="mt-0.5 text-muted">
        En tu negocio, el sello lo pone tu equipo al escanear la tarjeta o el cliente al acercar el celular. Aquí te lo sumas tú para ver cómo se siente.
      </p>
      <button
        type="button"
        onClick={sumar}
        disabled={busy}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cobalt font-semibold text-white shadow-pop disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />} Sumar un sello de prueba
      </button>
      {msg && <p className={msg.ok ? "mt-2 text-success" : "mt-2 text-danger"}>{msg.text}</p>}
      <a href={whatsapp} target="_blank" rel="noopener" className="mt-3 flex items-center justify-center gap-1.5 font-medium text-cobalt hover:underline">
        <MessageCircle className="size-4" /> Quiero esto para mi negocio
      </a>
    </div>
  );
}
