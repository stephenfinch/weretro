"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

export type Mentionable = { userId: string; name: string; color: string; avatarUrl: string | null };

export type MentionInputHandle = { focus: () => void; clear: () => void };

/** Single-line (auto-growing) input with @mention autocomplete. */
export const MentionInput = forwardRef<
  MentionInputHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    onCancel?: () => void;
    members: Mentionable[];
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    onMention?: (userId: string) => void;
    onKeyStroke?: () => void;
    disabled?: boolean;
    multiline?: boolean;
  }
>(function MentionInput({ value, onChange, onSubmit, onCancel, members, placeholder, className, autoFocus, onMention, onKeyStroke, disabled, multiline }, ref) {
  const el = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  useImperativeHandle(ref, () => ({ focus: () => el.current?.focus(), clear: () => onChange("") }));
  const matches = query !== null ? members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];
  const pick = (m: Mentionable) => {
    const t = el.current;
    if (!t) return;
    const pos = t.selectionStart ?? value.length;
    const before = value.slice(0, pos).replace(/@[^\s@]*$/, `@${m.name} `);
    onChange(before + value.slice(pos));
    onMention?.(m.userId);
    setQuery(null);
    requestAnimationFrame(() => {
      t.focus();
      t.selectionStart = t.selectionEnd = before.length;
    });
  };
  return (
    <div className="relative w-full">
      <textarea
        ref={el}
        rows={1}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          onKeyStroke?.();
          const pos = e.target.selectionStart ?? e.target.value.length;
          const m = e.target.value.slice(0, pos).match(/@([^\s@]*)$/);
          setQuery(m ? m[1] : null);
          setActive(0);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
        }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[active]); return; }
            if (e.key === "Escape") { setQuery(null); return; }
          }
          if (e.key === "Enter" && !e.shiftKey && !(multiline && e.metaKey === false && e.ctrlKey === false && false)) {
            e.preventDefault();
            onSubmit();
            if (el.current) el.current.style.height = "auto";
          }
          if (e.key === "Escape") onCancel?.();
        }}
        className={cn("block w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)}
      />
      {matches.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
          {matches.map((m, i) => (
            <button
              key={m.userId}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm", i === active && "bg-muted")}
            >
              <UserAvatar name={m.name} color={m.color} src={m.avatarUrl} size={20} /> {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
