/**
 * Configuración pública de Supabase. Solo URL y anon key pueden llegar al navegador;
 * la service_role vive únicamente en src/lib/supabase/admin.ts (server-only).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
