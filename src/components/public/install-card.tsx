"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "install-card-dismissed";

/**
 * Invita a instalar la tarjeta como app. Android/Chrome: botón nativo.
 * iPhone (Safari no tiene botón): instrucciones de "Compartir → Añadir a pantalla de inicio".
 * No aparece si ya está instalada o si el cliente lo cerró.
 */
export function InstallCard({ color }: { color: string }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (event) {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") setHidden(true);
      setEvent(null);
    } else setHelp(true);
  };

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <Download className="size-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Tenla siempre a mano</p>
          <p className="text-muted">Instálala en tu celular y ábrela como una app, sin buscar el enlace.</p>
        </div>
        <button onClick={dismiss} aria-label="Cerrar" className="text-subtle">
          <X className="size-4" />
        </button>
      </div>
      {help && ios ? (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-[#f6f6f6] p-3 text-[13px]">
          <li className="flex items-center gap-1.5">
            1. Toca <Share className="size-4" /> <strong>Compartir</strong> en la barra de Safari.
          </li>
          <li>
            2. Elige <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>
            3. Pulsa <strong>Añadir</strong>.
          </li>
        </ol>
      ) : (
        <button onClick={install} className="mt-3 h-10 w-full rounded-xl text-sm font-medium text-white" style={{ background: color }}>
          {ios ? "Cómo añadirla a mi pantalla de inicio" : "Instalar en mi celular"}
        </button>
      )}
    </div>
  );
}
