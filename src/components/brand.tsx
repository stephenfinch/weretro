import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="wr-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6D5DF6" />
          <stop offset="1" stopColor="#E0569B" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#wr-g)" />
      <path d="M8.5 11.5h7a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-3.2L9.5 22v-2.6a3 3 0 0 1-1-2.4v-2.5a3 3 0 0 1 0-3Z" fill="#fff" opacity=".95" />
      <path d="M17 9.5h6a3 3 0 0 1 3 3v2.2a3 3 0 0 1-1.3 2.5V19l-2.4-1.8H20" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
    </svg>
  );
}

export function Logo({ href = "/", className, showText = true }: { href?: string; className?: string; showText?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      {showText && (
        <span className="text-lg">
          We<span className="text-primary">Retro</span>
        </span>
      )}
    </Link>
  );
}
