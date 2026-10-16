import type { AiFeature, AttachmentKind, OrgSettings } from "./types";

export const AI_FEATURES: { key: AiFeature; group: string; label: string; default: boolean }[] = [
  { key: "assistant", group: "AI assistant", label: "Meeting assistant", default: true },
  { key: "suggestGroups", group: "Suggestions and summaries", label: "Retrospective suggested groups", default: true },
  { key: "groupTitles", group: "Suggestions and summaries", label: "Retrospective group titles", default: true },
  { key: "suggestActions", group: "Suggestions and summaries", label: "Retrospective and health check suggested actions", default: true },
  { key: "summaries", group: "Suggestions and summaries", label: "Meeting summaries", default: true },
  { key: "autoRetroSummary", group: "Suggestions and summaries", label: "Automatic retrospective summaries", default: false },
  { key: "autoHealthSummary", group: "Suggestions and summaries", label: "Automatic health check summaries", default: false },
  { key: "insights", group: "AI insights", label: "Themes and sentiment in insights", default: true },
  { key: "generateTemplates", group: "Content generation", label: "Retrospective templates", default: true },
  { key: "generateHealthModels", group: "Content generation", label: "Health models", default: true },
  { key: "icebreakerQuestions", group: "Content generation", label: "Icebreaker questions", default: true },
];

export const ATTACHMENT_KINDS: { key: AttachmentKind; label: string }[] = [
  { key: "polls", label: "Interactive polls" },
  { key: "kudos", label: "Kudos" },
  { key: "images", label: "Images" },
  { key: "gifs", label: "Animated GIFs" },
  { key: "whiteboards", label: "Whiteboards" },
];

export type AiFlags = Record<AiFeature, boolean>;
export type AttachmentFlags = Record<AttachmentKind, boolean>;

/** Effective AI switches: off entirely without a key or when the org turns AI off. */
export function aiFlags(settings: OrgSettings | null | undefined, configured: boolean): AiFlags {
  const on = configured && settings?.aiEnabled !== false;
  return Object.fromEntries(AI_FEATURES.map((f) => [f.key, on && (settings?.ai?.[f.key] ?? f.default)])) as AiFlags;
}

export function attachmentFlags(settings: OrgSettings | null | undefined): AttachmentFlags {
  return Object.fromEntries(ATTACHMENT_KINDS.map((k) => [k.key, settings?.attachments?.[k.key] !== false])) as AttachmentFlags;
}

/** Map an attachment's stored type to its org switch. */
export function attachmentKindOf(type: string): AttachmentKind | null {
  if (type === "image") return "images";
  if (type === "gif") return "gifs";
  if (type === "poll") return "polls";
  if (type === "kudos") return "kudos";
  if (type === "whiteboard") return "whiteboards";
  return null;
}
