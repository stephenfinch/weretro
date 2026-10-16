import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo href="/" className="text-white [&_span_span]:text-white/80" />
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight text-balance">Better meetings for teams that keep getting better.</h1>
          <p className="max-w-md text-lg text-white/80">
            Retrospectives, standups, health checks and planning poker in one open-source tool. Anonymous when it needs to be, actionable always.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3 text-sm">
            {["Anonymous brainstorming", "Dot voting & grouping", "Action tracking", "Team health radar", "Planning poker", "Async standups"].map((f) => (
              <div key={f} className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">{f}</div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/60">Free and open source.</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -top-16 right-24 size-48 rounded-full bg-white/10" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
