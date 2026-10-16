import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  doublePrecision,
  bigint,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  MeetingOptions,
  MeetingStep,
  Topic,
  TimerState,
  PresentingState,
  CheckQuestionState,
  SeriesSchedule,
  TemplateBody,
  DeckCard,
  OrgSettings,
  TeamOptions,
  NotificationPreferences,
  IcebreakerState,
  Attachment,
  PublishedRef,
} from "@/lib/types";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ─── Identity ───────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email"),
    name: text("name").notNull().default(""),
    initials: text("initials"),
    color: text("color").notNull().default("#6366F1"),
    avatarMediaId: text("avatar_media_id"),
    passwordHash: text("password_hash"),
    emailVerifiedAt: ts("email_verified_at"),
    pendingEmail: text("pending_email"),
    timezone: text("timezone").notNull().default("UTC"),
    colorScheme: text("color_scheme").notNull().default("system"),
    language: text("language").notNull().default("en"),
    isGuest: boolean("is_guest").notNull().default(false),
    options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
    notificationPreferences: jsonb("notification_preferences")
      .$type<NotificationPreferences>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the token
    userId: text("user_id").notNull(),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: id(),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("oauth_provider_idx").on(t.provider, t.providerUserId)],
);

export const emailTokens = pgTable("email_tokens", {
  id: id(),
  email: text("email").notNull(),
  userId: text("user_id"),
  purpose: text("purpose").notNull(), // login | verify | reset | emailChange
  tokenHash: text("token_hash").notNull(),
  code: text("code"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

// ─── Organizations & teams ──────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#6366F1"),
  logoMediaId: text("logo_media_id"),
  coverMediaId: text("cover_media_id"),
  settings: jsonb("settings").$type<OrgSettings>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orgUsers = pgTable(
  "org_users",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    roles: text("roles").array().notNull().default(sql`ARRAY['user']::text[]`),
    addedById: text("added_by_id"),
    invitedAt: ts("invited_at"),
    joinedAt: ts("joined_at"),
    active: boolean("active").notNull().default(true),
    notificationPreferences: jsonb("notification_preferences")
      .$type<NotificationPreferences>()
      .notNull()
      .default({}),
    lastSeenAt: ts("last_seen_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("org_users_unique").on(t.orgId, t.userId)],
);

export const teams = pgTable(
  "teams",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#6366F1"),
    code: text("code").notNull().unique(),
    logoMediaId: text("logo_media_id"),
    coverMediaId: text("cover_media_id"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    language: text("language").notNull().default("en"),
    options: jsonb("options").$type<TeamOptions>().notNull().default({}),
    defaultHealthModelId: text("default_health_model_id"),
    defaultDeckId: text("default_deck_id"),
    isProgram: boolean("is_program").notNull().default(false),
    memberTeamIds: text("member_team_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    archivedAt: ts("archived_at"),
    deletedAt: ts("deleted_at"),
    lastActivityAt: ts("last_activity_at"),
    createdAt: createdAt(),
  },
  (t) => [index("teams_org_idx").on(t.orgId)],
);

export const members = pgTable(
  "members",
  {
    id: id(),
    teamId: text("team_id").notNull(),
    userId: text("user_id").notNull(),
    roles: text("roles").array().notNull().default(sql`ARRAY['member']::text[]`),
    reminders: text("reminders").notNull().default("assignedToMe"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    addedById: text("added_by_id"),
    invitedAt: ts("invited_at"),
    joinedAt: ts("joined_at"),
    lastSeenAt: ts("last_seen_at"),
    notificationPreferences: jsonb("notification_preferences")
      .$type<NotificationPreferences>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("members_unique").on(t.teamId, t.userId), index("members_user_idx").on(t.userId)],
);

export const userRequests = pgTable("user_requests", {
  id: id(),
  orgId: text("org_id").notNull(),
  teamId: text("team_id"),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(), // teamMember | teamAdmin | createTeam
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | canceled
  resolvedById: text("resolved_by_id"),
  resolvedAt: ts("resolved_at"),
  createdAt: createdAt(),
});

export const media = pgTable("media", {
  id: id(),
  orgId: text("org_id"),
  uploadedById: text("uploaded_by_id"),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  size: integer("size").notNull(),
  kind: text("kind").notNull().default("image"),
  createdAt: createdAt(),
});

// ─── Templates, models and decks ────────────────────────────────────────────

export const templates = pgTable("templates", {
  id: id(),
  orgId: text("org_id"),
  teamId: text("team_id"),
  meetingType: text("meeting_type").notNull(), // retrospective | standup
  category: text("category").notNull().default("custom"),
  name: text("name").notNull(),
  descriptionShort: text("description_short").notNull().default(""),
  description: text("description").notNull().default(""),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  body: jsonb("body").$type<TemplateBody>().notNull(),
  sharedWithOtherTeams: boolean("shared_with_other_teams").notNull().default(false),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deleted_at"),
});

export const healthModels = pgTable("health_models", {
  id: id(),
  orgId: text("org_id"),
  teamId: text("team_id"),
  builtinKey: text("builtin_key").unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  style: text("style").notNull().default("numeric"), // numeric | happiness | likert | matrix | favorability
  minRating: integer("min_rating").notNull().default(1),
  maxRating: integer("max_rating").notNull().default(5),
  notApplicableOption: boolean("not_applicable_option").notNull().default(false),
  flipOrder: boolean("flip_order").notNull().default(false),
  colors: text("colors").array(),
  valueLabels: text("value_labels").array(),
  category: text("category").notNull().default("custom"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  attribution: text("attribution").notNull().default(""),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdById: text("created_by_id"),
  archivedAt: ts("archived_at"),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const healthDimensionGroups = pgTable("health_dimension_groups", {
  id: id(),
  modelId: text("model_id").notNull(),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  deletedAt: ts("deleted_at"),
});

export const healthDimensions = pgTable(
  "health_dimensions",
  {
    id: id(),
    modelId: text("model_id").notNull(),
    groupId: text("group_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    minLabel: text("min_label").notNull().default(""),
    midLabel: text("mid_label").notNull().default(""),
    maxLabel: text("max_label").notNull().default(""),
    valueLabels: text("value_labels").array(),
    position: integer("position").notNull().default(0),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("health_dimensions_model_idx").on(t.modelId)],
);

export const estimationDecks = pgTable("estimation_decks", {
  id: id(),
  orgId: text("org_id"),
  teamId: text("team_id"),
  name: text("name").notNull(),
  cards: jsonb("cards").$type<DeckCard[]>().notNull(),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  deletedAt: ts("deleted_at"),
});

// ─── Meetings ───────────────────────────────────────────────────────────────

export const meetingSeries = pgTable("meeting_series", {
  id: id(),
  teamId: text("team_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull().default(""),
  body: jsonb("body").$type<Record<string, unknown>>().notNull().default({}),
  schedule: jsonb("schedule").$type<SeriesSchedule>(),
  active: boolean("active").notNull().default(true),
  lastOccurrence: date("last_occurrence"),
  canceledDates: text("canceled_dates").array().notNull().default(sql`ARRAY[]::text[]`),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  deletedAt: ts("deleted_at"),
});

export const meetings = pgTable(
  "meetings",
  {
    id: id(),
    teamId: text("team_id").notNull(),
    seriesId: text("series_id"),
    type: text("type").notNull(), // retrospective | standup | healthCheck | estimation
    title: text("title").notNull().default(""),
    date: date("date").notNull(),
    status: text("status").notNull().default("open"), // open | closed
    anonymity: text("anonymity").notNull().default("names"), // names | aliases | anonymous
    stepIndex: integer("step_index").notNull().default(0),
    steps: jsonb("steps").$type<MeetingStep[]>().notNull().default([]),
    options: jsonb("options").$type<MeetingOptions>().notNull().default({}),
    topics: jsonb("topics").$type<Topic[]>().notNull().default([]),
    context: text("context").notNull().default(""),
    contextMediaId: text("context_media_id"),
    templateKey: text("template_key"),
    templateName: text("template_name"),
    healthModelId: text("health_model_id"),
    deck: jsonb("deck").$type<{ id?: string; name: string; cards: DeckCard[] }>(),
    timer: jsonb("timer").$type<TimerState>(),
    presenting: jsonb("presenting").$type<PresentingState>(),
    checkIn: jsonb("check_in").$type<CheckQuestionState>(),
    checkOut: jsonb("check_out").$type<CheckQuestionState>(),
    icebreaker: jsonb("icebreaker").$type<IcebreakerState>(),
    notes: text("notes").notNull().default(""),
    aiSummary: text("ai_summary"),
    collectingUntil: ts("collecting_until"),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    isDemo: boolean("is_demo").notNull().default(false),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    closedAt: ts("closed_at"),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("meetings_team_idx").on(t.teamId, t.type)],
);

export const participants = pgTable(
  "participants",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("participant"), // facilitator | facilitatorOnly | participant | observer | guest
    alias: text("alias"),
    aliasColor: text("alias_color"),
    finishedSteps: text("finished_steps").array().notNull().default(sql`ARRAY[]::text[]`),
    abstained: boolean("abstained").notNull().default(false),
    absent: boolean("absent").notNull().default(false),
    isFacilitating: boolean("is_facilitating").notNull().default(false),
    invitedAt: ts("invited_at"),
    joinedAt: ts("joined_at"),
    lastSeenAt: ts("last_seen_at"),
    typingAt: ts("typing_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("participants_unique").on(t.meetingId, t.userId)],
);

export const ideas = pgTable(
  "ideas",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    topicId: text("topic_id").notNull(),
    participantId: text("participant_id").notNull(),
    text: text("text").notNull().default(""),
    color: text("color"),
    anonymous: boolean("anonymous").notNull().default(false),
    groupId: text("group_id"),
    position: doublePrecision("position").notNull().default(0),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    parkedAt: ts("parked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ideas_meeting_idx").on(t.meetingId)],
);

export const ideaGroups = pgTable("idea_groups", {
  id: id(),
  meetingId: text("meeting_id").notNull(),
  topicId: text("topic_id").notNull(),
  title: text("title").notNull().default(""),
  position: doublePrecision("position").notNull().default(0),
  suggested: boolean("suggested").notNull().default(false),
  parkedAt: ts("parked_at"),
  createdAt: createdAt(),
});

export const votes = pgTable(
  "votes",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    participantId: text("participant_id").notNull(),
    targetId: text("target_id").notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [uniqueIndex("votes_unique").on(t.participantId, t.targetId)],
);

export const reactions = pgTable(
  "reactions",
  {
    id: id(),
    meetingId: text("meeting_id"),
    targetId: text("target_id").notNull(),
    userId: text("user_id").notNull(),
    participantId: text("participant_id"),
    emoji: text("emoji").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reactions_unique").on(t.targetId, t.userId, t.emoji),
    index("reactions_meeting_idx").on(t.meetingId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: id(),
    teamId: text("team_id").notNull(),
    meetingId: text("meeting_id"),
    targetType: text("target_type").notNull(), // idea | group | action | dimension | estimationItem | update | chat
    targetId: text("target_id").notNull(),
    parentId: text("parent_id"),
    userId: text("user_id").notNull(),
    participantId: text("participant_id"),
    text: text("text").notNull(),
    anonymous: boolean("anonymous").notNull().default(false),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    parkedAt: ts("parked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("comments_meeting_idx").on(t.meetingId), index("comments_target_idx").on(t.targetId)],
);

export const actionItems = pgTable(
  "action_items",
  {
    id: id(),
    teamId: text("team_id").notNull(),
    meetingId: text("meeting_id"),
    kind: text("kind").notNull().default("action"), // action | agreement | parked
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("accepted"), // proposed | suggested | accepted | rejected | completed | canceled
    assigneeIds: text("assignee_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    dueDate: date("due_date"),
    priority: text("priority"), // low | medium | high
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    sourceText: text("source_text"),
    sourceMeetingTitle: text("source_meeting_title"),
    ai: boolean("ai").notNull().default(false),
    published: jsonb("published").$type<PublishedRef[]>().notNull().default([]),
    position: doublePrecision("position").notNull().default(0),
    createdById: text("created_by_id"),
    participantId: text("participant_id"),
    completedAt: ts("completed_at"),
    completedById: text("completed_by_id"),
    reminderSentAt: ts("reminder_sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("actions_team_idx").on(t.teamId, t.kind), index("actions_meeting_idx").on(t.meetingId)],
);

export const actionVotes = pgTable(
  "action_votes",
  {
    id: id(),
    actionId: text("action_id").notNull(),
    userId: text("user_id").notNull(),
    value: text("value").notNull(), // agree | neutral | disagree
  },
  (t) => [uniqueIndex("action_votes_unique").on(t.actionId, t.userId)],
);

export const polls = pgTable("polls", {
  id: id(),
  meetingId: text("meeting_id").notNull(),
  ideaId: text("idea_id"),
  question: text("question").notNull().default(""),
  options: jsonb("options").$type<{ id: string; label: string }[]>().notNull().default([]),
  revealed: boolean("revealed").notNull().default(true),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

export const pollResponses = pgTable(
  "poll_responses",
  {
    id: id(),
    pollId: text("poll_id").notNull(),
    participantId: text("participant_id").notNull(),
    optionId: text("option_id").notNull(),
  },
  (t) => [uniqueIndex("poll_responses_unique").on(t.pollId, t.participantId)],
);

export const kudos = pgTable("kudos", {
  id: id(),
  teamId: text("team_id").notNull(),
  meetingId: text("meeting_id"),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  type: text("type").notNull().default("thankYou"),
  message: text("message").notNull().default(""),
  createdAt: createdAt(),
});

export const healthRatings = pgTable(
  "health_ratings",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    participantId: text("participant_id").notNull(),
    dimensionId: text("dimension_id").notNull(),
    value: integer("value"),
    notApplicable: boolean("not_applicable").notNull().default(false),
    comment: text("comment").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("health_ratings_unique").on(t.participantId, t.dimensionId)],
);

export const checkResponses = pgTable(
  "check_responses",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    participantId: text("participant_id").notNull(),
    kind: text("kind").notNull(), // in | out
    question: text("question").notNull(),
    value: integer("value").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("check_responses_unique").on(t.participantId, t.kind)],
);

export const estimationItems = pgTable(
  "estimation_items",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    teamId: text("team_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    url: text("url"),
    externalKey: text("external_key"),
    externalSource: text("external_source"),
    position: doublePrecision("position").notNull().default(0),
    phase: text("phase").notNull().default("discuss"), // discuss | estimate | review
    finalEstimate: text("final_estimate"),
    syncStatus: text("sync_status"),
    createdAt: createdAt(),
  },
  (t) => [index("estimation_items_meeting_idx").on(t.meetingId)],
);

export const estimationVotes = pgTable(
  "estimation_votes",
  {
    id: id(),
    itemId: text("item_id").notNull(),
    meetingId: text("meeting_id").notNull(),
    participantId: text("participant_id").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("estimation_votes_unique").on(t.itemId, t.participantId)],
);

export const standupUpdates = pgTable(
  "standup_updates",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    teamId: text("team_id").notNull(),
    participantId: text("participant_id").notNull(),
    userId: text("user_id").notNull(),
    topicId: text("topic_id").notNull(),
    type: text("type"), // done | doing | blocked
    text: text("text").notNull(),
    position: doublePrecision("position").notNull().default(0),
    carriedFromId: text("carried_from_id"),
    carryStatus: text("carry_status"), // done | continue | blocked
    dayCount: integer("day_count").notNull().default(1),
    mentions: text("mentions").array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("standup_updates_meeting_idx").on(t.meetingId)],
);

export const whiteboards = pgTable("whiteboards", {
  id: id(),
  meetingId: text("meeting_id"),
  teamId: text("team_id").notNull(),
  attachedType: text("attached_type").notNull().default("meeting"), // meeting | idea | comment
  attachedId: text("attached_id"),
  title: text("title").notNull().default("Whiteboard"),
  editPermission: text("edit_permission").notNull().default("everyone"),
  scene: jsonb("scene").$type<{ elements: unknown[]; files?: Record<string, unknown> }>().notNull().default({ elements: [] }),
  sceneVersion: integer("scene_version").notNull().default(0),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deleted_at"),
});

export const liveEvents = pgTable(
  "live_events",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    participantId: text("participant_id").notNull(),
    kind: text("kind").notNull(), // reaction | agree | disagree | slower | faster | hand
    emoji: text("emoji"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("live_events_meeting_idx").on(t.meetingId)],
);

export const icebreakerEntries = pgTable(
  "icebreaker_entries",
  {
    id: id(),
    meetingId: text("meeting_id").notNull(),
    participantId: text("participant_id").notNull(),
    round: integer("round").notNull().default(0),
    kind: text("kind").notNull().default("answer"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("icebreaker_entries_meeting_idx").on(t.meetingId)],
);

// ─── AI, integrations, API ──────────────────────────────────────────────────

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    userId: text("user_id").notNull(),
    teamId: text("team_id"),
    meetingId: text("meeting_id"),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: jsonb("content").$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conv_idx").on(t.conversationId)],
);

export const integrations = pgTable("integrations", {
  id: id(),
  teamId: text("team_id").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull().default(""),
  config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
  status: text("status").notNull().default("active"),
  lastError: text("last_error"),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

export const integrationLogs = pgTable("integration_logs", {
  id: id(),
  integrationId: text("integration_id").notNull(),
  event: text("event").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull().default(""),
  createdAt: createdAt(),
});

export const apiKeys = pgTable("api_keys", {
  id: id(),
  orgId: text("org_id").notNull(),
  teamId: text("team_id"),
  name: text("name").notNull().default(""),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  scopes: text("scopes").array().notNull(),
  createdById: text("created_by_id"),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: id(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull().default(""),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  createdAt: createdAt(),
  sentAt: ts("sent_at"),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    teamId: text("team_id"),
    userId: text("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("activity_org_idx").on(t.orgId, t.createdAt)],
);

export const notificationsSent = pgTable("notifications_sent", {
  id: id(),
  key: text("key").notNull().unique(),
  createdAt: createdAt(),
});
