"use client";

import { useDemo } from "@/lib/demo/store";
import { PLATFORM_NAME } from "@/lib/config";
import type { BusinessBranding, BusinessLegal } from "@/lib/domain/types";
import { JoinUnavailable } from "./join-form";
import { BrandMark } from "@/components/loyalty/brand-mark";

export interface LegalData {
  slug: string;
  name: string;
  city: string;
  branding: BusinessBranding;
  legal: BusinessLegal;
  program: { name: string; stampsRequired: number; rewardName: string; terms: string; rewardExpiryDays?: number | null };
}

/**
 * Términos del programa y política de tratamiento de datos (Ley 1581 de 2012 y
 * Decreto 1377 de 2013). Es una plantilla que se completa con los datos del
 * comercio; cada comercio debe revisarla con su asesor antes de publicarla.
 */
export function LegalScreen({ data }: { data: LegalData }) {
  const { legal, program } = data;
  const holder = legal.legalName || data.name;
  const missing = !legal.legalName || !legal.taxId || !legal.contactEmail;
  const contact = [legal.contactEmail, legal.contactPhone].filter(Boolean).join(" · ") || "el establecimiento";

  return (
    <div className="min-h-dvh bg-[#f6f6f6] px-4 py-8">
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-[15px] leading-relaxed text-ink-2 shadow-card sm:p-10">
        <header className="mb-8 flex items-center gap-3">
          <BrandMark branding={data.branding} className="size-11 rounded-full font-serif" style={{ background: data.branding.cardBackground, color: data.branding.cardForeground }} />
          <div>
            <h1 className="text-lg font-semibold text-ink">{program.name}</h1>
            <p className="text-sm text-muted">Términos del programa y tratamiento de datos personales</p>
          </div>
        </header>

        {missing && (
          <p className="mb-6 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
            El establecimiento aún no ha completado sus datos de responsable del tratamiento (razón social, NIT y correo de contacto).
          </p>
        )}

        <h2 className="mb-2 font-semibold text-ink">1. Términos del programa</h2>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li>
            Cada visita registrada por el personal de {data.name} suma un sello. Al completar {program.stampsRequired} sellos obtienes: {program.rewardName}.
          </li>
          <li>La tarjeta es personal, gratuita y no se puede canjear por dinero.</li>
          {program.rewardExpiryDays ? <li>Las recompensas vencen {program.rewardExpiryDays} días después de obtenerlas.</li> : null}
          <li>El establecimiento puede corregir visitas registradas por error y bloquear tarjetas en caso de uso indebido.</li>
        </ul>
        {program.terms && <p className="mb-6 text-sm text-muted">{program.terms}</p>}

        <h2 className="mt-8 mb-2 font-semibold text-ink">2. Responsable del tratamiento</h2>
        <p>
          <strong className="text-ink">{holder}</strong>
          {legal.taxId && <>, identificado con NIT/C.C. {legal.taxId}</>}
          {legal.address ? <>, con domicilio en {legal.address}</> : data.city ? <>, en {data.city}</> : null}.
          {(legal.contactEmail || legal.contactPhone) && <> Contacto: {contact}.</>}
        </p>

        <h2 className="mt-8 mb-2 font-semibold text-ink">3. Datos que tratamos</h2>
        <p>
          Nombre, número de celular, correo electrónico (opcional), día y mes de cumpleaños (opcional, sin año) y el historial de visitas, recompensas y canjes de tu
          tarjeta.
        </p>

        <h2 className="mt-8 mb-2 font-semibold text-ink">4. Para qué los usamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Crear y administrar tu tarjeta de fidelización, registrar tus visitas y entregarte tus recompensas.</li>
          <li>Identificarte en caja y evitar registros duplicados o fraudulentos.</li>
          <li>Si nos diste tu cumpleaños: entregarte un regalo en tu mes de cumpleaños.</li>
          <li>Elaborar estadísticas internas del establecimiento.</li>
          <li>
            Solo si lo autorizaste por separado: enviarte promociones y novedades por WhatsApp. Cada mensaje lo envía una persona del equipo, nunca de forma masiva,
            y puedes retirar esa autorización en cualquier momento.
          </li>
        </ul>

        <h2 className="mt-8 mb-2 font-semibold text-ink">5. Tus derechos</h2>
        <p>
          Puedes conocer, actualizar y rectificar tus datos, pedir prueba de tu autorización, saber cómo se han usado, revocar la autorización o pedir su supresión
          cuando no exista un deber legal de conservarlos, y presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a {contact}. Respondemos
          consultas en un máximo de 10 días hábiles y reclamos en un máximo de 15 días hábiles.
        </p>

        <h2 className="mt-8 mb-2 font-semibold text-ink">6. Encargado y ubicación de los datos</h2>
        <p>
          La plataforma {PLATFORM_NAME} actúa como encargada del tratamiento: aloja la información por cuenta de {holder} y no la usa para fines propios. Los datos se
          almacenan en servidores de proveedores de nube que pueden estar fuera de Colombia, con medidas de seguridad como cifrado en tránsito y control de acceso por
          establecimiento. Al aceptar, autorizas esta transmisión.
        </p>

        <h2 className="mt-8 mb-2 font-semibold text-ink">7. Vigencia</h2>
        <p>Conservamos tus datos mientras tu tarjeta esté activa y por el tiempo necesario para cumplir obligaciones legales. Esta política rige desde su publicación.</p>

        <p className="mt-10 border-t border-line pt-4 text-xs text-subtle">
          {data.name} · Tecnología de {PLATFORM_NAME}
        </p>
      </article>
    </div>
  );
}

export function DemoLegal({ slug }: { slug: string }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <div className="min-h-dvh bg-[#f6f6f6]" />;
  const business = state.businesses.find((b) => b.slug === slug);
  const program = state.programs.find((p) => p.businessId === business?.id && p.active);
  if (!business || !program) return <JoinUnavailable />;
  return <LegalScreen data={{ slug, name: business.name, city: business.city, branding: business.branding, legal: business.legal ?? {}, program }} />;
}
