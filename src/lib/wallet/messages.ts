/**
 * Textos de los avisos en la billetera. Los usan el servidor (Google Wallet hoy,
 * Apple Wallet después) y el panel, para que se vean iguales en todas partes.
 */
import type { WalletNoticeKind, WalletSettings } from "../domain/types.ts";

export const DEFAULT_WALLET_SETTINGS: WalletSettings = {
  stamp: true,
  near: true,
  reward: true,
  birthday: true,
  winback: true,
  winbackDays: 45,
};

export const WALLET_NOTICE_LABELS: Record<WalletNoticeKind, string> = {
  stamp: "Sello nuevo",
  near: "Te falta 1",
  reward: "Premio listo",
  birthday: "Cumpleaños",
  winback: "Te extrañamos",
  campaign: "Campaña",
};

export interface Notice {
  kind: WalletNoticeKind;
  title: string;
  body: string;
}

/** Normaliza lo que venga de la base de datos o del navegador. */
export function walletSettings(raw: unknown): WalletSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<WalletSettings>;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const days = Number(s.winbackDays);
  return {
    stamp: bool(s.stamp, true),
    near: bool(s.near, true),
    reward: bool(s.reward, true),
    birthday: bool(s.birthday, true),
    winback: bool(s.winback, true),
    winbackDays: Number.isInteger(days) && days >= 14 && days <= 180 ? days : 45,
  };
}

const visits = (n: number) => (n === 1 ? "1 visita" : `${n} visitas`);

/**
 * Aviso tras registrar una visita: premio listo, te falta 1 o sello nuevo
 * (solo uno, el más importante). null si el comercio lo tiene apagado.
 */
export function visitNotice(
  settings: WalletSettings,
  v: { businessName: string; stamps: number; required: number; rewardName: string; rewardEarned?: string | null; birthdayReward?: string | null },
): Notice | null {
  const earned = v.birthdayReward || v.rewardEarned;
  if (earned) {
    if (!settings.reward) return null;
    return v.birthdayReward
      ? { kind: "reward", title: `¡Regalo de cumpleaños en ${v.businessName}!`, body: `Tienes tu ${v.birthdayReward}. Muestra tu tarjeta en caja.` }
      : { kind: "reward", title: `¡Tu premio está listo!`, body: `Ganaste tu ${earned} en ${v.businessName}. Muéstrale tu tarjeta al equipo.` };
  }
  const left = Math.max(v.required - v.stamps, 0);
  if (left === 1 && settings.near) {
    return { kind: "near", title: `Te falta 1 sello en ${v.businessName}`, body: `Una visita más y te llevas tu ${v.rewardName}.` };
  }
  if (!settings.stamp) return null;
  return {
    kind: "stamp",
    title: `Sello nuevo en ${v.businessName}`,
    body: `Vas ${v.stamps} de ${v.required}. Te ${left === 1 ? "falta" : "faltan"} ${visits(left)} para tu ${v.rewardName}.`,
  };
}

/** Avisos del proceso diario. */
export function dailyNotice(
  kind: "birthday" | "winback",
  v: { firstName: string; businessName: string; stamps: number; required: number; rewardName: string },
): Notice {
  if (kind === "birthday") {
    return { kind, title: `¡Feliz cumpleaños, ${v.firstName}!`, body: `En ${v.businessName} queremos celebrarlo contigo. Te esperamos este mes.` };
  }
  const progress = v.stamps > 0 ? ` Llevas ${v.stamps} de ${v.required} sellos para tu ${v.rewardName}.` : "";
  return { kind, title: `Te extrañamos en ${v.businessName}`, body: `Hola ${v.firstName}, hace rato no te vemos.${progress} ¡Te esperamos!` };
}

/** Reemplaza {nombre} por el primer nombre (igual que la base de datos en las campañas). */
export const personalize = (body: string, fullName: string) => body.replaceAll("{nombre}", fullName.trim().split(/\s+/)[0] ?? "");
