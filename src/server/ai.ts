import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { HttpError } from "./access";

/**
 * All AI features call Claude through the official Anthropic SDK. They are optional:
 * set ANTHROPIC_API_KEY to enable them. AI_MODEL overrides the default model.
 */
export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
export function aiClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "AI features aren't configured. Set ANTHROPIC_API_KEY to enable them.");
  if (!client) client = new Anthropic();
  return client;
}

export function aiEnabledFor(org: { settings?: { aiEnabled?: boolean } | null }) {
  return !!process.env.ANTHROPIC_API_KEY && org.settings?.aiEnabled !== false;
}

/** Server-side refusal fallback is only valid on the models that support it. */
function fallbackParams() {
  return /^claude-(opus-5|fable-5|sonnet-5-5)/.test(AI_MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};
}

function wrapError(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "The AI service is busy. Please try again in a moment.");
  if (e instanceof Anthropic.AuthenticationError) throw new HttpError(503, "The AI API key is invalid.");
  if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI request failed (${e.status ?? "network"})`);
  throw e;
}

/** One structured-output call: returns data validated against the Zod schema. */
export async function aiJson<T extends z.ZodType>(schema: T, system: string, user: string, effort: "low" | "medium" | "high" = "low"): Promise<z.infer<T>> {
  try {
    const response = await aiClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: betaZodOutputFormat(schema), effort },
      ...fallbackParams(),
    });
    if (response.stop_reason === "refusal") throw new HttpError(422, "The AI declined this request.");
    if (!response.parsed_output) throw new HttpError(502, "The AI returned an unexpected response.");
    return response.parsed_output as z.infer<T>;
  } catch (e) {
    wrapError(e);
  }
}

/** Plain-text completion. */
export async function aiText(system: string, user: string, effort: "low" | "medium" | "high" = "low") {
  try {
    const response = await aiClient().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort },
      ...fallbackParams(),
    });
    if (response.stop_reason === "refusal") throw new HttpError(422, "The AI declined this request.");
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (e) {
    wrapError(e);
  }
}

export { z };
