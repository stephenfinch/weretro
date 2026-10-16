"use client";

import { usePathname, useRouter } from "next/navigation";

export function Select({ models, value }: { models: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (models.length <= 1) return <span className="text-sm text-muted-foreground">{models[0]?.name}</span>;
  return (
    <select value={value} onChange={(e) => router.replace(`${pathname}?model=${e.target.value}`)} className="ml-auto rounded-lg border bg-background px-2 py-1 text-sm">
      {models.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}
