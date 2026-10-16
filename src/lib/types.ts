export type MeetingType = "retrospective" | "standup" | "healthCheck" | "estimation";

export type StepKey =
  | "icebreaker"
  | "welcome"
  | "openActions"
  | "brainstorm"
  | "group"
  | "vote"
  | "discuss"
  | "review"
  | "share"
  | "healthSurvey"
  | "healthDiscuss"
  | "prepare"
  | "estimate"
  | "standup";

export type MeetingStep = {
  key: StepKey;
  enabled: boolean;
  options?: Record<string, unknown>;
};

export type BrainstormOptions = {
  showAvatar?: "hidden" | "shown";
  colorIdea?: "topic" | "participant" | "manual";
  showIdea?: "nextStep" | "immediately";
};
export type GroupOptions = {
  permission?: "participant" | "facilitator";
  sort?: SortMode;
  autoSuggest?: boolean;
};
export type SortMode =
  | "original"
  | "whoAdded"
  | "whoAddedRandom"
  | "topicThenWhoAdded"
  | "topicThenWhoAddedRandom"
  | "random"
  | "votes"
  | "topicThenVotes";
export type VoteOptions = {
  maxVotes?: number | null; // null = unlimited
  topicLimit?: number | null;
  itemLimit?: number | null;
  mustCastAll?: boolean;
  facilitatorUnlimited?: boolean;
  anonymous?: boolean;
  reveal?: "nextStep" | "immediately";
  voteOn?: "groups" | "ideas";
  sort?: SortMode;
};
export type DiscussOptions = {
  which?: "all" | "allVoted" | "topN";
  topN?: number;
  sort?: SortMode;
  actionPermission?:
    | "facilitatorNoPropose"
    | "facilitatorCanPropose"
    | "participantNoPropose"
    | "participantCanPropose";
  autoSuggestActions?: boolean;
};
export type WelcomeOptions = { checkInQuestion?: string | null };
export type ShareOptions = { checkOutQuestion?: string | null };
export type IcebreakerOptions = { mode?: "game" | "questions" };
export type HealthDiscussOptions = {
  sort?: "positive" | "negative" | "mixed" | "original";
  layers?: string[];
  showDescription?: boolean;
  showCommentSummaries?: boolean;
};

export type LiveFeedbackOptions = {
  enabled?: boolean;
  reactions?: boolean;
  agreeDisagree?: boolean;
  slowerFaster?: boolean;
  raisedHand?: boolean;
};

export type MeetingOptions = {
  reactions?: boolean;
  comments?: boolean;
  commentReactions?: boolean;
  surveyComments?: boolean;
  kudos?: boolean;
  chat?: "disabled" | "facilitators" | "everyone";
  whiteboards?: "facilitators" | "everyone";
  agreements?: "facilitatorNoPropose" | "facilitatorCanPropose" | "participantNoPropose" | "participantCanPropose";
  parkingLot?: "facilitatorNoPropose" | "facilitatorCanPropose" | "participantNoPropose" | "participantCanPropose";
  liveFeedback?: LiveFeedbackOptions;
  anyMemberCanFacilitate?: boolean;
  allowAnonymousContributions?: boolean;
  healthAnonymous?: boolean;
  background?: { url?: string; mediaId?: string; opacity?: number } | null;
  autoSyncEstimates?: boolean;
  estimationSort?: "original" | "lowToHigh" | "highToLow" | "mostMixed";
  standupShowFeedBeforeFinish?: boolean;
  healthSummaries?: Record<string, string>;
  guestToken?: string;
};

export type Topic = {
  id: string;
  title: string;
  description?: string;
  color: string;
  icon?: string;
  type?: "done" | "doing" | "blocked";
};

export type TimerState = {
  status: "running" | "paused" | "stopped";
  endsAt?: string | null;
  remainingMs?: number | null;
  durationMs: number;
  chime?: boolean;
  music?: string | null;
  startedBy?: string;
};

export type PresentingState = {
  active: boolean;
  targetId?: string | null;
  participantIds?: string[];
};

export type CheckQuestionState = {
  question: string;
  revealed: boolean;
};

export type SeriesSchedule = {
  recurrence?: {
    freq: "day" | "week" | "month";
    interval: number;
    weekdays?: string[];
    dayOfMonth?: number;
  } | null;
  time?: string; // HH:mm
  timezone?: string;
  opens?: "onStart" | "afterPrevious" | "anytime";
  invite?: { channels: string[] };
  reminders?: { enabled: boolean; time?: string; clock?: "series" | "recipient" };
  close?: { enabled: boolean; time?: string; summary?: boolean };
};

export type TemplateBody = {
  title?: string;
  topics: Topic[];
  schedule?: SeriesSchedule;
  stepOptions?: Record<string, unknown>;
  options?: MeetingOptions;
  whenToUse?: string;
  tips?: string;
};

export type DeckCard = {
  label: string;
  value?: number | null;
  description?: string;
  special?: "coffee" | "unsure";
};

export type OrgSettings = {
  teamTransparency?: boolean;
  allowedDomains?: string[];
  enforceAllowedDomains?: boolean;
  domainCapture?: boolean;
  aiEnabled?: boolean;
  teamApiKeys?: boolean;
  restrictTeamCreation?: boolean;
  requestTeamCustomUrl?: string;
  requestTeamCustomMessage?: string;
  defaultHealthModelId?: string | null;
  allowGuests?: boolean;
  allowedIpRanges?: string[];
  /** When false, regular users only see teams they belong to. */
  revealTeamList?: boolean;
  /** Team roles allowed to share templates with other teams (default: admin). */
  templateSharingRoles?: TeamRole[];
  /** Per-feature AI switches; missing keys use the feature's default. */
  ai?: Partial<Record<AiFeature, boolean>>;
  /** Which attachment kinds participants may add to ideas and comments. */
  attachments?: Partial<Record<AttachmentKind, boolean>>;
  gravatar?: boolean;
  /** Users may connect MCP clients / apps on their behalf via OAuth. */
  connectedApps?: boolean;
  sso?: SsoSettings;
  scim?: ScimSettings;
};

export type AiFeature =
  | "assistant"
  | "suggestGroups"
  | "groupTitles"
  | "suggestActions"
  | "summaries"
  | "autoRetroSummary"
  | "autoHealthSummary"
  | "insights"
  | "generateTemplates"
  | "generateHealthModels"
  | "icebreakerQuestions";

export type AttachmentKind = "polls" | "kudos" | "images" | "gifs" | "whiteboards";

export type SsoSettings = {
  enabled?: boolean;
  /** Members (not owners) must sign in through the identity provider. */
  required?: boolean;
  entryPoint?: string;
  idpIssuer?: string;
  idpCert?: string;
  emailAttribute?: string;
  nameAttribute?: string;
};

export type ScimSettings = {
  ownersGroup?: string;
  adminsGroup?: string;
  /** Group name pattern with {team}, eg. "WeRetro-{team}-Admins". */
  teamAdminsPattern?: string;
  teamMembersPattern?: string;
  allowDeactivation?: boolean;
};

export type TeamPermissionKey =
  | "startRetrospectives"
  | "startStandups"
  | "startHealthChecks"
  | "startEstimations"
  | "addTeamMembers"
  | "markActionsComplete"
  | "manageActions"
  | "manageAgreements"
  | "manageParkingLot"
  | "useAiAssistant";

export type TeamOptions = {
  permissions?: Partial<Record<TeamPermissionKey, ("admin" | "member" | "observer")[]>>;
  actionsShowCompleted?: boolean;
};

export type NotificationPreferences = Record<string, boolean | string>;

export type IcebreakerState = {
  mode: "game" | "questions";
  gameKey?: string | null;
  phase?: string;
  round?: number;
  data?: Record<string, unknown>;
  question?: string | null;
  category?: string;
  history?: string[];
};

export type Attachment = {
  type: "image" | "gif" | "whiteboard" | "poll" | "kudos";
  url?: string;
  mediaId?: string;
  id?: string;
  alt?: string;
};

export type PublishedRef = {
  integrationId: string;
  type: string;
  url?: string;
  externalId?: string;
  at: string;
};

export type Anonymity = "names" | "aliases" | "anonymous";

export type ParticipantRole = "facilitator" | "facilitatorOnly" | "participant" | "observer" | "guest";
export type TeamRole = "admin" | "member" | "observer";
export type OrgRole = "owner" | "admin" | "insightsViewer" | "user";
