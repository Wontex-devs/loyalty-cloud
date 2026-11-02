"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui";

/** Las personas invitadas llegan aquí desde el correo para definir su contraseña. */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError("Usa al menos 10 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) return setError("No se pudo guardar la contraseña. Pide una nueva invitación.");
    router.push("/start");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-6">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-line bg-surface">
            <KeyRound className="size-5 text-muted" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Crea tu contraseña</h1>
          <p className="mt-1 text-sm text-muted">La usarás para entrar al panel de tu negocio.</p>
        </div>
        <Field label="Nueva contraseña">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repite la contraseña" error={error ?? undefined}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </div>
  );
}
