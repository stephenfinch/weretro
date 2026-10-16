import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { generateHealthModel, generateTemplate, icebreakerQuestions } from "@/server/ai-features";
import { getOrgAccess, HttpError } from "@/server/access";
import { assertAiFeature } from "@/server/ai";
import { jsonError, unauthorized } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.isGuest) return unauthorized();
    const body = (await req.json()) as { kind: string; prompt: string; meetingType?: "retrospective" | "standup"; orgId?: string };
    if (!body.prompt?.trim()) throw new HttpError(400, "Describe what you want");
    const access = body.orgId ? await getOrgAccess(user, body.orgId) : null;
    if (!access) throw new HttpError(403, "Choose an organization");
    assertAiFeature(access.org, body.kind === "healthModel" ? "generateHealthModels" : body.kind === "icebreaker" ? "icebreakerQuestions" : "generateTemplates");
    if (body.kind === "template") return NextResponse.json(await generateTemplate(body.prompt, body.meetingType ?? "retrospective"));
    if (body.kind === "healthModel") return NextResponse.json(await generateHealthModel(body.prompt));
    if (body.kind === "icebreaker") return NextResponse.json({ questions: await icebreakerQuestions(body.prompt) });
    throw new HttpError(400, "Unknown kind");
  } catch (e) {
    return jsonError(e);
  }
}
