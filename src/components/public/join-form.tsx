"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Stamp } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { joinSchema } from "@/lib/domain/schemas";
import { joinProgramAction } from "@/lib/data/loyalty-actions";
import { PLATFORM_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { BusinessBranding } from "@/lib/domain/types";
import { NotFoundScreen } from "./card-screen";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "./turnstile";
import { BrandMark, brandFont } from "@/components/loyalty/brand-mark";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

interface JoinFormProps {
  slug: string;
  business: { name: string; branding: BusinessBranding };
  program: { description: string; stampsRequired: number; rewardName: string; welcomeStamps?: number };
  /** true con Supabase configurado; la página pública no tiene LiveProvider. */
  live?: boolean;
}

/** Página de inscripción (QR general del comercio). En live llama a joinProgramAction. */
export function JoinForm({ slug, business, program, live }: JoinFormProps) {
  const router = useRouter();
  const { state, joinProgram } = useDemo();

  const [form, setForm] = useState({ fullName: "", phone: "", email: "", acceptTerms: false, marketingConsent: false });
  const [birth, setBirth] = useState({ day: "", month: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState("");
  const captchaRef = useRef<TurnstileHandle>(null);
  const needsCaptcha = live && !!TURNSTILE_SITE_KEY;

  const b = business.branding;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!!birth.day !== !!birth.month) {
      setErrors({ birth: "Elige el día y el mes, o deja ambos vacíos." });
      return;
    }
    const parsed = joinSchema.safeParse({
      ...form,
      ...(birth.day ? { birthDay: Number(birth.day), birthMonth: Number(birth.month) } : {}),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    if (needsCaptcha && !captcha) {
      setNotice("Estamos verificando la conexión. Espera un segundo y vuelve a intentarlo.");
      return;
    }
    setSubmitting(true);
    const demoBusinessId = state.businesses.find((x) => x.slug === slug)?.id ?? "";
    const res = live ? await joinProgramAction(slug, parsed.data, captcha || undefined) : await joinProgram(demoBusinessId, parsed.data);
    if (!res.ok) {
      setNotice(res.message);
      setSubmitting(false);
      captchaRef.current?.reset(); // el token es de un solo uso
      return;
    }
    if (res.existing) {
      setNotice("Ya tienes una tarjeta con este número. Te llevamos a ella…");
      setTimeout(() => router.push(`/card/${res.token}`), 1200);
    } else {
      router.push(`/card/${res.token}?new=1`);
    }
  };

  const input = "h-12 w-full rounded-xl border bg-white/80 px-4 text-[15px] outline-none transition placeholder:opacity-50 focus:bg-white";

  return (
    <div className="min-h-dvh" style={{ background: b.cardBackground, color: b.cardForeground }}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-10 pb-8">
        <header className="text-center">
          <BrandMark branding={b} className={`mx-auto size-16 rounded-full text-2xl ${brandFont(b)}`} style={{ background: b.cardForeground, color: b.cardBackground }} />
          <p className={cn("mt-4 text-3xl uppercase", brandFont(b, "tracking-[0.14em]"))}>{business.name}</p>
          <p className="mt-2 text-sm opacity-70">{program.description}</p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-white/50 p-3.5">
            <Stamp className="size-4 opacity-70" />
            <p className="mt-2 font-semibold">{program.stampsRequired} visitas</p>
            <p className="text-xs opacity-65">
              {program.welcomeStamps ? `¡${program.welcomeStamps} ${program.welcomeStamps === 1 ? "sello" : "sellos"} de regalo al inscribirte!` : "1 sello por visita"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/50 p-3.5">
            <Gift className="size-4 opacity-70" />
            <p className="mt-2 font-semibold">{program.rewardName}</p>
            <p className="text-xs opacity-65">al completar tu tarjeta</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3 rounded-3xl bg-white/60 p-5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.25)] backdrop-blur" noValidate>
          <p className="text-base font-semibold">Crea tu tarjeta digital</p>
          <p className="-mt-2 text-xs opacity-60">Sin descargar aplicaciones ni crear contraseñas. ¿Ya tienes tarjeta? Escribe el mismo nombre y celular y la recuperas.</p>

          {(
            [
              ["fullName", "Nombre y apellido", "text", "name"],
              ["phone", "Número de celular", "tel", "tel"],
              ["email", "Correo electrónico (opcional)", "email", "email"],
            ] as const
          ).map(([k, ph, type, ac]) => (
            <div key={k}>
              <input
                type={type}
                autoComplete={ac}
                inputMode={type === "tel" ? "tel" : undefined}
                placeholder={ph}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className={cn(input, errors[k] ? "border-red-400" : "border-black/10")}
                style={{ color: b.cardForeground }}
              />
              {errors[k] && <p className="mt-1 pl-1 text-xs text-red-700">{errors[k]}</p>}
            </div>
          ))}

          <div>
            <p className="mb-1 pl-1 text-xs opacity-70">Tu cumpleaños (opcional, para darte un regalo)</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Día de cumpleaños"
                value={birth.day}
                onChange={(e) => setBirth({ ...birth, day: e.target.value })}
                className={cn(input, "border-black/10")}
                style={{ color: b.cardForeground }}
              >
                <option value="">Día</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                aria-label="Mes de cumpleaños"
                value={birth.month}
                onChange={(e) => setBirth({ ...birth, month: e.target.value })}
                className={cn(input, "border-black/10")}
                style={{ color: b.cardForeground }}
              >
                <option value="">Mes</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {errors.birth && <p className="mt-1 pl-1 text-xs text-red-700">{errors.birth}</p>}
          </div>

          <label className="flex items-start gap-3 pt-1 text-[13px] leading-snug">
            <input type="checkbox" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} className="mt-0.5 size-4 shrink-0" style={{ accentColor: b.cardForeground }} />
            <span>
              Acepto los{" "}
              <a href={`/join/${slug}/terminos`} target="_blank" rel="noopener" className="underline">
                términos del programa y la política de tratamiento de datos personales
              </a>{" "}
              de {business.name}.
            </span>
          </label>
          {errors.acceptTerms && <p className="-mt-1 pl-7 text-xs text-red-700">{errors.acceptTerms}</p>}

          <label className="flex items-start gap-3 text-[13px] leading-snug opacity-85">
            <input type="checkbox" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} className="mt-0.5 size-4 shrink-0" style={{ accentColor: b.cardForeground }} />
            <span>Quiero recibir promociones y novedades (opcional).</span>
          </label>

          {live && <Turnstile ref={captchaRef} onToken={setCaptcha} />}
          {notice && <p className="rounded-xl bg-white/80 px-3 py-2 text-sm">{notice}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-60"
            style={{ background: b.cardForeground, color: b.cardBackground }}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />} Obtener mi tarjeta
          </button>
        </form>

        <p className="mt-auto pt-8 text-center text-[11px] opacity-50">Tecnología de {PLATFORM_NAME}</p>
      </div>
    </div>
  );
}

export function JoinUnavailable() {
  return <NotFoundScreen title="Programa no disponible" text="Este enlace de inscripción no está activo en este momento." />;
}
