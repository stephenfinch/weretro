import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { unauthorized } from "@/server/http";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const q = req.nextUrl.searchParams.get("q") || "celebrate";
  if (process.env.GIPHY_API_KEY) {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`);
    const json = await res.json();
    return NextResponse.json({
      provider: "GIPHY",
      results: (json.data ?? []).map((g: { id: string; title: string; images: { fixed_width: { url: string }; original: { url: string } } }) => ({ id: g.id, title: g.title, preview: g.images.fixed_width.url, url: g.images.original.url })),
    });
  }
  if (process.env.TENOR_API_KEY) {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?key=${process.env.TENOR_API_KEY}&q=${encodeURIComponent(q)}&limit=24&contentfilter=high&media_filter=gif,tinygif`);
    const json = await res.json();
    return NextResponse.json({
      provider: "Tenor",
      results: (json.results ?? []).map((g: { id: string; content_description: string; media_formats: { gif: { url: string }; tinygif: { url: string } } }) => ({ id: g.id, title: g.content_description, preview: g.media_formats.tinygif.url, url: g.media_formats.gif.url })),
    });
  }
  return NextResponse.json({ provider: null, results: [], message: "Set GIPHY_API_KEY or TENOR_API_KEY to enable GIF search" });
}
