/**
 * Configuración pública de Supabase. Solo URL y anon key pueden llegar al navegador;
 * la service_role vive únicamente en src/lib/supabase/admin.ts (server-only).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sin variables de entorno la app funciona en modo demo (Etapa 1, datos en el navegador). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
