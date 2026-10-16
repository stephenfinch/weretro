import { Button } from "@/components/ui/button";

const PROVIDERS = [
  { id: "google", label: "Continue with Google", env: "GOOGLE_CLIENT_ID" },
  { id: "github", label: "Continue with GitHub", env: "GITHUB_CLIENT_ID" },
  { id: "microsoft", label: "Continue with Microsoft", env: "MICROSOFT_CLIENT_ID" },
];

export function OAuthButtons({ next }: { next?: string }) {
  const enabled = PROVIDERS.filter((p) => process.env[p.env]);
  if (!enabled.length) return null;
  return (
    <div className="space-y-2">
      {enabled.map((p) => (
        <Button key={p.id} variant="outline" className="w-full h-10" asChild>
          <a href={`/api/auth/${p.id}/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{p.label}</a>
        </Button>
      ))}
      <div className="relative py-2 text-center text-xs text-muted-foreground">
        <span className="bg-background px-2 relative z-10">or</span>
        <div className="absolute inset-x-0 top-1/2 border-t" />
      </div>
    </div>
  );
}
