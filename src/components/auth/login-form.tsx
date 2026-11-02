"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { sendMagicLink, signInWithPassword, type ActionResult } from "@/lib/data/actions";
import { Button, Field, Input } from "@/components/ui";

function Form() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const linkError = params.get("error") === "link";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction, pwPending] = useActionState<ActionResult | null, FormData>(signInWithPassword, null);
  const [mlState, mlAction, mlPending] = useActionState<ActionResult | null, FormData>(sendMagicLink, null);
  const state = mode === "password" ? pwState : mlState;

  return (
    <form action={mode === "password" ? pwAction : mlAction} className="mt-8 space-y-3">
      <input type="hidden" name="next" value={next} />
      <Field label="Correo">
        <Input name="email" type="email" autoComplete="email" required placeholder="tu@negocio.com" />
      </Field>
      {mode === "password" && (
        <Field label="Contraseña">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
      )}
      {linkError && !state && <p className="text-sm text-danger">El enlace no es válido o ya expiró.</p>}
      {state && <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>}
      <Button className="w-full" disabled={pwPending || mlPending}>
        {mode === "password" ? (pwPending ? "Entrando…" : "Entrar") : mlPending ? "Enviando…" : "Enviarme un enlace"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
        className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
      >
        <Mail className="size-3.5" /> {mode === "password" ? "Entrar con un enlace por correo" : "Entrar con contraseña"}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
