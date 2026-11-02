"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";

/**
 * Lector de QR con la cámara trasera. Decodifica con jsQR sobre un canvas, así
 * funciona también en Safari/iOS (que no tiene BarcodeDetector).
 * Requiere HTTPS o localhost para acceder a la cámara.
 */
export function QrScanner({ onResult, paused }: { onResult: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let stopped = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Usa la búsqueda por nombre o teléfono.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en la configuración del navegador."
            : "No se pudo abrir la cámara. Usa la búsqueda por nombre o teléfono.",
        );
        return;
      }
      if (stopped || !videoRef.current) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => {});
      setError(null);

      const scan = (t: number) => {
        raf = requestAnimationFrame(scan);
        if (t - last < 120 || video.readyState < 2) return; // ~8 lecturas por segundo
        last = t;
        const canvas = canvasRef.current!;
        const w = video.videoWidth;
        const h = video.videoHeight;
        // Solo el cuadrado central: más rápido y evita leer códigos ajenos al encuadre.
        const size = Math.min(w, h) * 0.8;
        canvas.width = canvas.height = 480;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(video, (w - size) / 2, (h - size) / 2, size, size, 0, 0, 480, 480);
        const img = ctx.getImageData(0, 0, 480, 480);
        const code = jsQR(img.data, 480, 480, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          navigator.vibrate?.(60);
          onResultRef.current(code.data);
        }
      };
      raf = requestAnimationFrame(scan);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [paused]);

  return (
    <div className="absolute inset-0">
      <video ref={videoRef} className="size-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#111] p-6 text-center text-sm text-white/80">
          <CameraOff className="size-6 text-white/60" />
          {error}
        </div>
      )}
    </div>
  );
}
