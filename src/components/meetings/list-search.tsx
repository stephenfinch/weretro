"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ListSearch({ placeholder }: { placeholder: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [, start] = useTransition();
  return (
    <form
      className="relative ml-auto"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => router.replace(`${pathname}${q ? `?q=${encodeURIComponent(q)}` : ""}`));
      }}
    >
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-8 w-56 pl-8" />
    </form>
  );
}
