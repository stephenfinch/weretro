"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AGILITY_ANSWERS, AGILITY_PROMPTS, IMPOSTER_WORDS, PITCH_AUDIENCES, PITCH_PRODUCTS, PITCH_TWISTS, SCAVENGER_PROMPTS, SKETCH_WORDS, SLIDE_PROMPTS, STORY_STARTERS } from "@/lib/icebreaker-content";
import { useMeeting } from "../use-meeting";
import { DrawPad, PlayerChip, Scoreboard, Stage, TextSubmit, Waiting, norm, pickIndexes, shuffle, strokesFrom, useGame, type Stroke } from "./common";

const clearMine = (kind: string, round: number, op: ReturnType<typeof useMeeting>["op"], extra: Record<string, unknown> = {}) => op("icebreaker.clear", { kind, round, ...extra });

// ── 12. Scavenger sprint ─────────────────────────────────────────────────
export function Scavenger() {
  const g = useGame();
  const prompt = SCAVENGER_PROMPTS[Number(g.data.prompt ?? 0) % SCAVENGER_PROMPTS.length];
  const finds = g.of("found");
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const iFound = finds.some((f) => f.mine);
  const next = () => {
    const s = { ...scores };
    finds.forEach((f, i) => (s[f.participantId] = (s[f.participantId] ?? 0) + Math.max(1, 3 - i)));
    void g.setData({ prompt: Math.floor(Math.random() * SCAVENGER_PROMPTS.length), scores: s }, { round: g.round + 1 });
  };
  return (
    <Stage title="Find it!" subtitle="Race to find a real-world item that matches the prompt, then show it on camera." controls={g.isFac && <Button onClick={next}>Next item</Button>}>
      <p className="rounded-3xl border-2 border-dashed border-primary p-8 text-center text-3xl font-bold">{prompt}</p>
      {!iFound ? (
        <div className="flex justify-center"><Button size="lg" onClick={() => void g.submit("found", { at: Date.now() })}>Found it! 🙌</Button></div>
      ) : (
        <p className="text-center text-emerald-600"><Check className="inline size-4" /> Nice! Show everyone on camera.</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {finds.map((f, i) => <PlayerChip key={f.id} pid={f.participantId} g={g}>#{i + 1}</PlayerChip>)}
      </div>
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

// ── 13. Speed sketch ─────────────────────────────────────────────────────
export function SpeedSketch() {
  const g = useGame();
  const { op } = useMeeting();
  const drawer = g.data.drawer as string | undefined;
  const word = SKETCH_WORDS[Number(g.data.word ?? 0) % SKETCH_WORDS.length];
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const strokes = strokesFrom(g.of("stroke"));
  const guesses = g.of("guess");
  const correct = [...new Map(guesses.filter((x) => norm(String(x.payload.text)) === norm(word)).map((c) => [c.participantId, c])).values()];
  const isDrawer = g.me?.id === drawer;
  const revealed = !!g.data.revealed;
  const next = () => {
    const s = { ...scores };
    correct.forEach((c, i) => (s[c.participantId] = (s[c.participantId] ?? 0) + Math.max(1, 3 - i)));
    if (drawer && correct.length) s[drawer] = (s[drawer] ?? 0) + 2;
    const order = g.players.map((p) => p.id);
    const nextDrawer = order[(order.indexOf(drawer ?? "") + 1) % order.length];
    void g.setData({ drawer: nextDrawer, word: Math.floor(Math.random() * SKETCH_WORDS.length), scores: s, revealed: false }, { round: g.round + 1 });
  };
  if (!drawer) return <Stage title="Speed sketch" subtitle="Draw fast, guess faster." controls={g.isFac && <Button onClick={next}>Start</Button>}><p className="text-center text-muted-foreground">Waiting for the facilitator to start…</p></Stage>;
  return (
    <Stage title={isDrawer ? `Draw: ${word}` : revealed ? `It was: ${word}` : `${g.name(drawer)} is drawing…`} subtitle={isDrawer ? "No letters or numbers!" : "Type your guess"} controls={g.isFac && (
      <>
        {!revealed && <Button variant="outline" onClick={() => void g.setData({ revealed: true })}>Reveal word</Button>}
        <Button onClick={next}>Next drawer</Button>
      </>
    )}>
      <DrawPad strokes={strokes} readOnly={!isDrawer} onStroke={(s) => void g.submit("stroke", s as unknown as Record<string, unknown>)} onClear={() => void clearMine("stroke", g.round, op)} />
      {!isDrawer && !revealed && !correct.some((c) => c.mine) && <TextSubmit placeholder="Your guess…" onSubmit={(t) => void g.submit("guess", { text: t })} />}
      {correct.some((c) => c.mine) && <p className="text-center text-emerald-600">You got it!</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {correct.map((c, i) => <PlayerChip key={c.id} pid={c.participantId} g={g}>#{i + 1}</PlayerChip>)}
      </div>
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

/** Rotation helper: who is working on chain `owner` at step `step`. */
function chainFor(order: string[], me: string, step: number) {
  const i = order.indexOf(me);
  return order[(i - step + order.length * 10) % order.length];
}

// ── 14. Sketch relay (telephone) ────────────────────────────────────────
export function SketchRelay() {
  const g = useGame();
  const order = (g.data.order as string[]) ?? [];
  const step = Number(g.data.step ?? 0);
  const steps = Number(g.data.steps ?? Math.min(5, Math.max(3, order.length)));
  const me = g.me?.id ?? "";
  const owner = order.length ? chainFor(order, me, step) : "";
  const kind = step === 0 ? "write" : step % 2 === 1 ? "draw" : "guess";
  const prev = g.entries.filter((e) => e.round === step - 1 && e.payload.owner === owner);
  const myDone = g.entries.some((e) => e.round === step && e.mine && e.payload.owner === owner && (e.kind === "text" || e.kind === "done"));
  const myStrokes = strokesFrom(g.entries.filter((e) => e.round === step && e.mine && e.payload.owner === owner));
  const [mine, setMine] = useState<Stroke[]>([]);
  const done = new Set(g.entries.filter((e) => e.round === step && (e.kind === "text" || e.kind === "done")).map((e) => e.participantId)).size;
  if (!order.length) {
    return <Stage title="Sketch relay" subtitle="Write a phrase, draw it, guess it, and watch ideas transform." controls={g.isFac && <Button disabled={g.players.length < 3} onClick={() => void g.setData({ order: shuffle(g.players.map((p) => p.id)), step: 0, steps: Math.min(5, Math.max(3, g.players.length)) }, { phase: "play", round: 0 })}>Start (3+ players)</Button>}><p className="text-center text-muted-foreground">Waiting to start…</p></Stage>;
  }
  if (step >= steps) {
    return (
      <Stage title="The results!" subtitle="See how each phrase transformed." controls={g.isFac && <Button variant="outline" onClick={() => void g.set({ data: {}, phase: "lobby", round: 0, clearEntries: true })}>Play again</Button>}>
        <div className="space-y-6">
          {order.map((o) => (
            <div key={o} className="space-y-2 rounded-2xl border bg-card p-4">
              <p className="font-semibold">{g.name(o)}&apos;s chain</p>
              {Array.from({ length: steps }, (_, s) => {
                const items = g.entries.filter((e) => e.round === s && e.payload.owner === o);
                const text = items.find((e) => e.kind === "text");
                const st = strokesFrom(items);
                return (
                  <div key={s} className="text-sm">
                    {text ? <p className="rounded-xl bg-muted px-3 py-2">“{String(text.payload.text)}” — {g.name(text.participantId)}</p> : st.length ? <DrawPad strokes={st} readOnly className="max-w-md" /> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Stage>
    );
  }
  const prevText = prev.find((e) => e.kind === "text");
  const prevStrokes = strokesFrom(prev);
  return (
    <Stage title={kind === "write" ? "Write a phrase for someone to draw" : kind === "draw" ? `Draw: “${String(prevText?.payload.text ?? "")}”` : "What is this drawing?"} subtitle={`Step ${step + 1} of ${steps}`} controls={g.isFac && <Button onClick={() => void g.setData({ step: step + 1 }, { round: step + 1 })}>{step + 1 >= steps ? "Show results" : "Next step"}</Button>}>
      {kind === "guess" && <DrawPad strokes={prevStrokes} readOnly />}
      {myDone ? (
        <p className="text-center text-emerald-600"><Check className="inline size-4" /> Done! Waiting for others…</p>
      ) : kind === "draw" ? (
        <>
          <DrawPad strokes={[...myStrokes, ...mine]} onStroke={(s) => { setMine((m) => [...m, s]); void g.submit("stroke", { ...s, owner } as unknown as Record<string, unknown>); }} />
          <div className="flex justify-center"><Button onClick={() => void g.submit("done", { owner })}>I&apos;m done drawing</Button></div>
        </>
      ) : (
        <TextSubmit placeholder={kind === "write" ? "eg. A cat running a marathon" : "Your guess…"} onSubmit={(t) => void g.submit("text", { text: t, owner })} />
      )}
      <Waiting done={done} total={order.length} label="done" />
    </Stage>
  );
}

// ── 15. Creative canvas ──────────────────────────────────────────────────
export function CreativeCanvas() {
  const g = useGame();
  const order = (g.data.order as string[]) ?? [];
  const pass = Number(g.data.pass ?? 0);
  const passes = Number(g.data.passes ?? 3);
  const prompt = SKETCH_WORDS[Number(g.data.prompt ?? 0) % SKETCH_WORDS.length];
  const me = g.me?.id ?? "";
  const canvas = order.length ? chainFor(order, me, pass) : "";
  const strokes = strokesFrom(g.entries.filter((e) => e.kind === "stroke" && e.payload.canvas === canvas));
  if (!order.length) return <Stage title="Creative canvas" subtitle="Draw on a prompt, pass it on, and watch each canvas evolve." controls={g.isFac && <Button disabled={g.players.length < 2} onClick={() => void g.setData({ order: shuffle(g.players.map((p) => p.id)), pass: 0, passes: Math.min(4, g.players.length), prompt: Math.floor(Math.random() * SKETCH_WORDS.length) })}>Start</Button>}><p className="text-center text-muted-foreground">Waiting to start…</p></Stage>;
  if (pass >= passes) {
    return (
      <Stage title={`Gallery: ${prompt}`} controls={g.isFac && <Button variant="outline" onClick={() => void g.set({ data: {}, round: 0, clearEntries: true })}>Play again</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          {order.map((o) => (
            <div key={o} className="space-y-1">
              <DrawPad strokes={strokesFrom(g.entries.filter((e) => e.kind === "stroke" && e.payload.canvas === o))} readOnly />
              <p className="text-center text-xs text-muted-foreground">Started by {g.name(o)}</p>
            </div>
          ))}
        </div>
      </Stage>
    );
  }
  return (
    <Stage title={pass === 0 ? `Draw: ${prompt}` : `Keep going on ${g.name(canvas)}'s canvas`} subtitle={`Pass ${pass + 1} of ${passes}`} controls={g.isFac && <Button onClick={() => void g.setData({ pass: pass + 1 })}>{pass + 1 >= passes ? "Show gallery" : "Pass the canvas"}</Button>}>
      <DrawPad strokes={strokes} onStroke={(s) => void g.submit("stroke", { ...s, canvas } as unknown as Record<string, unknown>)} />
    </Stage>
  );
}

// ── 16. Story builder ────────────────────────────────────────────────────
export function StoryBuilder() {
  const g = useGame();
  const order = (g.data.order as string[]) ?? [];
  const starter = STORY_STARTERS[Number(g.data.starter ?? 0) % STORY_STARTERS.length];
  const words = g.of("word");
  const turn = order[words.length % Math.max(1, order.length)];
  const myTurn = turn === g.me?.id;
  return (
    <Stage title="Story builder" subtitle="Write a story together, one word at a time." controls={g.isFac && <Button variant={order.length ? "outline" : "default"} onClick={() => void g.setData({ order: shuffle(g.players.map((p) => p.id)), starter: Math.floor(Math.random() * STORY_STARTERS.length) }, { round: g.round + 1 })}>{order.length ? "New story" : "Start"}</Button>}>
      <p className="rounded-3xl border bg-card p-6 text-xl leading-relaxed">
        <span className="text-muted-foreground">{starter} </span>
        {words.map((w) => (
          <span key={w.id} title={g.name(w.participantId)} style={{ textDecorationColor: g.color(w.participantId) }} className="underline decoration-2 underline-offset-4">{String(w.payload.word)} </span>
        ))}
      </p>
      {order.length > 0 && (myTurn ? <TextSubmit placeholder="Your word…" button="Add" onSubmit={(t) => void g.submit("word", { word: t.split(/\s+/)[0] })} /> : <p className="text-center text-sm text-muted-foreground">It&apos;s {g.name(turn)}&apos;s turn…</p>)}
    </Stage>
  );
}

// ── 17. Imposter ─────────────────────────────────────────────────────────
export function Imposter() {
  const g = useGame();
  const category = g.data.category as string | undefined;
  const word = g.data.word as string | undefined;
  const imposter = g.data.imposter as string | undefined;
  const amImposter = !!g.data.youAreImposter;
  const clues = g.of("clue");
  const votes = g.of("vote");
  const [hide, setHide] = useState(false);
  const start = () => {
    const set = IMPOSTER_WORDS[Math.floor(Math.random() * IMPOSTER_WORDS.length)];
    const w = set.words[Math.floor(Math.random() * set.words.length)];
    const imp = g.players[Math.floor(Math.random() * g.players.length)]?.id;
    void g.setData({ category: set.category, word: w, imposter: imp }, { phase: "clue", round: g.round + 1 });
  };
  if (!category) return <Stage title="Imposter" subtitle="Everyone gets a secret word except the imposter. Give a clue, spot the imposter, don't get caught." controls={g.isFac && <Button disabled={g.players.length < 3} onClick={start}>Start (3+ players)</Button>}><p className="text-center text-muted-foreground">Waiting to start…</p></Stage>;
  const tally = (pid: string) => votes.filter((v) => v.payload.who === pid).length;
  return (
    <Stage title={`Category: ${category}`} subtitle={g.phase === "reveal" ? `The imposter was ${g.name(imposter)}! The word was “${word}”.` : g.phase === "vote" ? "Who is the imposter?" : "Give a one-word clue about the secret word"} controls={g.isFac && (
      <>
        {g.phase === "clue" && <Button onClick={() => void g.set({ phase: "vote" })}>Start voting</Button>}
        {g.phase === "vote" && <Button onClick={() => void g.set({ phase: "reveal" })}>Reveal</Button>}
        {g.phase === "reveal" && <Button onClick={start}>New round</Button>}
      </>
    )}>
      {g.phase !== "reveal" && (
        <div className="mx-auto max-w-sm rounded-2xl border-2 border-dashed p-5 text-center">
          <button type="button" onClick={() => setHide(!hide)} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">{hide ? <Eye className="size-3" /> : <EyeOff className="size-3" />} {hide ? "Show" : "Hide"}</button>
          {!hide && <p className="text-2xl font-bold">{amImposter ? "You are the imposter 🤫" : word}</p>}
        </div>
      )}
      {g.phase === "clue" && !clues.some((c) => c.mine) && <TextSubmit placeholder="Your clue…" onSubmit={(t) => void g.submit("clue", { text: t.split(/\s+/).slice(0, 3).join(" ") })} />}
      <div className="grid gap-2 sm:grid-cols-2">
        {g.players.map((p) => {
          const clue = clues.find((c) => c.participantId === p.id);
          const voted = votes.find((v) => v.mine)?.payload.who === p.id;
          return (
            <button key={p.id} type="button" disabled={g.phase !== "vote" || p.id === g.me?.id} onClick={() => void g.submit("vote", { who: p.id }, { replace: true })} className={cn("flex items-center gap-2 rounded-2xl border bg-card p-3 text-left", voted && "border-primary ring-2 ring-primary/30", g.phase === "reveal" && p.id === imposter && "border-red-500 bg-red-500/10")}>
              <PlayerChip pid={p.id} g={g} />
              <span className="flex-1 font-medium">{clue ? String(clue.payload.text) : g.phase === "clue" ? "…" : ""}</span>
              {g.phase === "reveal" && <span className="text-xs text-muted-foreground">{tally(p.id)} votes</span>}
            </button>
          );
        })}
      </div>
    </Stage>
  );
}

// ── 18. Teams Against Agility ────────────────────────────────────────────
export function Agility() {
  const g = useGame();
  const judge = g.data.judge as string | undefined;
  const prompt = AGILITY_PROMPTS[Number(g.data.prompt ?? 0) % AGILITY_PROMPTS.length];
  const hands = (g.data.hands as Record<string, number[]>) ?? {};
  const scores = (g.data.scores as Record<string, number>) ?? {};
  const subs = g.of("play");
  const winner = g.data.winner as string | undefined;
  const isJudge = g.me?.id === judge;
  const myHand = hands[g.me?.id ?? ""] ?? [];
  const shuffledSubs = useMemo(() => shuffle(subs), [subs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const deal = (nextJudge?: string) => {
    const deck = pickIndexes(g.players.length * 5, AGILITY_ANSWERS.length);
    const h: Record<string, number[]> = {};
    g.players.forEach((p, i) => (h[p.id] = deck.slice(i * 5, i * 5 + 5).map((x) => x % AGILITY_ANSWERS.length)));
    const order = g.players.map((p) => p.id);
    const j = nextJudge ?? order[(order.indexOf(judge ?? "") + 1) % order.length];
    void g.setData({ hands: h, judge: j, prompt: Math.floor(Math.random() * AGILITY_PROMPTS.length), winner: null }, { phase: "play", round: g.round + 1 });
  };
  if (!judge) return <Stage title="Teams Against Agility" subtitle="A cheeky card game where the best answer wins." controls={g.isFac && <Button disabled={g.players.length < 3} onClick={() => deal(g.players[0]?.id)}>Deal cards (3+ players)</Button>}><p className="text-center text-muted-foreground">Waiting to deal…</p></Stage>;
  return (
    <Stage title={prompt.replace("___", "_____")} subtitle={winner ? `${g.name(subs.find((s) => s.id === winner)?.participantId)} wins the round!` : isJudge ? "You're the judge this round. Pick your favorite once everyone has played." : `${g.name(judge)} is judging`} controls={g.isFac && winner && <Button onClick={() => deal()}>Next round</Button>}>
      {!isJudge && !subs.some((s) => s.mine) && (
        <div className="grid gap-2 sm:grid-cols-5">
          {myHand.map((c) => (
            <button key={c} type="button" onClick={() => void g.submit("play", { card: c })} className="min-h-28 rounded-xl border-2 bg-white p-3 text-left text-sm font-semibold text-black shadow transition hover:-translate-y-1">
              {AGILITY_ANSWERS[c]}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {shuffledSubs.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={!isJudge || !!winner || subs.length < g.players.length - 1}
            onClick={() => void g.setData({ winner: s.id, scores: { ...scores, [s.participantId]: (scores[s.participantId] ?? 0) + 1 } })}
            className={cn("min-h-24 rounded-xl border-2 bg-white p-3 text-left text-sm font-semibold text-black", winner === s.id && "ring-4 ring-amber-400")}
          >
            {subs.length >= g.players.length - 1 || s.mine ? AGILITY_ANSWERS[Number(s.payload.card)] : "🂠"}
            {winner && <span className="mt-2 block text-xs font-normal text-gray-600">{g.name(s.participantId)}</span>}
          </button>
        ))}
      </div>
      <Waiting done={subs.length} total={g.players.length - 1} label="played" />
      <Scoreboard scores={scores} g={g} />
    </Stage>
  );
}

// ── 19. Franken-draw ─────────────────────────────────────────────────────
const PARTS = ["head", "body", "legs"] as const;
export function FrankenDraw() {
  const g = useGame();
  const creatures = (g.data.creatures as string[][]) ?? [];
  const revealed = !!g.data.revealed;
  const me = g.me?.id ?? "";
  const mine = creatures.flatMap((c, ci) => c.map((pid, pi) => (pid === me ? { ci, part: PARTS[pi] } : null))).filter(Boolean) as { ci: number; part: (typeof PARTS)[number] }[];
  const start = () => {
    const ids = shuffle(g.players.map((p) => p.id));
    const n = Math.max(1, Math.floor(ids.length / 3) || 1);
    const out: string[][] = [];
    for (let i = 0; i < n; i++) out.push([ids[(i * 3) % ids.length], ids[(i * 3 + 1) % ids.length], ids[(i * 3 + 2) % ids.length]]);
    void g.setData({ creatures: out, revealed: false }, { round: g.round + 1 });
  };
  return (
    <Stage title="Franken-draw" subtitle={revealed ? "Behold your creatures!" : "Draw your part of a creature without seeing the others."} controls={g.isFac && (creatures.length ? (revealed ? <Button onClick={start}>New creatures</Button> : <Button onClick={() => void g.setData({ revealed: true })}>Reveal creatures</Button>) : <Button onClick={start}>Start</Button>)}>
      {!revealed &&
        mine.map((m) => (
          <div key={`${m.ci}-${m.part}`} className="space-y-1">
            <p className="text-center font-semibold">Creature {m.ci + 1}: draw the <span className="text-primary">{m.part}</span></p>
            <DrawPad strokes={strokesFrom(g.of("stroke").filter((e) => e.payload.creature === m.ci && e.payload.part === m.part))} onStroke={(s) => void g.submit("stroke", { ...s, creature: m.ci, part: m.part } as unknown as Record<string, unknown>)} />
          </div>
        ))}
      {revealed && (
        <div className="grid gap-4 sm:grid-cols-2">
          {creatures.map((c, ci) => (
            <div key={ci} className="overflow-hidden rounded-2xl border">
              {PARTS.map((part) => (
                <DrawPad key={part} strokes={strokesFrom(g.of("stroke").filter((e) => e.payload.creature === ci && e.payload.part === part))} readOnly className="[&_svg]:rounded-none [&_svg]:border-0" />
              ))}
              <p className="p-2 text-center text-xs text-muted-foreground">{c.map((pid) => g.name(pid)).join(" · ")}</p>
            </div>
          ))}
        </div>
      )}
    </Stage>
  );
}

// ── 20. Pitch tank ───────────────────────────────────────────────────────
export function PitchTank() {
  const g = useGame();
  const cards = (g.data.cards as Record<string, [number, number, number]>) ?? {};
  const pitches = g.entries.filter((e) => e.kind === "pitch");
  const votes = g.entries.filter((e) => e.kind === "vote");
  const mine = cards[g.me?.id ?? ""];
  const tally = (pid: string) => votes.filter((v) => v.payload.who === pid).length;
  const deal = () => {
    const c: Record<string, [number, number, number]> = {};
    for (const p of g.players) c[p.id] = [Math.floor(Math.random() * PITCH_PRODUCTS.length), Math.floor(Math.random() * PITCH_AUDIENCES.length), Math.floor(Math.random() * PITCH_TWISTS.length)];
    void g.setData({ cards: c }, { phase: "prepare", clearEntries: true });
  };
  return (
    <Stage title="Pitch tank" subtitle={g.phase === "vote" ? "Vote for the best pitch" : "Pitch your best idea with the prompts provided"} controls={g.isFac && (
      <>
        <Button variant={Object.keys(cards).length ? "outline" : "default"} onClick={deal}>{Object.keys(cards).length ? "Deal again" : "Deal prompts"}</Button>
        {g.phase === "prepare" && <Button onClick={() => void g.set({ phase: "vote" })}>Start voting</Button>}
      </>
    )}>
      {mine && g.phase === "prepare" && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-primary/10 p-4 text-center font-semibold">{PITCH_PRODUCTS[mine[0]]}</div>
            <div className="rounded-2xl bg-amber-500/10 p-4 text-center font-semibold">for {PITCH_AUDIENCES[mine[1]]}</div>
            <div className="rounded-2xl bg-emerald-500/10 p-4 text-center font-semibold">{PITCH_TWISTS[mine[2]]}</div>
          </div>
          {!pitches.some((p) => p.mine) ? <TextSubmit multiline placeholder="Your one-line pitch (then present it live!)" onSubmit={(t) => void g.submit("pitch", { text: t }, { round: 0 })} /> : <p className="text-center text-emerald-600">Pitch saved. Get ready to present!</p>}
        </div>
      )}
      {g.phase === "vote" && (
        <div className="space-y-2">
          {g.players.map((p) => {
            const pitch = pitches.find((x) => x.participantId === p.id);
            const c = cards[p.id];
            return (
              <button key={p.id} type="button" disabled={p.id === g.me?.id} onClick={() => void g.submit("vote", { who: p.id }, { replace: true, round: 0 })} className={cn("w-full rounded-2xl border bg-card p-4 text-left", votes.find((v) => v.mine)?.payload.who === p.id && "border-primary ring-2 ring-primary/30")}>
                <p className="text-sm text-muted-foreground">{g.name(p.id)} · {c ? `${PITCH_PRODUCTS[c[0]]} for ${PITCH_AUDIENCES[c[1]]}` : ""}</p>
                <p className="text-lg">{pitch ? String(pitch.payload.text) : "(pitching live)"}</p>
                <p className="text-xs text-muted-foreground">{tally(p.id)} votes</p>
              </button>
            );
          })}
        </div>
      )}
    </Stage>
  );
}

// ── 21. Whose slide is it anyway? ────────────────────────────────────────
export function WhoseSlide() {
  const g = useGame();
  const presenter = g.data.presenter as string | undefined;
  const slides = (g.data.slides as number[]) ?? [];
  const cur = Number(g.data.current ?? 0);
  const slide = SLIDE_PROMPTS[slides[cur] ?? 0];
  const nextPresenter = () => {
    const order = g.players.map((p) => p.id);
    const p = order[(order.indexOf(presenter ?? "") + 1) % order.length];
    void g.setData({ presenter: p, slides: pickIndexes(4, SLIDE_PROMPTS.length), current: 0 });
  };
  if (!presenter) return <Stage title="Whose slide is it anyway?" subtitle="Improvise a presentation with random slides." controls={g.isFac && <Button onClick={nextPresenter}>Start</Button>}><p className="text-center text-muted-foreground">Waiting to start…</p></Stage>;
  return (
    <Stage title={`${g.name(presenter)} is presenting`} subtitle={`Slide ${cur + 1} of ${slides.length}`} controls={(g.isFac || g.me?.id === presenter) && (
      <>
        <Button disabled={cur + 1 >= slides.length} onClick={() => void g.setData({ current: cur + 1 })}>Next slide</Button>
        {g.isFac && <Button variant="outline" onClick={nextPresenter}>Next presenter</Button>}
      </>
    )}>
      <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-3xl border-4 border-foreground/10 bg-gradient-to-br from-primary/10 to-pink-500/10 p-8 text-center shadow-lg">
        <span className="text-8xl">{slide.emoji}</span>
        <p className="text-3xl font-bold text-balance">{slide.title}</p>
      </div>
    </Stage>
  );
}

export function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}
