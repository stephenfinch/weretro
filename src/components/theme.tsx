"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "theme";

// Runs before paint (inlined in <head> by the root layout) so there is no flash.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;c.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

const Ctx = createContext<{ theme: Theme; resolvedTheme: "light" | "dark"; setTheme: (t: Theme) => void }>({ theme: "system", resolvedTheme: "light", setTheme: () => {} });

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  const css = document.createElement("style");
  css.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important}"));
  document.head.appendChild(css);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  void window.getComputedStyle(document.body).opacity;
  setTimeout(() => css.remove(), 1);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [sysDark, setSysDark] = useState(false);

  useEffect(() => {
    let stored: Theme = "system";
    try {
      stored = (localStorage.getItem(KEY) as Theme) || "system";
    } catch {}
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSysDark(mq.matches);
    mq.addEventListener("change", onChange);
    queueMicrotask(() => {
      setThemeState(stored);
      setSysDark(mq.matches);
    });
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? (sysDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark") !== (resolvedTheme === "dark")) apply(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    setThemeState(t);
    if (t === "system") setSysDark(systemDark());
  }, []);

  return <Ctx.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
