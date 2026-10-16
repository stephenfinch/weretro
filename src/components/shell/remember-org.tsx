"use client";
import { useEffect } from "react";
export function RememberOrg({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `wr_org=${slug}; path=/; max-age=31536000; samesite=lax`;
  }, [slug]);
  return null;
}
