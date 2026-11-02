import "server-only";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Page = PromiseLike<{ data: any[] | null; error: unknown }>;

/**
 * Supabase devuelve como máximo 1000 filas por consulta. Pide páginas
 * consecutivas hasta agotar los datos o llegar a `max`.
 */
export async function fetchAll(page: (from: number, to: number) => Page, max = 20000, size = 1000) {
  const rows: any[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, Math.min(from + size, max) - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < size) break;
  }
  return rows;
}
