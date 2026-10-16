import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  color,
  src,
  initials,
  size = 28,
  className,
  ring,
}: {
  name?: string | null;
  color?: string | null;
  src?: string | null;
  initials?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const label = initials || (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
  return (
    <span
      title={name ?? undefined}
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white select-none", ring && "ring-2 ring-background", className)}
      style={{ width: size, height: size, background: color ?? "#94A3B8", fontSize: Math.max(9, size * 0.38) }}
    >
      {label}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 24 }: { people: { name: string; color: string; avatarUrl?: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <UserAvatar key={i} name={p.name} color={p.color} src={p.avatarUrl} size={size} ring />
      ))}
      {people.length > max && (
        <span className="inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-background" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}
