"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Re-render the server page periodically so team pages stay live. */
export function AutoRefresh({ ms = 15000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
