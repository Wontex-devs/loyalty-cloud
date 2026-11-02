import type { BusinessStatus, CardStatus, RewardStatus } from "@/lib/domain/types";

type Tone = "success" | "brand" | "danger" | "warning" | "neutral" | "info";

export const CARD_STATUS: Record<CardStatus, { label: string; tone: Tone }> = {
  active: { label: "Activa", tone: "success" },
  reward_available: { label: "Recompensa", tone: "brand" },
  blocked: { label: "Bloqueada", tone: "danger" },
};

export const REWARD_STATUS: Record<RewardStatus, { label: string; tone: Tone }> = {
  available: { label: "Disponible", tone: "brand" },
  redeemed: { label: "Canjeada", tone: "neutral" },
  expired: { label: "Vencida", tone: "warning" },
  void: { label: "Anulada", tone: "danger" },
};

export const BUSINESS_STATUS: Record<BusinessStatus, { label: string; tone: Tone }> = {
  active: { label: "Activo", tone: "success" },
  trial: { label: "Prueba", tone: "info" },
  suspended: { label: "Suspendido", tone: "danger" },
};
