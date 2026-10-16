import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, GitBranch, HeartPulse, LayoutGrid, Lock, MessagesSquare, Plug, Server, Sparkles, Spade, Users, Vote } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/";

const MEETINGS = [
  {
    icon: LayoutGrid,
    title: "Retrospectives",
    body: "Brainstorm privately, group similar ideas, dot-vote and talk through what matters. Over 70 templates or your own topics.",
    color: "from-violet-500 to-indigo-500",
  },
  {
    icon: MessagesSquare,
    title: "Standups",
    body: "Recurring standups people can fill in on their own time, with carry-over of yesterday's plans and blockers.",
    color: "from-sky-500 to-cyan-500",
  },
  {
    icon: HeartPulse,
    title: "Health checks",
    body: "Self-assessed team health with 15 ready-made models, radar charts and trends over time.",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: Spade,
    title: "Estimations",
    body: "Planning poker with any deck. Import from Jira, Linear, GitHub and more, and sync estimates back.",
    color: "from-amber-500 to-orange-500",
  },
];

const FEATURES = [
  { icon: Lock, title: "Anonymity you control", body: "Names, aliases or fully anonymous. Hidden ideas and votes until you choose to reveal them." },
  { icon: Vote, title: "Facilitation built in", body: "Timers, presenting mode, live reactions, raised hands, check-in questions and 20+ icebreaker games." },
  { icon: CheckCircle2, title: "Actions that follow through", body: "Assign actions, agreements and parking-lot items, get reminders, and review them at the next meeting." },
  { icon: Bot, title: "Optional AI with Claude", body: "Grouping and action suggestions, summaries, generated templates and a meeting assistant." },
  { icon: Plug, title: "Integrations", body: "Jira, Linear, GitHub, GitLab, Azure DevOps, Trello, Asana, Slack, Teams, Notion, webhooks and more." },
  { icon: Users, title: "Organizations & insights", body: "Teams, programs, roles, transparency, cross-team insights, a REST API and an MCP server." },
];

export default async function Landing() {
  const user = await getCurrentUser();
  const signedIn = !!user && !user.isGuest;
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav className="ml-6 hidden gap-5 text-sm text-muted-foreground md:flex">
            <a href="#meetings" className="hover:text-foreground">Meetings</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#self-host" className="hover:text-foreground">Self-host</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer"><GitBranch /> <span className="hidden sm:inline">GitHub</span></a>
            </Button>
            {signedIn ? (
              <Button size="sm" asChild><Link href="/home">Open WeRetro <ArrowRight /></Link></Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild><Link href="/login">Sign in</Link></Button>
                <Button size="sm" asChild><Link href="/signup">Get started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:pt-28">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Open source · self-hostable · free
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Better team meetings, <span className="bg-gradient-to-r from-[#6D5DF6] to-[#E0569B] bg-clip-text text-transparent">together</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
            WeRetro runs your retrospectives, standups, health checks and estimations in one place, so your team can reflect, decide and follow through.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={signedIn ? "/home" : "/signup"}>{signedIn ? "Go to your teams" : "Start for free"} <ArrowRight /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#self-host"><Server /> Host it yourself</a>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-20">
          <BoardPreview />
        </div>
      </section>

      <section id="meetings" className="border-t bg-canvas py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Four meetings, one workflow</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">Every meeting shares the same actions, agreements and parking lot, so nothing gets lost between them.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MEETINGS.map((m) => (
              <div key={m.title} className="rounded-2xl border bg-card p-6">
                <span className={`inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${m.color} text-white`}>
                  <m.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{m.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Everything a facilitator needs</h2>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="self-host" className="border-t bg-canvas py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Run it on your own infrastructure</h2>
            <p className="mt-3 text-muted-foreground">WeRetro is a single Next.js app with a Postgres database. Deploy it to Vercel with Neon in a few minutes, or run it anywhere Node.js runs.</p>
            <ul className="mt-6 space-y-2 text-sm">
              {["MIT licensed", "Postgres (Neon or any Postgres 14+)", "Email via any SMTP server", "Sign in with Google, GitHub or Microsoft", "Bring your own Anthropic API key for AI features"].map((x) => (
                <li key={x} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> {x}</li>
              ))}
            </ul>
          </div>
          <pre className="overflow-x-auto rounded-2xl border bg-zinc-950 p-5 text-sm leading-relaxed text-zinc-100">
            <code>{`git clone ${REPO_URL.replace(/\/$/, "")}/weretro
cd weretro && pnpm install
cp .env.example .env.local   # add DATABASE_URL
pnpm db:push
pnpm dev`}</code>
          </pre>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-sm text-muted-foreground">
          <Logo className="text-foreground" />
          <span>Open-source agile meetings.</span>
          <a href={REPO_URL} className="ml-auto hover:text-foreground" target="_blank" rel="noreferrer">Source code</a>
          <Link href="/docs/api" className="hover:text-foreground">API</Link>
        </div>
      </footer>
    </div>
  );
}

function BoardPreview() {
  const cols = [
    { title: "What went well?", color: "#22C55E", cards: ["Release went out smoothly", "Great pairing sessions", "Faster code reviews"] },
    { title: "What could be better?", color: "#EF4444", cards: ["Too many meetings", "Flaky CI pipeline"] },
    { title: "What will we try?", color: "#6366F1", cards: ["No-meeting Wednesday", "Rotate standup host", "Write decisions down"] },
  ];
  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-primary/10">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <div className="ml-4 flex gap-1 text-xs font-semibold tracking-wide uppercase">
          {["Brainstorm", "Group", "Vote", "Discuss"].map((s, i) => (
            <span key={s} className={i === 2 ? "rounded-md bg-primary px-2 py-1 text-primary-foreground" : "px-2 py-1 text-muted-foreground"}>{s}</span>
          ))}
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {cols.map((c) => (
          <div key={c.title} className="space-y-2">
            <p className="text-sm font-semibold">{c.title}</p>
            {c.cards.map((t, i) => (
              <div key={t} className="flex items-center justify-between rounded-xl border-l-4 bg-muted/60 px-3 py-2.5 text-sm" style={{ borderLeftColor: c.color }}>
                {t}
                {i === 0 && <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{3 - cols.indexOf(c)}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
