import type {
  Anonymity,
  Attachment,
  CheckQuestionState,
  DeckCard,
  IcebreakerState,
  MeetingOptions,
  MeetingStep,
  MeetingType,
  ParticipantRole,
  PresentingState,
  PublishedRef,
  TimerState,
  Topic,
} from "./types";

export type ReactionDTO = { emoji: string; count: number; mine: boolean; names: string[] };

export type ParticipantDTO = {
  id: string;
  userId: string | null;
  name: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
  role: ParticipantRole;
  finishedSteps: string[];
  abstained: boolean;
  absent: boolean;
  online: boolean;
  typing: boolean;
  isFacilitating: boolean;
  invited: boolean;
  isGuest: boolean;
  isMe: boolean;
};

export type PollDTO = {
  id: string;
  ideaId: string | null;
  question: string;
  options: { id: string; label: string; count: number | null }[];
  revealed: boolean;
  myOptionId: string | null;
  responded: number;
  canEdit: boolean;
};

export type IdeaDTO = {
  id: string;
  topicId: string;
  authorId: string | null; // participant id (null when hidden/anonymous)
  mine: boolean;
  hidden: boolean;
  text: string;
  color: string | null;
  anonymous: boolean;
  groupId: string | null;
  position: number;
  attachments: Attachment[];
  parked: boolean;
  votes: number | null;
  myVotes: number;
  voterIds: string[] | null;
  reactions: ReactionDTO[];
  commentCount: number;
  poll: PollDTO | null;
  createdAt: string;
};

export type GroupDTO = {
  id: string;
  topicId: string;
  title: string;
  position: number;
  suggested: boolean;
  parked: boolean;
  votes: number | null;
  myVotes: number;
  voterIds: string[] | null;
};

export type CommentDTO = {
  id: string;
  targetType: string;
  targetId: string;
  parentId: string | null;
  authorId: string | null; // participant id
  authorName: string;
  authorColor: string;
  authorAvatarUrl: string | null;
  mine: boolean;
  text: string;
  anonymous: boolean;
  parked: boolean;
  attachments: Attachment[];
  reactions: ReactionDTO[];
  createdAt: string;
};

export type ActionDTO = {
  id: string;
  teamId: string;
  meetingId: string | null;
  kind: "action" | "agreement" | "parked";
  title: string;
  description: string;
  status: string;
  assigneeIds: string[];
  assignees: { id: string; name: string; color: string; avatarUrl: string | null }[];
  dueDate: string | null;
  priority: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceText: string | null;
  sourceMeetingTitle: string | null;
  ai: boolean;
  published: PublishedRef[];
  position: number;
  createdAt: string;
  completedAt: string | null;
  votes: { agree: number; neutral: number; disagree: number; mine: string | null };
  commentCount: number;
  mine: boolean;
};

export type KudosDTO = {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  type: string;
  message: string;
  createdAt: string;
};

export type WhiteboardDTO = {
  id: string;
  title: string;
  attachedType: string;
  attachedId: string | null;
  editPermission: string;
  createdById: string | null;
  sceneVersion: number;
  updatedAt: string;
};

export type HealthDimensionDTO = {
  id: string;
  groupId: string | null;
  name: string;
  description: string;
  minLabel: string;
  maxLabel: string;
  valueLabels: string[] | null;
  myRating: { value: number | null; notApplicable: boolean; comment: string } | null;
  results: {
    count: number;
    mean: number | null;
    median: number | null;
    mode: number | null;
    stdDev: number | null;
    min: number | null;
    max: number | null;
    score: number | null;
    distribution: number[];
    notApplicable: number;
    individual: { participantId: string | null; value: number | null }[];
    comments: { participantId: string | null; name: string | null; text: string }[];
  } | null;
};

export type HealthDTO = {
  model: {
    id: string;
    name: string;
    description: string;
    style: string;
    minRating: number;
    maxRating: number;
    notApplicableOption: boolean;
    flipOrder: boolean;
    colors: string[] | null;
    valueLabels: string[] | null;
    groups: { id: string; name: string; description: string }[];
  };
  dimensions: HealthDimensionDTO[];
  previous: Record<string, number | null>; // dimensionId -> previous mean
};

export type EstimationItemDTO = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  externalKey: string | null;
  externalSource: string | null;
  position: number;
  phase: "discuss" | "estimate" | "review";
  finalEstimate: string | null;
  votedParticipantIds: string[];
  votes: { participantId: string | null; value: string }[] | null;
  myVote: string | null;
  average: number | null;
  syncStatus: string | null;
  commentCount: number;
};

export type StandupUpdateDTO = {
  id: string;
  participantId: string;
  userId: string;
  topicId: string;
  type: string | null;
  text: string;
  position: number;
  carriedFromId: string | null;
  carryStatus: string | null;
  dayCount: number;
  mentions: string[];
  reactions: ReactionDTO[];
  commentCount: number;
  createdAt: string;
};

export type LiveEventDTO = { id: string; participantId: string; kind: string; emoji: string | null; active: boolean; createdAt: string };

export type CheckDTO = {
  kind: "in" | "out";
  question: string;
  revealed: boolean;
  myValue: number | null;
  responded: number;
  distribution: number[] | null;
};

export type IcebreakerEntryDTO = { id: string; participantId: string; round: number; kind: string; payload: Record<string, unknown>; mine: boolean; createdAt: string };

export type MeetingStateDTO = {
  serverNow: string;
  version: number;
  meeting: {
    id: string;
    teamId: string;
    seriesId: string | null;
    type: MeetingType;
    title: string;
    date: string;
    status: "open" | "closed";
    anonymity: Anonymity;
    stepIndex: number;
    steps: MeetingStep[];
    options: MeetingOptions;
    topics: Topic[];
    context: string;
    contextImageUrl: string | null;
    templateName: string | null;
    timer: TimerState | null;
    presenting: PresentingState | null;
    checkIn: CheckQuestionState | null;
    checkOut: CheckQuestionState | null;
    icebreaker: IcebreakerState | null;
    notes: string;
    aiSummary: string | null;
    collectingUntil: string | null;
    deck: { id?: string; name: string; cards: DeckCard[] } | null;
    healthModelId: string | null;
    createdAt: string;
    closedAt: string | null;
    isDemo: boolean;
  };
  team: { id: string; name: string; color: string; orgId: string; orgSlug: string; logoUrl: string | null; aiEnabled: boolean };
  me: {
    participantId: string | null;
    userId: string;
    name: string;
    role: ParticipantRole | null;
    isFacilitator: boolean; // actively facilitating
    canFacilitate: boolean; // could take over
    canContribute: boolean;
    isTeamMember: boolean;
    isGuest: boolean;
  };
  participants: ParticipantDTO[];
  members: { userId: string; name: string; color: string; avatarUrl: string | null }[];
  ideas: IdeaDTO[];
  hiddenIdeaCounts: Record<string, number>;
  groups: GroupDTO[];
  comments: CommentDTO[];
  chat: CommentDTO[];
  actions: ActionDTO[];
  kudos: KudosDTO[];
  whiteboards: WhiteboardDTO[];
  polls: PollDTO[];
  health: HealthDTO | null;
  estimation: EstimationItemDTO[];
  standup: StandupUpdateDTO[];
  standupCarryovers: { id: string; topicId: string; type: string | null; text: string; dayCount: number; date: string }[];
  standupHiddenCount: number;
  liveEvents: LiveEventDTO[];
  checks: CheckDTO[];
  icebreakerEntries: IcebreakerEntryDTO[];
  voting: { maxVotes: number | null; used: number; remaining: number | null };
  stats: {
    ideas: number;
    ideaContributors: number;
    votesCast: number;
    votedTargets: number;
    voters: number;
    participationRate: number;
    contributors: number;
    expected: number;
  };
};
