"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, RefreshCw, Shuffle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATAR_COLORS } from "@/lib/constants";
import { ALL_QUESTIONS, EMOJI_PUZZLES, MISSION_PROMPTS, PUNCHLINE_SETUPS, QUIZ, SPECTRUMS, THIS_OR_THAT, WORD_STARTERS } from "@/lib/icebreaker-content";
import { type Game, PlayerChip, Scoreboard, Stage, TextSubmit, Waiting, norm, pickIndexes, shuffle, useGame } from "./common";

// ── 1. Random name picker ────────────────────────────────────────────────
function spinWheel(names: string[], angle: number, seg: number) {
  const i = Math.floor(Math.random() * names.length);
  const target = 360 * 6 + (360 - (i * seg + seg / 2));
  return { angle: angle - (angle % 360) + target, winner: names[i], spinAt: Date.now() };
}

export function NamePicker() {
  const g = useGame();
  const extra = (g.data.extra as string[]) ?? [];
  const removed = (g.data.removed as string[]) ?? [];
  const names = [...g.players.map((p) => g.name(p.id)), ...extra].filter((n) => !removed.includes(n));
  const [add, setAdd] = useState("");
  const angle = Number(g.data.angle ?? 0);
  const winner = g.data.winner as string | undefined;
  const [shown, setShown] = useState<string | undefined>(winner);
  useEffect(() => {
    const t = setTimeout(() => setShown(winner), 4200);
    return () => clearTimeout(t);
  }, [winner, g.data.spinAt]);
  const seg = 360 / Math.max(1, names.length);
  const spin = () => void g.setData(spinWheel(names, angle, seg));
  return (
    <Stage title="Random name picker" subtitle="Spin the wheel and let fate decide who's next.">
      <div className="relative mx-auto aspect-square w-full max-w-sm">
        <div className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-foreground" />
        <svg viewBox="-100 -100 200 200" className="size-full drop-shadow-lg transition-transform duration-[4000ms] ease-[cubic-bezier(.12,.8,.2,1)]" style={{ transform: `rotate(${angle}deg)` }}>
          {names.map((n, i) => {
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            const large = seg > 180 ? 1 : 0;
            const mid = (((i + 0.5) * seg - 90) * Math.PI) / 180;
            return (
              <g key={n + i}>
                <path d={names.length === 1 ? "M0 0 m-98 0 a98 98 0 1 0 196 0 a98 98 0 1 0 -196 0" : `M0 0 L${98 * Math.cos(a0)} ${98 * Math.sin(a0)} A98 98 0 ${large} 1 ${98 * Math.cos(a1)} ${98 * Math.sin(a1)} Z`} fill={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
                <text x={60 * Math.cos(mid)} y={60 * Math.sin(mid)} fill="white" fontSize={names.length > 12 ? 6 : 8} fontWeight={600} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(i + 0.5) * seg} ${60 * Math.cos(mid)} ${60 * Math.sin(mid)})`}>
                  {n.length > 14 ? `${n.slice(0, 13)}…` : n}
                </text>
              </g>
            );
          })}
          <circle r={10} fill="white" />
        </svg>
      </div>
      {shown && <p className="animate-pop-in text-center text-3xl font-bold text-primary">{shown}!</p>}
      {g.isFac && (
        <div className="space-y-3">
          <div className="flex justify-center gap-2">
            <Button size="lg" onClick={spin} disabled={!names.length}>Spin</Button>
            {winner && <Button variant="outline" onClick={() => void g.setData({ removed: [...removed, winner], winner: null })}>Remove {winner}</Button>}
            {removed.length > 0 && <Button variant="ghost" onClick={() => void g.setData({ removed: [] })}>Reset</Button>}
          </div>
          <form className="mx-auto flex max-w-xs gap-2" onSubmit={(e) => { e.preventDefault(); if (add.trim()) void g.setData({ extra: [...extra, add.trim()] }); setAdd(""); }}>
            <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add names…" />
            <Button type="submit" variant="outline" size="icon"><Plus /></Button>
          </form>
        </div>
      )}
    </Stage>
  );
}

// ── 2. Breakout groups ───────────────────────────────────────────────────
export function Breakout() {
  const g = useGame();
  const groups = (g.data.groups as string[][]) ?? [];
  const [count, setCount] = useState(Math.max(2, Math.min(4, Math.ceil(g.players.length / 3))));
  const make = () => {
    const ids = shuffle(g.players.map((p) => p.id));
    const out: string[][] = Array.from({ length: count }, () => []);
    ids.forEach((id, i) => out[i % count].push(id));
    void g.setData({ groups: out });
  };
  const move = (pid: string, to: number) => void g.setData({ groups: groups.map((gr, i) => (i === to ? [...gr.filter((x) => x !== pid), pid] : gr.filter((x) => x !== pid))) });
  return (
    <Stage title="Breakout groups" subtitle="Split everyone into groups, then fine-tune.">
      {g.isFac && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm">Groups:</span>
          <Input type="number" min={2} max={20} value={count} onChange={(e) => setCount(Math.max(2, Number(e.target.value)))} className="w-20" />
          <Button onClick={make}><Shuffle /> {groups.length ? "Reshuffle" : "Create groups"}</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((gr, i) => (
          <div key={i} className="space-y-2 rounded-2xl border bg-card p-4">
            <p className="font-semibold">Group {i + 1}</p>
            <div className="flex flex-wrap gap-1.5">
              {gr.map((pid) => (
                <span key={pid} className="inline-flex items-center gap-1">
                  <PlayerChip pid={pid} g={g} highlight={pid === g.me?.id} />
                  {g.isFac && (
                    <select value={i} onChange={(e) => move(pid, Number(e.target.value))} className="rounded border bg-background text-xs">
                      {groups.map((_, j) => (
                        <option key={j} value={j}>→ {j + 1}</option>
                      ))}
                    </select>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!groups.length && <p className="text-center text-sm text-muted-foreground">Waiting for the facilitator to create groups…</p>}
    </Stage>
  );
}

// ── 3. Icebreaker questions ──────────────────────────────────────────────
export function QuestionPick() {
  const g = useGame();
  const opts = (g.data.options as number[]) ?? [];
  const revealed = !!g.data.revealed;
  const picks = g.of("pick");
  const mine = g.mine("pick")[0]?.payload.i as number | undefined;
  useEffect(() => {
    if (g.isFac && !opts.length) void g.setData({ options: pickIndexes(4, ALL_QUESTIONS.length) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.length, g.isFac]);
  const counts = opts.map((_, i) => picks.filter((p) => p.payload.i === i).length);
  const max = Math.max(...counts, 0);
  return (
    <Stage title="Icebreaker questions" subtitle="Which question would you pick?" controls={g.isFac && (
      <>
        <Button onClick={() => void g.setData({ revealed: !revealed })}>{revealed ? "Hide" : "Reveal"} results</Button>
        <Button variant="outline" onClick={() => void g.setData({ options: pickIndexes(4, ALL_QUESTIONS.length), revealed: false }, { round: g.round + 1 })}><RefreshCw /> New questions</Button>
      </>
    )}>
      <div className="grid gap-3 sm:grid-cols-2">
        {opts.map((qi, i) => (
          <button key={qi} type="button" onClick={() => void g.submit("pick", { i }, { replace: true })} className={cn("relative overflow-hidden rounded-2xl border bg-card p-5 text-left text-lg font-medium transition hover:border-primary", mine === i && "border-primary ring-2 ring-primary/30", revealed && counts[i] === max && max > 0 && "bg-primary/10")}>
            {ALL_QUESTIONS[qi]}
            {revealed && <span className="mt-2 block text-sm text-muted-foreground">{counts[i]} {counts[i] === 1 ? "vote" : "votes"}</span>}
          </button>
        ))}
      </div>
      <Waiting done={new Set(picks.map((p) => p.participantId)).size} total={g.players.length} label="picked" />
    </Stage>
  );
}

// ── 4. Two truths and a lie ──────────────────────────────────────────────
export function TwoTruths() {
  const g = useGame();
  const subs = g.entries.filter((e) => e.kind === "statements");
  const mySub = subs.find((s) => s.mine);
  const [st, setSt] = useState(["", "", ""]);
  const [lie, setLie] = useState(2);
  const order = (g.data.order as string[]) ?? [];
  const cur = Number(g.data.current ?? 0);
  const revealed = !!g.data.revealed;
  const scores = (g.data.scores as Record<string, number>) ?? {};
  if (g.phase !== "play" && g.phase !== "done") {
    return (
      <Stage title="Two truths and a lie" subtitle="Write three statements about yourself. Mark which one is the lie." controls={g.isFac && <Button disabled={subs.length < 2} onClick={() => void g.setData({ order: shuffle(subs.map((s) => s.participantId)), current: 0, revealed: false, scores: {} }, { phase: "play" })}>Start guessing</Button>}>
        {mySub ? (
          <p className="text-center text-emerald-600"><Check className="inline size-4" /> Submitted! Waiting for others…</p>
        ) : (
          <div className="mx-auto max-w-xl space-y-2">
            {st.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s} onChange={(e) => setSt(st.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Statement ${i + 1}`} />
                <button type="button" onClick={() => setLie(i)} className={cn("rounded-lg border px-2 py-1 text-xs font-semibold whitespace-nowrap", lie === i ? "border-red-500 bg-red-500 text-white" : "text-muted-foreground")}>{lie === i ? "The lie" : "Mark lie"}</button>
              </div>
            ))}
            <Button className="w-full" disabled={st.some((s) => !s.trim())} onClick={() => void g.submit("statements", { statements: st, lie }, { replace: true, round: 0 })}>Submit</Button>
          </div>
        )}
        <Waiting done={subs.length} total={g.players.length} />
      </Stage>
    );
  }
  const target = order[cur];
  const sub = subs.find((s) => s.participantId === target);
  const statements = (sub?.payload.statements as string[]) ?? [];
  const lieIdx = Number(sub?.payload.lie);
  const guesses = g.entries.filter((e) => e.kind === "guess" && e.round === cur + 1);
  const myGuess = guesses.find((x) => x.mine)?.payload.i as number | undefined;
  const isTarget = target === g.me?.id;
  const tallied = () => {
    const next = { ...scores };
    for (const gu of guesses) if (gu.payload.i === lieIdx) next[gu.participantId] = (next[gu.participantId] ?? 0) + 1;
    next[target] = (next[target] ?? 0) + guesses.filter((x) => x.payload.i !== lieIdx).length;
    return next;
  };
  if (g.phase === "done") {
    return (
      <Stage title="Final scores" controls={g.isFac && <Button variant="outline" onClick={() => void g.set({ phase: "lobby", clearEntries: true, data: {} })}>Play again</Button>}>
        <Scoreboard scores={scores} g={g} />
      </Stage>
    );
  }
  return (
    <Stage title={`${g.name(target)}'s statements`} subtitle={isTarget ? "Everyone is guessing your lie!" : "Which one is the lie?"} controls={g.isFac && (
      revealed ? (
        cur + 1 < order.length ? <Button onClick={() => void g.setData({ current: cur + 1, revealed: false, scores: tallied() })}>Next player</Button> : <Button onClick={() => void g.setData({ scores: tallied() }, { phase: "done" })}>Final scores</Button>
      ) : <Button onClick={() => void g.setData({ revealed: true })}>Reveal the lie</Button>
    )}>
      <div className="space-y-2">
        {statements.map((s, i) => {
          const count = guesses.filter((x) => x.payload.i === i).length;
          return (
            <button key={i} type="button" disabled={isTarget || revealed} onClick={() => void g.submit("guess", { i }, { replace: true, round: cur + 1 })} className={cn("w-full rounded-2xl border bg-card p-4 text-left text-lg transition", myGuess === i && "border-primary ring-2 ring-primary/30", revealed && i === lieIdx && "border-red-500 bg-red-500/10")}>
              {s}
              {revealed && <span className="ml-2 text-sm text-muted-foreground">{count} guessed · {i === lieIdx ? "LIE" : "truth"}</span>}
            </button>
          );
        })}
      </div>
      <Waiting done={guesses.length} total={g.players.length - 1} label="guessed" />
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

// ── 5. Emoji guess ───────────────────────────────────────────────────────
export function EmojiGuess() {
  const g = useGame();
  const order = (g.data.order as number[]) ?? [];
  const cur = Number(g.data.current ?? 0);
  const p = EMOJI_PUZZLES[order[cur] ?? 0];
  const revealed = !!g.data.revealed;
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const guesses = g.of("guess", cur);
  const correct = guesses.filter((x) => norm(String(x.payload.text)) === norm(p.answer) || norm(String(x.payload.text)).includes(norm(p.answer)));
  const firsts = [...new Map(correct.map((c) => [c.participantId, c])).values()];
  const iGotIt = firsts.some((f) => f.mine);
  useEffect(() => {
    if (g.isFac && !order.length) void g.setData({ order: pickIndexes(10, EMOJI_PUZZLES.length), current: 0, scores: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length, g.isFac]);
  const reveal = () => {
    const next = { ...scores };
    firsts.forEach((f, i) => (next[f.participantId] = (next[f.participantId] ?? 0) + Math.max(1, 3 - i)));
    void g.setData({ revealed: true, scores: next });
  };
  return (
    <Stage title="Emoji guess" subtitle={`${p.category} · guess the answer, fastest wins`} controls={g.isFac && (revealed ? <Button onClick={() => void g.setData({ current: cur + 1, revealed: false }, { round: cur + 1 })} disabled={cur + 1 >= order.length}>Next puzzle</Button> : <Button onClick={reveal}>Reveal answer</Button>)}>
      <p className="text-center text-7xl">{p.emoji}</p>
      {revealed ? <p className="text-center text-2xl font-semibold">{p.answer}</p> : iGotIt ? <p className="text-center text-emerald-600">You got it!</p> : <TextSubmit placeholder="Your guess…" onSubmit={(t) => void g.submit("guess", { text: t }, { round: cur })} />}
      {firsts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {firsts.map((f, i) => <PlayerChip key={f.id} pid={f.participantId} g={g}>#{i + 1}</PlayerChip>)}
        </div>
      )}
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

// ── 6. Quick quiz ────────────────────────────────────────────────────────
export function QuickQuiz() {
  const g = useGame();
  const order = (g.data.order as number[]) ?? [];
  const cur = Number(g.data.current ?? 0);
  const q = QUIZ[order[cur] ?? 0];
  const revealed = !!g.data.revealed;
  const startedAt = Number(g.data.startedAt ?? 0);
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const answers = g.of("answer", cur);
  const mine = answers.find((a) => a.mine);
  useEffect(() => {
    if (g.isFac && !order.length) void g.setData({ order: pickIndexes(8, QUIZ.length), current: 0, scores: {}, startedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length, g.isFac]);
  const reveal = () => {
    const next = { ...scores };
    for (const a of answers) if (a.payload.choice === q.answer) next[a.participantId] = (next[a.participantId] ?? 0) + Math.max(100, 1000 - Math.round((Number(a.payload.t) - startedAt) / 20));
    void g.setData({ revealed: true, scores: next });
  };
  return (
    <Stage title={q.q} subtitle={`Question ${cur + 1} of ${order.length || 8} · answer fast to score more`} controls={g.isFac && (revealed ? <Button disabled={cur + 1 >= order.length} onClick={() => void g.setData({ current: cur + 1, revealed: false, startedAt: Date.now() }, { round: cur + 1 })}>Next question</Button> : <Button onClick={reveal}>Reveal</Button>)}>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button key={i} type="button" disabled={!!mine || revealed} onClick={() => void g.submit("answer", { choice: i, t: Date.now() }, { round: cur })} className={cn("rounded-2xl border bg-card p-4 text-left text-base font-medium transition", ["hover:border-red-500", "hover:border-blue-500", "hover:border-amber-500", "hover:border-green-500"][i], mine?.payload.choice === i && "border-primary ring-2 ring-primary/30", revealed && i === q.answer && "border-emerald-500 bg-emerald-500/10")}>
            {o}
            {revealed && <span className="ml-2 text-sm text-muted-foreground">{answers.filter((a) => a.payload.choice === i).length}</span>}
          </button>
        ))}
      </div>
      <Waiting done={answers.length} total={g.players.length} label="answered" />
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

// ── 7. This or that ──────────────────────────────────────────────────────
export function ThisOrThat() {
  const g = useGame();
  const idx = Number(g.data.pair ?? 0);
  const [a, b] = THIS_OR_THAT[idx % THIS_OR_THAT.length];
  const picks = g.of("pick");
  const mine = picks.find((p) => p.mine)?.payload.side as number | undefined;
  const revealed = !!g.data.revealed;
  const ca = picks.filter((p) => p.payload.side === 0);
  const cb = picks.filter((p) => p.payload.side === 1);
  return (
    <Stage title="This or that?" subtitle="Find out where people stand." controls={g.isFac && (
      <>
        <Button onClick={() => void g.setData({ revealed: !revealed })}>{revealed ? "Hide" : "Reveal"}</Button>
        <Button variant="outline" onClick={() => void g.setData({ pair: Math.floor(Math.random() * THIS_OR_THAT.length), revealed: false }, { round: g.round + 1 })}>Next</Button>
      </>
    )}>
      <div className="grid grid-cols-2 gap-4">
        {[a, b].map((label, side) => {
          const list = side ? cb : ca;
          return (
            <button key={side} type="button" onClick={() => void g.submit("pick", { side }, { replace: true })} className={cn("flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border-2 p-6 text-2xl font-bold transition", side ? "border-sky-500/40 bg-sky-500/10" : "border-rose-500/40 bg-rose-500/10", mine === side && "ring-4 ring-primary/40")}>
              {label}
              {revealed && (
                <span className="flex flex-wrap justify-center gap-1">
                  {list.map((p) => <PlayerChip key={p.id} pid={p.participantId} g={g} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {revealed && picks.length > 0 && (
        <div className="flex h-3 overflow-hidden rounded-full">
          <span className="bg-rose-500" style={{ width: `${(ca.length / picks.length) * 100}%` }} />
          <span className="bg-sky-500" style={{ width: `${(cb.length / picks.length) * 100}%` }} />
        </div>
      )}
      <Waiting done={picks.length} total={g.players.length} label="picked" />
    </Stage>
  );
}

// ── 8. Team spectrum ─────────────────────────────────────────────────────
export function TeamSpectrum() {
  const g = useGame();
  const idx = Number(g.data.pair ?? 0);
  const [l, r] = SPECTRUMS[idx % SPECTRUMS.length];
  const target = g.data.target as string | undefined;
  const revealed = !!g.data.revealed;
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const placed = g.of("place").find((p) => p.participantId === target);
  const guesses = g.of("guess");
  const myGuess = guesses.find((x) => x.mine);
  const isTarget = g.me?.id === target;
  const [val, setVal] = useState(50);
  const next = () => {
    const t = g.players[Math.floor(Math.random() * g.players.length)]?.id;
    void g.setData({ pair: Math.floor(Math.random() * SPECTRUMS.length), target: t, revealed: false }, { round: g.round + 1 });
  };
  const reveal = () => {
    const tv = Number(placed?.payload.v ?? 50);
    const s = { ...scores };
    for (const gu of guesses) s[gu.participantId] = (s[gu.participantId] ?? 0) + Math.max(0, 100 - Math.abs(Number(gu.payload.v) - tv) * 2);
    void g.setData({ revealed: true, scores: s });
  };
  if (!target) return <Stage title="Team spectrum" subtitle="Guess where someone stands on a topic." controls={g.isFac && <Button onClick={next}>Start</Button>}><p className="text-center text-muted-foreground">Waiting for the facilitator…</p></Stage>;
  return (
    <Stage title={`Where does ${g.name(target)} stand?`} subtitle={isTarget ? "Place yourself on the spectrum. Others will guess." : placed ? "Guess where they placed themselves." : `Waiting for ${g.name(target)} to place themselves…`} controls={g.isFac && (revealed ? <Button onClick={next}>Next round</Button> : <Button disabled={!placed} onClick={reveal}>Reveal</Button>)}>
      <div className="space-y-3 rounded-3xl border bg-card p-6">
        <div className="flex justify-between text-lg font-semibold"><span>{l}</span><span>{r}</span></div>
        <div className="relative h-10 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-sky-400">
          {revealed && guesses.map((gu) => <span key={gu.id} title={g.name(gu.participantId)} className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${gu.payload.v}%`, background: g.color(gu.participantId) }} />)}
          {revealed && placed && <span className="absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-foreground" style={{ left: `${placed.payload.v}%` }} />}
        </div>
        {!revealed && ((isTarget && !placed) || (!isTarget && placed && !myGuess)) && (
          <div className="space-y-2">
            <input type="range" min={0} max={100} value={val} onChange={(e) => setVal(Number(e.target.value))} className="w-full" />
            <Button className="w-full" onClick={() => void g.submit(isTarget ? "place" : "guess", { v: val }, { replace: true })}>{isTarget ? "Place myself here" : "Lock in guess"}</Button>
          </div>
        )}
      </div>
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

// ── 9. Word association ──────────────────────────────────────────────────
export function WordAssociation() {
  const g = useGame();
  const start = (g.data.start as string) ?? WORD_STARTERS[0];
  const words = g.of("word");
  const last = words[words.length - 1];
  const myTurnBlocked = last?.mine;
  return (
    <Stage title="Word association" subtitle="Add a word linked to the previous one. Build the chain together!" controls={g.isFac && <Button variant="outline" onClick={() => void g.setData({ start: WORD_STARTERS[Math.floor(Math.random() * WORD_STARTERS.length)] }, { round: g.round + 1 })}>New chain</Button>}>
      <div className="flex flex-wrap items-center justify-center gap-2 text-lg">
        <span className="rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground">{start}</span>
        {words.map((w) => (
          <span key={w.id} className="flex items-center gap-2">
            <span className="text-muted-foreground">→</span>
            <span className="rounded-full border px-3 py-1" style={{ borderColor: g.color(w.participantId) }} title={g.name(w.participantId)}>{String(w.payload.word)}</span>
          </span>
        ))}
      </div>
      {myTurnBlocked ? <p className="text-center text-sm text-muted-foreground">Let someone else go next!</p> : <TextSubmit placeholder={`A word linked to “${last ? last.payload.word : start}”`} onSubmit={(t) => void g.submit("word", { word: t.split(/\s+/).slice(0, 3).join(" ") })} button="Add" />}
    </Stage>
  );
}

// ── 10. Mission builder ──────────────────────────────────────────────────
export function MissionBuilder() {
  const g = useGame();
  const prompt = MISSION_PROMPTS[Number(g.data.prompt ?? 0) % MISSION_PROMPTS.length];
  const goals = g.entries.filter((e) => e.kind === "goal");
  const votes = g.entries.filter((e) => e.kind === "vote");
  const [mission, setMission] = useState((g.data.mission as string) ?? "");
  const ranked = [...goals].sort((a, b) => votes.filter((v) => v.payload.goal === b.id).length - votes.filter((v) => v.payload.goal === a.id).length);
  return (
    <Stage title="Mission builder" subtitle={g.phase === "mission" ? "Our shared mission" : g.phase === "vote" ? "Vote for the goals that matter most" : prompt} controls={g.isFac && (
      <>
        {g.phase !== "vote" && g.phase !== "mission" && <Button disabled={!goals.length} onClick={() => void g.set({ phase: "vote" })}>Start voting</Button>}
        {g.phase === "vote" && <Button onClick={() => void g.set({ phase: "mission" })}>Write the mission</Button>}
      </>
    )}>
      {g.phase !== "vote" && g.phase !== "mission" && <TextSubmit placeholder="Your goal…" onSubmit={(t) => void g.submit("goal", { text: t }, { round: 0 })} />}
      <div className="grid gap-2 sm:grid-cols-2">
        {(g.phase === "lobby" || !g.phase ? goals.filter((x) => x.mine) : ranked).map((goal) => {
          const n = votes.filter((v) => v.payload.goal === goal.id).length;
          const mineVote = votes.some((v) => v.mine && v.payload.goal === goal.id);
          return (
            <div key={goal.id} className="flex items-center gap-2 rounded-2xl border bg-card p-3">
              <span className="flex-1">{String(goal.payload.text)}</span>
              {g.phase === "vote" && <Button size="xs" variant={mineVote ? "default" : "outline"} onClick={() => void g.submit("vote", { goal: goal.id }, { round: 0 })}>▲ {n}</Button>}
              {g.phase === "mission" && <span className="text-sm text-muted-foreground">{n}</span>}
            </div>
          );
        })}
      </div>
      {g.phase !== "vote" && g.phase !== "mission" && <Waiting done={new Set(goals.map((x) => x.participantId)).size} total={g.players.length} label="shared a goal" />}
      {g.phase === "mission" && (
        g.isFac ? (
          <div className="space-y-2">
            <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={3} className="w-full rounded-2xl border bg-background p-3 text-lg" placeholder="Our mission is to…" />
            <Button onClick={() => void g.setData({ mission })}>Save mission</Button>
          </div>
        ) : (
          <p className="rounded-3xl border-2 border-primary bg-primary/5 p-6 text-center text-xl font-semibold">{(g.data.mission as string) || "The facilitator is writing the mission…"}</p>
        )
      )}
    </Stage>
  );
}

// ── 11. Punchline ────────────────────────────────────────────────────────
export function Punchline() {
  const g = useGame();
  const setup = PUNCHLINE_SETUPS[Number(g.data.setup ?? 0) % PUNCHLINE_SETUPS.length];
  const answers = g.of("answer");
  const votes = g.of("vote");
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const mine = answers.find((a) => a.mine);
  const myVote = votes.find((v) => v.mine)?.payload.answer;
  const shuffled = useMemo(() => shuffle(answers), [answers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const tally = (id: string) => votes.filter((v) => v.payload.answer === id).length;
  const reveal = () => {
    const best = [...answers].sort((a, b) => tally(b.id) - tally(a.id))[0];
    const s = { ...scores };
    for (const a of answers) s[a.participantId] = (s[a.participantId] ?? 0) + tally(a.id);
    void g.setData({ scores: s, winner: best?.id }, { phase: "reveal" });
  };
  return (
    <Stage title={setup} subtitle={g.phase === "vote" ? "Vote for the funniest punchline" : g.phase === "reveal" ? "And the winner is…" : "Write your best punchline"} controls={g.isFac && (
      <>
        {g.phase !== "vote" && g.phase !== "reveal" && <Button disabled={answers.length < 2} onClick={() => void g.set({ phase: "vote" })}>Start voting</Button>}
        {g.phase === "vote" && <Button onClick={reveal}>Reveal</Button>}
        {g.phase === "reveal" && <Button onClick={() => void g.setData({ setup: Math.floor(Math.random() * PUNCHLINE_SETUPS.length), winner: null }, { phase: "answer", round: g.round + 1 })}>Next round</Button>}
      </>
    )}>
      {g.phase !== "vote" && g.phase !== "reveal" && (mine ? <p className="text-center text-emerald-600"><Check className="inline size-4" /> Submitted: “{String(mine.payload.text)}”</p> : <TextSubmit placeholder="Your punchline…" onSubmit={(t) => void g.submit("answer", { text: t })} />)}
      {(g.phase === "vote" || g.phase === "reveal") && (
        <div className="space-y-2">
          {shuffled.map((a) => (
            <button key={a.id} type="button" disabled={a.mine || g.phase === "reveal"} onClick={() => void g.submit("vote", { answer: a.id }, { replace: true })} className={cn("flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left text-lg", myVote === a.id && "border-primary ring-2 ring-primary/30", g.data.winner === a.id && "border-amber-500 bg-amber-500/10")}>
              <span className="flex-1">{String(a.payload.text)}</span>
              {g.phase === "reveal" && <span className="text-sm text-muted-foreground">{g.name(a.participantId)} · {tally(a.id)} votes</span>}
            </button>
          ))}
        </div>
      )}
      {g.phase !== "vote" && g.phase !== "reveal" && <Waiting done={answers.length} total={g.players.length} />}
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

export function NicknamePrompt({ g }: { g: Game }) {
  const nick = g.entries.find((e) => e.kind === "nick" && e.mine);
  if (nick) return null;
  return (
    <div className="mx-auto max-w-md space-y-2 rounded-2xl border bg-card p-4 text-center">
      <p className="text-sm">This meeting is anonymous. Pick a name to play icebreaker games — every other step stays anonymous.</p>
      <TextSubmit placeholder="Your game name" button="Play" onSubmit={(t) => void g.submit("nick", { name: t.slice(0, 30) }, { replace: true, round: -1 })} />
    </div>
  );
}

export { X };
