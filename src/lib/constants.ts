import type {
  DeckCard,
  MeetingOptions,
  MeetingStep,
  MeetingType,
  StepKey,
  TeamPermissionKey,
  TeamRole,
} from "./types";

export const APP_NAME = "WeRetro";

export const PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#F43F5E", "#64748B", "#78716C", "#0F172A",
];

export const AVATAR_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#F43F5E", "#0EA5E9", "#84CC16",
];

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  retrospective: "Retrospective",
  standup: "Standup",
  healthCheck: "Health check",
  estimation: "Estimation",
};

export const MEETING_TYPE_PATH: Record<MeetingType, string> = {
  retrospective: "retrospectives",
  standup: "standups",
  healthCheck: "health-checks",
  estimation: "estimations",
};

export const MEETING_TYPE_BLURB: Record<MeetingType, string> = {
  retrospective: "Look back, vote on what matters, commit to actions",
  standup: "Post progress, plans and blockers",
  healthCheck: "Score how the team is doing",
  estimation: "Size work together with planning poker",
};

export const STEP_LABEL: Record<StepKey, string> = {
  icebreaker: "Icebreaker",
  welcome: "Welcome",
  openActions: "Open actions",
  brainstorm: "Brainstorm",
  group: "Group",
  vote: "Vote",
  discuss: "Discuss",
  review: "Review",
  share: "Close",
  healthSurvey: "Survey",
  healthDiscuss: "Discuss",
  prepare: "Prepare",
  estimate: "Estimate",
  standup: "Standup",
};

export const STEP_INSTRUCTIONS: Record<StepKey, string> = {
  icebreaker: "Warm up together",
  welcome: "Set the scene",
  openActions: "Check in on open actions",
  brainstorm: "Write your thoughts under each topic",
  group: "Combine similar cards",
  vote: "Spend your votes on what you want to talk about",
  discuss: "Talk it through and capture actions",
  review: "Go over the action plan",
  share: "Wrap up and share the results",
  healthSurvey: "Score each dimension",
  healthDiscuss: "Talk through the results and capture actions",
  prepare: "List the items to estimate",
  estimate: "Estimate each item on your own, then compare",
  standup: "Post your update",
};

export const DEFAULT_STEPS: Record<MeetingType, MeetingStep[]> = {
  retrospective: [
    { key: "icebreaker", enabled: false, options: { mode: "game" } },
    { key: "welcome", enabled: false, options: { checkInQuestion: null } },
    { key: "openActions", enabled: false },
    { key: "brainstorm", enabled: true, options: { showAvatar: "hidden", colorIdea: "topic", showIdea: "nextStep" } },
    { key: "group", enabled: true, options: { permission: "participant", sort: "original", autoSuggest: false } },
    {
      key: "vote",
      enabled: true,
      options: {
        maxVotes: 5,
        topicLimit: null,
        itemLimit: null,
        mustCastAll: false,
        facilitatorUnlimited: false,
        anonymous: true,
        reveal: "nextStep",
        voteOn: "groups",
        sort: "original",
      },
    },
    {
      key: "discuss",
      enabled: true,
      options: { which: "allVoted", topN: 5, sort: "votes", actionPermission: "participantNoPropose", autoSuggestActions: false },
    },
    { key: "review", enabled: false },
    { key: "share", enabled: true, options: { checkOutQuestion: null } },
  ],
  healthCheck: [
    { key: "icebreaker", enabled: false, options: { mode: "game" } },
    { key: "welcome", enabled: false, options: { checkInQuestion: null } },
    { key: "openActions", enabled: false },
    { key: "healthSurvey", enabled: true },
    {
      key: "healthDiscuss",
      enabled: true,
      options: { sort: "negative", layers: ["mean", "distribution"], showDescription: true, showCommentSummaries: false, actionPermission: "participantNoPropose" },
    },
    { key: "review", enabled: false },
    { key: "share", enabled: true, options: { checkOutQuestion: null } },
  ],
  estimation: [
    { key: "icebreaker", enabled: false, options: { mode: "game" } },
    { key: "welcome", enabled: false, options: { checkInQuestion: null } },
    { key: "openActions", enabled: false },
    { key: "prepare", enabled: true },
    { key: "estimate", enabled: true, options: { actionPermission: "participantNoPropose" } },
    { key: "review", enabled: true },
    { key: "share", enabled: true, options: { checkOutQuestion: null } },
  ],
  standup: [
    { key: "standup", enabled: true },
    { key: "share", enabled: true },
  ],
};

export const DEFAULT_OPTIONS: MeetingOptions = {
  reactions: true,
  comments: true,
  commentReactions: true,
  surveyComments: true,
  kudos: true,
  chat: "everyone",
  whiteboards: "everyone",
  agreements: "participantNoPropose",
  parkingLot: "participantNoPropose",
  liveFeedback: { enabled: true, reactions: true, agreeDisagree: true, slowerFaster: true, raisedHand: true },
  anyMemberCanFacilitate: false,
  allowAnonymousContributions: false,
  healthAnonymous: true,
  autoSyncEstimates: false,
  estimationSort: "original",
};

export const PERMISSION_LABEL: Record<TeamPermissionKey, string> = {
  startRetrospectives: "Create and facilitate retrospectives",
  startStandups: "Create and facilitate standups",
  startHealthChecks: "Create and facilitate health checks",
  startEstimations: "Create and facilitate estimations",
  addTeamMembers: "Add team members",
  markActionsComplete: "Mark actions complete",
  manageActions: "Manage actions *",
  manageAgreements: "Manage agreements *",
  manageParkingLot: "Manage parking lot *",
  useAiAssistant: "Use the AI assistant",
};

export const DEFAULT_PERMISSIONS: Record<TeamPermissionKey, TeamRole[]> = {
  startRetrospectives: ["admin"],
  startStandups: ["admin"],
  startHealthChecks: ["admin"],
  startEstimations: ["admin"],
  addTeamMembers: ["admin"],
  markActionsComplete: ["admin", "member"],
  manageActions: ["admin", "member"],
  manageAgreements: ["admin", "member"],
  manageParkingLot: ["admin", "member"],
  useAiAssistant: ["admin", "member"],
};

export const REACTION_EMOJIS = ["👍", "👎", "❤️", "🎉", "👏", "😂", "😮", "🤔", "😡", "😢"];

export const KUDOS_TYPES: { key: string; label: string; emoji: string; color: string }[] = [
  { key: "thankYou", label: "Thank you!", emoji: "🙏", color: "#22C55E" },
  { key: "greatJob", label: "Great job!", emoji: "🌟", color: "#F59E0B" },
  { key: "congratulations", label: "Congrats!", emoji: "🎉", color: "#EC4899" },
  { key: "impressive", label: "Impressive!", emoji: "🚀", color: "#6366F1" },
  { key: "proudOfYou", label: "Proud of you!", emoji: "🏆", color: "#F97316" },
  { key: "veryHappy", label: "Very happy!", emoji: "😄", color: "#06B6D4" },
];

export const MUSIC_GENRES = ["acoustic", "chilled", "classical", "global", "inspiring", "upbeat", "lo-fi"] as const;

export type CheckQuestion = {
  key: string;
  title: string;
  question: string;
  kind: "in" | "out" | "both";
  options: { emoji: string; label: string; description: string }[];
};

export const CHECK_QUESTIONS: CheckQuestion[] = [
  {
    key: "energyLevels",
    title: "Energy levels",
    question: "How much energy are you bringing to this meeting?",
    kind: "in",
    options: [
      { emoji: "🪫", label: "Empty", description: "Running on fumes" },
      { emoji: "😮‍💨", label: "Low", description: "Not much left in the tank" },
      { emoji: "🙂", label: "Steady", description: "Doing fine" },
      { emoji: "⚡", label: "High", description: "Ready to go" },
      { emoji: "🚀", label: "Full", description: "Bring it on" },
    ],
  },
  {
    key: "weatherReport",
    title: "Weather report",
    question: "If the last sprint were a weather forecast, what would it be?",
    kind: "in",
    options: [
      { emoji: "⛈️", label: "Storm", description: "Chaotic and rough" },
      { emoji: "🌧️", label: "Rain", description: "Problems slowed us down" },
      { emoji: "🌬️", label: "Wind", description: "Bumpy, but we coped" },
      { emoji: "⛅", label: "Clouds", description: "Mostly fine" },
      { emoji: "☀️", label: "Sun", description: "Smooth and bright" },
    ],
  },
  {
    key: "safetyCheck",
    title: "Safety check",
    question: "How safe do you feel speaking up in this meeting?",
    kind: "in",
    options: [
      { emoji: "1️⃣", label: "Not safe", description: "I will keep my thoughts to myself" },
      { emoji: "2️⃣", label: "Guarded", description: "I will share very carefully" },
      { emoji: "3️⃣", label: "Neutral", description: "Depends on the topic" },
      { emoji: "4️⃣", label: "Mostly safe", description: "I'm comfortable sharing" },
      { emoji: "5️⃣", label: "Very safe", description: "I'll say anything" },
    ],
  },
  {
    key: "teamCollaboration",
    title: "Team collaboration",
    question: "How well did we work together last sprint?",
    kind: "in",
    options: [
      { emoji: "😖", label: "Poorly", description: "We worked against each other" },
      { emoji: "😕", label: "So-so", description: "We could have helped each other more" },
      { emoji: "😐", label: "OK", description: "We got there" },
      { emoji: "😊", label: "Well", description: "We pulled together" },
      { emoji: "🤩", label: "Brilliantly", description: "We lifted each other up" },
    ],
  },
  {
    key: "sprintHappiness",
    title: "Sprint happiness",
    question: "How happy are you with the last sprint?",
    kind: "in",
    options: [
      { emoji: "😭", label: "Very unhappy", description: "It went badly" },
      { emoji: "🙁", label: "Unhappy", description: "We missed our goals" },
      { emoji: "😐", label: "Neutral", description: "Some goals hit, some missed" },
      { emoji: "🙂", label: "Happy", description: "We hit our goals" },
      { emoji: "😁", label: "Very happy", description: "We beat our goals" },
    ],
  },
  {
    key: "deliveryConfidence",
    title: "Delivery confidence",
    question: "How confident are you that we'll deliver on time?",
    kind: "both",
    options: [
      { emoji: "😰", label: "Not at all", description: "I expect us to miss" },
      { emoji: "😟", label: "Doubtful", description: "It will be tight" },
      { emoji: "🤞", label: "Hopeful", description: "Reasonably confident" },
      { emoji: "👍", label: "Confident", description: "We'll make it" },
      { emoji: "💯", label: "Certain", description: "No doubt at all" },
    ],
  },
  {
    key: "returnOnTimeInvested",
    title: "Return on time invested",
    question: "Was this meeting a good use of your time?",
    kind: "out",
    options: [
      { emoji: "🗑️", label: "Not at all", description: "Waste of my time" },
      { emoji: "🤷", label: "Barely", description: "Some value, not enough" },
      { emoji: "⚖️", label: "Break even", description: "Worth the time I spent" },
      { emoji: "📈", label: "Good", description: "More value than time spent" },
      { emoji: "💎", label: "Excellent", description: "Absolutely worth it" },
    ],
  },
  {
    key: "pulseCheck",
    title: "Pulse check",
    question: "How do you feel as you leave this meeting?",
    kind: "out",
    options: [
      { emoji: "😞", label: "Bad", description: "Worried about what's ahead" },
      { emoji: "😕", label: "Uneasy", description: "A few concerns" },
      { emoji: "😐", label: "Mixed", description: "Could go either way" },
      { emoji: "🙂", label: "Good", description: "Happy with where we landed" },
      { emoji: "🤩", label: "Great", description: "Energized for what's next" },
    ],
  },
  {
    key: "retrospectiveProcess",
    title: "Retro process",
    question: "How happy are you with how we run our retros?",
    kind: "out",
    options: [
      { emoji: "😠", label: "Unhappy", description: "Something big needs fixing" },
      { emoji: "😕", label: "A bit unhappy", description: "A few things to improve" },
      { emoji: "😐", label: "Fine", description: "It works" },
      { emoji: "😊", label: "Happy", description: "Small tweaks at most" },
      { emoji: "😍", label: "Love it", description: "Keep doing exactly this" },
    ],
  },
];

export const BUILTIN_DECKS: { id: string; name: string; cards: DeckCard[] }[] = [
  {
    id: "scrum",
    name: "Scrum",
    cards: [
      ...[0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100].map((v) => ({ label: v === 0.5 ? "½" : String(v), value: v })),
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "fibonacci",
    name: "Fibonacci",
    cards: [
      ...[0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].map((v) => ({ label: String(v), value: v })),
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "modifiedFibonacci",
    name: "Modified Fibonacci",
    cards: [
      ...[0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100].map((v) => ({ label: v === 0.5 ? "½" : String(v), value: v })),
      { label: "∞", value: null },
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "sequential",
    name: "Sequential",
    cards: [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ({ label: String(v), value: v })),
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "halfCard",
    name: "Half card",
    cards: [
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].map((v) => ({ label: String(v), value: v })),
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "powerOfTwo",
    name: "Power of 2",
    cards: [
      ...[0, 1, 2, 4, 8, 16, 32, 64].map((v) => ({ label: String(v), value: v })),
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "tShirtSize",
    name: "T-shirt size",
    cards: [
      ...["XS", "S", "M", "L", "XL", "XXL"].map((l) => ({ label: l })),
      { label: "?", special: "unsure" as const },
      { label: "☕", special: "coffee" as const },
    ],
  },
  {
    id: "fiveFingers",
    name: "Five fingers",
    cards: [1, 2, 3, 4, 5].map((v) => ({ label: ["☝️", "✌️", "🤟", "🖖", "🖐️"][v - 1], value: v, description: `${v}` })),
  },
];

export const TEAM_TYPES = [
  "Development", "Product", "Design", "Marketing", "Sales", "Customer Support", "Operations",
  "Research and Development", "Project Management", "Quality Assurance", "Human Resources", "Finance",
  "Content Creation", "Business Development", "Data Analysis", "Information Technology",
];

export const TEMPLATE_TAGS = [
  "customerSupport", "development", "finance", "hr", "leadership", "management", "marketing", "operations", "sales", "occasion", "holiday",
] as const;

export const ALIAS_ANIMALS = [
  "Otter", "Fox", "Panda", "Koala", "Falcon", "Badger", "Lynx", "Heron", "Moose", "Gecko", "Bison", "Puffin",
  "Walrus", "Raven", "Tiger", "Llama", "Narwhal", "Hedgehog", "Dolphin", "Owl", "Beaver", "Penguin", "Yak", "Quokka",
];
export const ALIAS_ADJECTIVES = [
  "Brave", "Calm", "Clever", "Curious", "Daring", "Eager", "Gentle", "Happy", "Jolly", "Kind", "Lucky", "Mighty",
  "Nimble", "Quiet", "Swift", "Witty", "Bright", "Bold", "Cosmic", "Sunny",
];

export const SENTIMENT_LABELS = [
  "Very negative", "Negative", "Somewhat negative", "Little negative", "Neutral", "Little positive", "Somewhat positive", "Positive", "Very positive",
];
