import { Card } from "@/components/ui";
import { Badge } from "@/components/ui";

export function ComingSoon({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <Badge tone="neutral">Funcionalidad futura</Badge>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <Card className="mt-8 p-5 text-left">
        <ul className="space-y-2 text-sm text-ink-2">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="text-subtle">·</span> {b}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
