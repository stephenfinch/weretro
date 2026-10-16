"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Music, Pause, Play, Square, Timer as TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MUSIC_GENRES } from "@/lib/constants";
import { useMeeting } from "./use-meeting";
import { chime, playMusic, stopMusic, tick } from "./audio";

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function useTimerRemaining() {
  const { state, clockOffset } = useMeeting();
  const t = state.meeting.timer;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (t?.status !== "running") return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [t?.status]);
  if (!t) return { t: null, remaining: 0 };
  const remaining = t.status === "running" && t.endsAt ? new Date(t.endsAt).getTime() - (now + clockOffset) : t.remainingMs ?? t.durationMs;
  return { t, remaining };
}

export function TimerControl() {
  const { state, op } = useMeeting();
  const { t, remaining } = useTimerRemaining();
  const fac = state.me.isFacilitator;
  const running = t?.status === "running";
  const done = running && remaining <= 0;
  const firedRef = useRef<string | null>(null);
  const lastTick = useRef(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!running) return;
    const secs = Math.ceil(remaining / 1000);
    if (secs <= 5 && secs > 0 && secs !== lastTick.current && t?.chime !== false && !muted) {
      lastTick.current = secs;
      tick();
    }
    if (remaining <= 0 && firedRef.current !== t?.endsAt) {
      firedRef.current = t?.endsAt ?? "x";
      if (t?.chime !== false && !muted) chime();
    }
  }, [remaining, running, t?.chime, t?.endsAt, muted]);

  useEffect(() => {
    if (running && !done && t?.music && !muted) playMusic(t.music);
    else stopMusic();
    return () => stopMusic();
  }, [running, done, t?.music, muted]);

  const show = t && t.status !== "stopped";
  if (!fac && !show) return null;
  const presets = [1, 2, 3, 5, 7, 10, 15, 20];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-sm font-semibold tabular-nums transition",
            done ? "animate-pulse bg-destructive text-white" : show ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
          )}
          aria-label="Timer"
        >
          <TimerIcon className="size-4" />
          {show ? fmt(remaining) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="text-center font-mono text-4xl font-semibold tabular-nums">{fmt(remaining || t?.durationMs || 300000)}</div>
        {fac ? (
          <>
            <div className="grid grid-cols-4 gap-1">
              {presets.map((m) => (
                <Button key={m} size="xs" variant="outline" onClick={() => void op("timer.update", { action: "start", durationMs: m * 60_000 })}>
                  {m}m
                </Button>
              ))}
            </div>
            <div className="flex justify-center gap-1">
              <Button size="xs" variant="ghost" onClick={() => void op("timer.update", { action: "adjust", deltaMs: -60_000 })}>-1m</Button>
              <Button size="xs" variant="ghost" onClick={() => void op("timer.update", { action: "adjust", deltaMs: -10_000 })}>-10s</Button>
              <Button size="xs" variant="ghost" onClick={() => void op("timer.update", { action: "adjust", deltaMs: 10_000 })}>+10s</Button>
              <Button size="xs" variant="ghost" onClick={() => void op("timer.update", { action: "adjust", deltaMs: 60_000 })}>+1m</Button>
            </div>
            <div className="flex justify-center gap-2">
              {running ? (
                <Button size="sm" onClick={() => void op("timer.update", { action: "pause" })}><Pause /> Pause</Button>
              ) : (
                <Button size="sm" onClick={() => void op("timer.update", { action: "start" })}><Play /> Start</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => void op("timer.update", { action: "stop" })}><Square /> Stop</Button>
            </div>
            <div className="space-y-2 border-t pt-3 text-sm">
              <label className="flex items-center justify-between">
                <span className="flex items-center gap-2">{t?.chime === false ? <BellOff className="size-4" /> : <Bell className="size-4" />} Timer chime</span>
                <input type="checkbox" checked={t?.chime !== false} onChange={(e) => void op("timer.update", { action: "settings", chime: e.target.checked })} />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Music className="size-4" /> Background music</span>
                <Select value={t?.music ?? "off"} onValueChange={(v) => void op("timer.update", { action: "settings", music: v === "off" ? null : v })}>
                  <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    {MUSIC_GENRES.map((g) => (
                      <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground">{running ? "Timer running" : "Timer paused"}</p>
        )}
        <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute sounds on this device
        </label>
      </PopoverContent>
    </Popover>
  );
}
