import { NoAccess } from "@/components/layout/no-access";

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  return <NoAccess suspendida={motivo === "suspendida"} />;
}
