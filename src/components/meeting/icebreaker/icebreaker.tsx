"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brush,
  ChevronLeft,
  ChevronRight,
  Dices,
  Drama,
  Flag,
  GalleryHorizontal,
  HelpCircle,
  Layers,
  Link2,
  Loader2,
  MessageCircleQuestion,
  Palette,
  PenLine,
  Presentation,
  Search,
  Shuffle,
  SmilePlus,
  Sparkles,
  SplitSquareHorizontal,
  Spade,
  Target,
  UserSearch,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_QUESTIONS, QUESTION_CATEGORIES } from "@/lib/icebreaker-content";
import { useMeeting } from "../use-meeting";
import { useGame } from "./common";
import { Breakout, EmojiGuess, MissionBuilder, NamePicker, NicknamePrompt, Punchline, QuestionPick, QuickQuiz, TeamSpectrum, ThisOrThat, TwoTruths, WordAssociation } from "./games-a";
import { Agility, CreativeCanvas, FrankenDraw, Imposter, PitchTank, Scavenger, SketchRelay, SpeedSketch, StoryBuilder, WhoseSlide } from "./games-b";

type GameDef = { key: string; title: string; description: string; icon: typeof Dices; categories: string[]; difficulty: "Easy" | "Moderate" | "Challenging"; duration: "Quick" | "Medium" | "Long"; size: ("Small" | "Medium" | "Large")[]; C: () => React.ReactNode };

export const GAMES: GameDef[] = [
  { key: "namePicker", title: "Random Name Picker", description: "Spin the wheel and let fate decide who's next.", icon: Dices, categories: ["Fun", "Participation"], difficulty: "Easy", duration: "Quick", size: ["Small", "Medium", "Large"], C: NamePicker },
  { key: "breakout", title: "Breakout Groups", description: "Split everyone into groups, then fine-tune.", icon: Users, categories: ["Participation"], difficulty: "Easy", duration: "Quick", size: ["Medium", "Large"], C: Breakout },
  { key: "questions", title: "Icebreaker Questions", description: "Which question would you pick?", icon: MessageCircleQuestion, categories: ["Connection", "Discussion"], difficulty: "Easy", duration: "Quick", size: ["Small", "Medium", "Large"], C: QuestionPick },
  { key: "twoTruths", title: "Two Truths and a Lie", description: "Share 3 statements. Can others spot the lie?", icon: UserSearch, categories: ["Connection", "Fun"], difficulty: "Moderate", duration: "Medium", size: ["Small", "Medium"], C: TwoTruths },
  { key: "emojiGuess", title: "Emoji Guess", description: "Guess the answer, fastest wins.", icon: SmilePlus, categories: ["Competition", "Fun"], difficulty: "Easy", duration: "Quick", size: ["Small", "Medium", "Large"], C: EmojiGuess },
  { key: "quiz", title: "Quick Quiz", description: "Answer fast to score more points.", icon: HelpCircle, categories: ["Competition", "Thinking"], difficulty: "Moderate", duration: "Medium", size: ["Small", "Medium", "Large"], C: QuickQuiz },
  { key: "thisOrThat", title: "This or That", description: "Find out where people stand on a topic.", icon: SplitSquareHorizontal, categories: ["Fun", "Participation"], difficulty: "Easy", duration: "Quick", size: ["Small", "Medium", "Large"], C: ThisOrThat },
  { key: "spectrum", title: "Team Spectrum", description: "Guess where someone stands on a topic.", icon: Target, categories: ["Connection", "Competition"], difficulty: "Moderate", duration: "Medium", size: ["Small", "Medium"], C: TeamSpectrum },
  { key: "wordAssociation", title: "Word Association", description: "Build a word chain to reveal how your team thinks.", icon: Link2, categories: ["Creativity", "Energy"], difficulty: "Easy", duration: "Quick", size: ["Small", "Medium", "Large"], C: WordAssociation },
  { key: "mission", title: "Mission Builder", description: "Turn individual goals into one shared mission.", icon: Flag, categories: ["Discussion", "Thinking"], difficulty: "Moderate", duration: "Long", size: ["Small", "Medium"], C: MissionBuilder },
  { key: "punchline", title: "Punchline", description: "Write the best punchline to win the round.", icon: Drama, categories: ["Creativity", "Fun"], difficulty: "Moderate", duration: "Medium", size: ["Small", "Medium", "Large"], C: Punchline },
  { key: "scavenger", title: "Scavenger Sprint", description: "Race to find real-world items that match the prompt.", icon: Search, categories: ["Energy", "Competition"], difficulty: "Easy", duration: "Quick", size: ["Small", "Medium", "Large"], C: Scavenger },
  { key: "speedSketch", title: "Speed Sketch", description: "Draw fast, guess faster. Top the leaderboard!", icon: PenLine, categories: ["Creativity", "Competition"], difficulty: "Moderate", duration: "Medium", size: ["Small", "Medium"], C: SpeedSketch },
  { key: "sketchRelay", title: "Sketch Relay", description: "Draw, guess, and watch ideas transform.", icon: Shuffle, categories: ["Creativity", "Fun"], difficulty: "Moderate", duration: "Long", size: ["Small", "Medium"], C: SketchRelay },
  { key: "creativeCanvas", title: "Creative Canvas", description: "Draw on a prompt, pass it on, watch each canvas evolve.", icon: Palette, categories: ["Creativity"], difficulty: "Easy", duration: "Medium", size: ["Small", "Medium"], C: CreativeCanvas },
  { key: "storyBuilder", title: "Story Builder", description: "Write a story together, one word at a time.", icon: BookOpen, categories: ["Creativity", "Fun"], difficulty: "Easy", duration: "Medium", size: ["Small", "Medium"], C: StoryBuilder },
  { key: "imposter", title: "Imposter Syndrome", description: "Give a clue. Spot the imposter. Don't get caught.", icon: Layers, categories: ["Thinking", "Fun"], difficulty: "Challenging", duration: "Medium", size: ["Small", "Medium"], C: Imposter },
  { key: "agility", title: "Teams Against Agility", description: "A cheeky card game where the best answer wins.", icon: Spade, categories: ["Fun", "Competition"], difficulty: "Moderate", duration: "Long", size: ["Small", "Medium"], C: Agility },
  { key: "frankenDraw", title: "Franken-draw", description: "Draw a creature together, one part at a time.", icon: Brush, categories: ["Creativity", "Fun"], difficulty: "Easy", duration: "Medium", size: ["Small", "Medium", "Large"], C: FrankenDraw },
  { key: "pitchTank", title: "Pitch Tank", description: "Pitch your best idea with the prompts provided.", icon: Presentation, categories: ["Creativity", "Discussion"], difficulty: "Challenging", duration: "Long", size: ["Small", "Medium"], C: PitchTank },
  { key: "whoseSlide", title: "Whose Slide is it Anyway?", description: "Improvise a presentation with random slides.", icon: GalleryHorizontal, categories: ["Energy", "Fun"], difficulty: "Challenging", duration: "Medium", size: ["Small", "Medium"], C: WhoseSlide },
];

export function IcebreakerStep() {
  const { state, op } = useMeeting();
  const g = useGame();
  const ib = state.meeting.icebreaker ?? { mode: "game" };
  const mode = ib.mode ?? (state.meeting.steps.find((s) => s.key === "icebreaker")?.options?.mode as string) ?? "game";
  const game = GAMES.find((x) => x.key === ib.gameKey);
  const needsNick = state.meeting.anonymity !== "names" && state.me.participantId;
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto max-w-5xl space-y-5 pt-6">
        {g.isFac && (
          <div className="flex items-center gap-2">
            {game && (
              <Button variant="ghost" size="sm" onClick={() => void op("icebreaker.set", { gameKey: null, phase: "lobby", data: {} })}>
                <ArrowLeft /> All games
              </Button>
            )}
            <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => void op("icebreaker.set", { mode: mode === "game" ? "questions" : "game" })}>
              {mode === "game" ? "Prefer the classic question icebreaker? Switch" : "Switch to icebreaker games"}
            </button>
          </div>
        )}
        {mode === "questions" ? (
          <QuestionMode />
        ) : game ? (
          <>
            {needsNick && <NicknamePrompt g={g} />}
            <game.C />
          </>
        ) : g.isFac ? (
          <GamePicker onPick={(key) => void op("icebreaker.set", { gameKey: key, phase: "lobby", data: {} })} />
        ) : (
          <div className="py-20 text-center">
            <Dices className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-lg font-medium">Warming up…</p>
            <p className="text-muted-foreground">The facilitator is picking a game.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GamePicker({ onPick }: { onPick: (key: string) => void }) {
  const [cat, setCat] = useState("all");
  const [diff, setDiff] = useState("all");
  const [dur, setDur] = useState("all");
  const [size, setSize] = useState("all");
  const [q, setQ] = useState("");
  const list = GAMES.filter(
    (x) =>
      (cat === "all" || x.categories.includes(cat)) &&
      (diff === "all" || x.difficulty === diff) &&
      (dur === "all" || x.duration === dur) &&
      (size === "all" || x.size.includes(size as "Small")) &&
      (!q || `${x.title} ${x.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const filter = (value: string, set: (v: string) => void, label: string, options: string[]) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger size="sm" className="w-36"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: any</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  return (
    <div className="space-y-5">
      <h2 className="text-center text-2xl font-semibold">Pick a game for your team</h2>
      <div className="flex flex-wrap justify-center gap-2">
        {filter(cat, setCat, "Category", ["Competition", "Connection", "Creativity", "Discussion", "Energy", "Fun", "Participation", "Thinking"])}
        {filter(diff, setDiff, "Difficulty", ["Easy", "Moderate", "Challenging"])}
        {filter(dur, setDur, "Duration", ["Quick", "Medium", "Long"])}
        {filter(size, setSize, "Group size", ["Small", "Medium", "Large"])}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((x) => (
          <button key={x.key} type="button" onClick={() => onPick(x.key)} className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-5 text-center transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
            <x.icon className="size-8 text-primary transition group-hover:scale-110" />
            <span className="font-semibold">{x.title}</span>
            <span className="text-xs text-muted-foreground">{x.description}</span>
            <span className="mt-auto text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{x.difficulty} · {x.duration}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionMode() {
  const { state, op } = useMeeting();
  const ib = state.meeting.icebreaker ?? { mode: "questions" };
  const fac = state.me.isFacilitator;
  const [custom, setCustom] = useState("");
  const [theme, setTheme] = useState("");
  const [ai, setAi] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const category = ib.category ?? "Random";
  const pool = useMemo(() => (category === "Random" ? ALL_QUESTIONS : QUESTION_CATEGORIES[category] ?? ALL_QUESTIONS), [category]);
  const history = ib.history ?? [];
  const question = ib.question ?? null;
  const pick = (q: string) => void op("icebreaker.set", { question: q, history: [...history, q].slice(-30) });
  const next = () => {
    const options = pool.filter((q) => !history.includes(q));
    pick((options.length ? options : pool)[Math.floor(Math.random() * (options.length || pool.length))]);
  };
  const prev = () => {
    if (history.length < 2) return;
    void op("icebreaker.set", { question: history[history.length - 2], history: history.slice(0, -1) });
  };
  return (
    <div className="space-y-6 py-6 text-center">
      <div className="mx-auto flex min-h-56 max-w-3xl items-center justify-center rounded-3xl bg-brand-gradient p-10 text-white shadow-lg">
        <p className="text-3xl font-semibold text-balance">{question ?? "Ready for a question?"}</p>
      </div>
      {fac && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={prev} disabled={history.length < 2} aria-label="Previous question"><ChevronLeft /></Button>
            <Select value={category} onValueChange={(v) => void op("icebreaker.set", { category: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Random">Random</SelectItem>
                {Object.keys(QUESTION_CATEGORIES).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={next}>Next question <ChevronRight /></Button>
          </div>
          <form className="mx-auto flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) pick(custom.trim()); setCustom(""); }}>
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your icebreaker question…" />
            <Button type="submit" variant="outline">Use</Button>
          </form>
          {state.team.ai.icebreakerQuestions && (
            <div className="mx-auto max-w-lg space-y-2 rounded-2xl border p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-primary" /> AI icebreakers</p>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const res = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "icebreaker", prompt: theme || "team building", orgId: state.team.orgId }) });
                  const json = await res.json();
                  setBusy(false);
                  if (!res.ok) return void toast.error(json.error);
                  setAi(json.questions);
                }}
              >
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Theme, eg. space travel" />
                <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Generate"}</Button>
              </form>
              {ai?.map((q) => (
                <button key={q} type="button" onClick={() => pick(q)} className={cn("block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted", q === question && "bg-primary/10")}>{q}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
