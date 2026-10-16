"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import { Download, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Scene = { elements: { id: string; version?: number }[]; files?: Record<string, unknown> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type API = any;

export default function WhiteboardCanvas({ id, readOnly, title }: { id: string; readOnly?: boolean; title?: string }) {
  const { resolvedTheme } = useTheme();
  const [initial, setInitial] = useState<Scene | null>(null);
  const [locked, setLocked] = useState(false);
  const api = useRef<API>(null);
  const version = useRef(-1);
  const lastLocal = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef<string>("");

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/whiteboards/${id}?since=${version.current}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) return;
        if (!json.unchanged) {
          version.current = json.sceneVersion;
          if (!initial) {
            setInitial(json.scene);
            setLocked(json.editPermission === "creator" && !!readOnly);
          } else if (api.current && Date.now() - lastLocal.current > 1200) {
            const local = api.current.getSceneElementsIncludingDeleted() as { id: string; version: number }[];
            const map = new Map(local.map((e) => [e.id, e]));
            for (const el of json.scene.elements as { id: string; version: number }[]) {
              const cur = map.get(el.id);
              if (!cur || el.version > cur.version) map.set(el.id, el);
            }
            api.current.updateScene({ elements: [...map.values()] });
            if (json.scene.files) api.current.addFiles(Object.values(json.scene.files));
          }
        }
      } catch {
        /* retry next tick */
      }
      if (!stop) setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onChange = useCallback(
    (elements: readonly { id: string; version: number }[], _appState: unknown, files: Record<string, unknown>) => {
      if (readOnly) return;
      const sig = elements.map((e) => `${e.id}:${e.version}`).join(",");
      if (sig === lastSent.current) return;
      lastLocal.current = Date.now();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        lastSent.current = sig;
        const res = await fetch(`/api/whiteboards/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ elements, files }) });
        if (res.ok) version.current = (await res.json()).sceneVersion;
      }, 500);
    },
    [id, readOnly],
  );

  const download = async (kind: "png" | "svg") => {
    if (!api.current) return;
    const elements = api.current.getSceneElements();
    const files = api.current.getFiles();
    const appState = { ...api.current.getAppState(), exportBackground: true };
    let blob: Blob;
    if (kind === "png") blob = await exportToBlob({ elements, files, appState, mimeType: "image/png" });
    else {
      const svg = await exportToSvg({ elements, files, appState });
      blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "whiteboard"}.${kind}`;
    a.click();
  };

  if (!initial)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" /> Loading whiteboard…
      </div>
    );
  return (
    <div className="relative h-full">
      <Excalidraw
        excalidrawAPI={(a: API) => (api.current = a)}
        initialData={{ elements: initial.elements as never, files: (initial.files ?? {}) as never, appState: { viewBackgroundColor: resolvedTheme === "dark" ? "#1e1e2a" : "#ffffff" } }}
        onChange={onChange as never}
        viewModeEnabled={readOnly || locked}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false } }}
      />
      <div className="absolute right-3 bottom-3 z-10 flex gap-2">
        {(readOnly || locked) && (
          <span className="flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs shadow">
            <Lock className="size-3" /> Only the creator can edit this whiteboard
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><Download /> Download</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void download("png")}>Download as PNG</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void download("svg")}>Download as SVG</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
