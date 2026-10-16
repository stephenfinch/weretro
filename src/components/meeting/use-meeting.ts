"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MeetingStateDTO } from "@/lib/meeting-types";

export type OpFn = (type: string, payload?: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown; error?: string }>;

export type MeetingCtx = {
  state: MeetingStateDTO;
  op: OpFn;
  ops: (list: { type: string; [k: string]: unknown }[]) => Promise<boolean>;
  refresh: () => void;
  clockOffset: number; // serverNow - clientNow (ms)
  typing: () => void;
  connected: boolean;
};

export const MeetingContext = createContext<MeetingCtx | null>(null);

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used inside MeetingProvider");
  return ctx;
}

export function useMeetingSync(initial: MeetingStateDTO): MeetingCtx {
  const [state, setState] = useState(initial);
  const [connected, setConnected] = useState(true);
  const [clockOffset, setClockOffset] = useState(() => new Date(initial.serverNow).getTime() - Date.now());
  const versionRef = useRef(initial.version);
  const kick = useRef<AbortController | null>(null);
  const meetingId = initial.meeting.id;

  const apply = useCallback((s: MeetingStateDTO) => {
    if (s.version < versionRef.current) return;
    versionRef.current = s.version;
    setClockOffset(new Date(s.serverNow).getTime() - Date.now());
    setState(s);
  }, []);

  useEffect(() => {
    let stopped = false;
    let failures = 0;
    const loop = async () => {
      while (!stopped) {
        const ctrl = new AbortController();
        kick.current = ctrl;
        try {
          const res = await fetch(`/api/meetings/${meetingId}/state?v=${versionRef.current}`, { signal: ctrl.signal, cache: "no-store" });
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            if (res.status === 404) toast.error("This meeting is no longer available");
            stopped = true;
            break;
          }
          const json = await res.json();
          failures = 0;
          setConnected(true);
          if (!json.unchanged) apply(json as MeetingStateDTO);
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            if (stopped) break;
            continue;
          }
          failures++;
          setConnected(false);
          await new Promise((r) => setTimeout(r, Math.min(10_000, 500 * 2 ** failures)));
        }
      }
    };
    void loop();
    const onVis = () => {
      if (document.visibilityState === "visible") kick.current?.abort();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      kick.current?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [meetingId, apply]);

  const send = useCallback(
    async (list: { type: string; [k: string]: unknown }[], returnState = true) => {
      const res = await fetch(`/api/meetings/${meetingId}/ops`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops: list, returnState }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false as const, error: (json.error as string) ?? "Something went wrong" };
      if (json.state) apply(json.state as MeetingStateDTO);
      return { ok: true as const, results: json.results as unknown[] };
    },
    [meetingId, apply],
  );

  const op: OpFn = useCallback(
    async (type, payload = {}) => {
      const r = await send([{ type, ...payload }]);
      if (!r.ok) {
        toast.error(r.error);
        return { ok: false, error: r.error };
      }
      return { ok: true, result: r.results?.[0] };
    },
    [send],
  );

  const ops = useCallback(
    async (list: { type: string; [k: string]: unknown }[]) => {
      const r = await send(list);
      if (!r.ok) toast.error(r.error);
      return r.ok;
    },
    [send],
  );

  const lastTyping = useRef(0);
  const typing = useCallback(() => {
    const now = Date.now();
    if (now - lastTyping.current < 4000) return;
    lastTyping.current = now;
    void send([{ type: "typing" }], false);
  }, [send]);

  const refresh = useCallback(() => kick.current?.abort(), []);

  return useMemo(() => ({ state, op, ops, refresh, clockOffset, typing, connected }), [state, op, ops, refresh, clockOffset, typing, connected]);
}
