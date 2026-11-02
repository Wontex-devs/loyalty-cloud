import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <p className="text-lg font-semibold">Página no encontrada</p>
        <p className="mt-1 text-sm text-muted">Revisa el enlace o pide ayuda en el establecimiento.</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-medium underline">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
