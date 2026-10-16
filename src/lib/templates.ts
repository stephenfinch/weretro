import type { TemplateBody, Topic } from "./types";

export type BuiltinTemplate = {
  id: string; // "builtin:<key>"
  key: string;
  meetingType: "retrospective" | "standup";
  category: "standard" | "milestone" | "specialized" | "custom" | "community";
  name: string;
  descriptionShort: string;
  tags: string[];
  popularity: number;
  body: TemplateBody;
};

type TopicSpec = [title: string, color: string, icon: string, description?: string, type?: Topic["type"]];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function tpl(
  name: string,
  category: BuiltinTemplate["category"],
  descriptionShort: string,
  topics: TopicSpec[],
  extra: { tags?: string[]; popularity?: number; whenToUse?: string; tips?: string; meetingType?: "retrospective" | "standup"; schedule?: TemplateBody["schedule"] } = {},
): BuiltinTemplate {
  const key = slug(name);
  return {
    id: `builtin:${key}`,
    key,
    meetingType: extra.meetingType ?? "retrospective",
    category,
    name,
    descriptionShort,
    tags: extra.tags ?? [],
    popularity: extra.popularity ?? 0,
    body: {
      title: name,
      topics: topics.map(([title, color, icon, description, type], i) => ({
        id: `t${i + 1}`,
        title,
        color,
        icon,
        description: description ?? "",
        ...(type ? { type } : {}),
      })),
      whenToUse: extra.whenToUse,
      tips: extra.tips,
      schedule: extra.schedule,
    },
  };
}

const G = "#22C55E", R = "#EF4444", B = "#3B82F6", Y = "#EAB308", O = "#F97316", P = "#A855F7", A = "#F59E0B", C = "#06B6D4", GR = "#64748B", L = "#84CC16", PK = "#EC4899", I = "#6366F1", T = "#14B8A6", BR = "#92400E";

export const RETRO_TEMPLATES: BuiltinTemplate[] = [
  tpl("Agile Retrospective", "standard", "The classic four-column retro", [
    ["What went well?", G, "smile", "Wins worth celebrating"],
    ["What went less well?", R, "frown", "Things that slowed us down"],
    ["What do we want to try next?", B, "lightbulb", "Experiments for next time"],
    ["What puzzles us?", Y, "circle-help", "Open questions"],
  ], { popularity: 100, whenToUse: "A dependable default for any sprint or project retrospective.", tips: "Timebox brainstorming to 5–7 minutes and keep the discussion focused on top-voted groups." }),
  tpl("Start Stop Continue", "standard", "Decide what to start, stop and keep doing", [
    ["Start", G, "play", "New habits worth trying"],
    ["Stop", R, "octagon", "Things that don't help us"],
    ["Continue", A, "repeat", "What's working and should stay"],
  ], { popularity: 95, whenToUse: "Great for quick, action-focused retros." }),
  tpl("Four Ls Retrospective", "standard", "Liked, learned, lacked, longed for", [
    ["Liked", G, "heart", "What you enjoyed"],
    ["Learned", A, "graduation-cap", "What you picked up"],
    ["Lacked", R, "circle-minus", "What was missing"],
    ["Longed for", B, "sparkles", "What you wished for"],
  ], { popularity: 90 }),
  tpl("Mad Sad Glad", "standard", "Talk about how the sprint felt", [
    ["Mad", R, "angry", "What frustrated you"],
    ["Sad", B, "frown", "What disappointed you"],
    ["Glad", G, "smile", "What made you happy"],
  ], { popularity: 88, whenToUse: "Useful when emotions are running high or after a tough stretch." }),
  tpl("FLAP Retrospective", "standard", "Future, lessons, accomplishments, problems", [
    ["Future considerations", G, "telescope", "What should we keep in mind going forward?"],
    ["Lessons learned", B, "book-open", "What did we learn?"],
    ["Accomplishments", A, "trophy", "What did we achieve?"],
    ["Problem areas", R, "triangle-alert", "Where did we struggle?"],
  ], { popularity: 70 }),
  tpl("KALM", "standard", "Keep, add, less, more", [
    ["Keep", Y, "check", "Keep doing as-is"],
    ["Add", G, "plus", "Something new to add"],
    ["Less", O, "chevrons-down", "Do less of this"],
    ["More", B, "chevrons-up", "Do more of this"],
  ], { popularity: 65 }),
  tpl("Anchors & Engines", "standard", "What holds us back and what drives us forward", [
    ["Anchors", R, "anchor", "What's slowing us down"],
    ["Engines", G, "rocket", "What's pushing us forward"],
  ], { popularity: 60 }),
  tpl("WRAP", "standard", "Wishes, risks, appreciations, puzzles", [
    ["Wishes", A, "wand-sparkles", "What we wish for"],
    ["Risks", O, "shield-alert", "What could go wrong"],
    ["Appreciations", G, "hand-heart", "Who or what we appreciate"],
    ["Puzzles", B, "puzzle", "What we don't understand yet"],
  ], { popularity: 55 }),
  tpl("Drop Add Keep Improve", "standard", "DAKI: refine how the team works", [
    ["Drop", R, "trash-2", "Stop doing this"],
    ["Add", G, "plus", "Start doing this"],
    ["Keep", L, "check", "Keep doing this"],
    ["Improve", O, "trending-up", "Do this better"],
  ], { popularity: 58 }),
  tpl("Starfish", "standard", "Five ways to adjust how you work", [
    ["Start", L, "play", "Begin doing"],
    ["More of", "#CDDC39", "chevrons-up", "Do more of"],
    ["Continue", Y, "repeat", "Keep doing"],
    ["Less of", A, "chevrons-down", "Do less of"],
    ["Stop", R, "octagon", "Stop doing"],
  ], { popularity: 62 }),
  tpl("Rose Bud Thorn", "standard", "Highlights, opportunities and pain points", [
    ["Rose", R, "flower", "Highlights and successes"],
    ["Bud", G, "sprout", "Ideas that could grow"],
    ["Thorn", BR, "zap", "Pain points"],
  ], { popularity: 57 }),
  tpl("Sailboat Retrospective", "standard", "Goals, tailwinds, anchors, risks", [
    ["Goal", G, "flag", "Where we're heading"],
    ["Wind", B, "wind", "What pushes us forward"],
    ["Anchor", GR, "anchor", "What holds us back"],
    ["Rocks", R, "mountain", "Risks ahead"],
    ["Sun", O, "sun", "What makes us happy"],
  ], { popularity: 75 }),
  tpl("Start Stop", "standard", "A two-column action retro", [
    ["Start", G, "play", "Begin doing"],
    ["Stop", R, "octagon", "Stop doing"],
  ], { popularity: 40 }),
  tpl("SWOT Analysis", "standard", "Strengths, weaknesses, opportunities, threats", [
    ["Strengths", G, "dumbbell", "What we're good at"],
    ["Weaknesses", C, "battery-low", "Where we fall short"],
    ["Opportunities", A, "door-open", "What we could take advantage of"],
    ["Threats", R, "shield-alert", "What could hurt us"],
  ], { popularity: 50 }),
  tpl("Must Should Could Won't", "standard", "MoSCoW prioritisation", [
    ["Must", R, "circle-alert", "Non-negotiable"],
    ["Should", B, "circle-check", "Important but not vital"],
    ["Could", A, "circle-dot", "Nice to have"],
    ["Won't", GR, "circle-x", "Not this time"],
  ], { popularity: 35 }),
  tpl("What? So What? Now What?", "standard", "Facts, meaning, next steps", [
    ["What?", C, "eye", "What happened?"],
    ["So What?", A, "message-circle-question", "Why does it matter?"],
    ["Now What?", G, "footprints", "What do we do next?"],
  ], { popularity: 38 }),
  tpl("Scrum Values", "standard", "Reflect on the five Scrum values", [
    ["Courage", R, "shield", "Where did we show or lack courage?"],
    ["Focus", G, "crosshair", "Did we stay focused?"],
    ["Openness", Y, "door-open", "Were we open with each other?"],
    ["Respect", P, "handshake", "Did we respect each other?"],
    ["Commitment", B, "target", "Did we honour our commitments?"],
  ], { popularity: 33 }),
  tpl("Rate of Improvement", "standard", "Find the improvements with the best return", [
    ["Highest ROI", L, "trending-up", "Changes that paid off most"],
    ["Lowest ROI", R, "trending-down", "Changes that didn't pay off"],
    ["Potential ROI", Y, "gem", "Changes that might pay off"],
  ], { popularity: 22 }),
  tpl("Cross-Team Collaboration", "standard", "How well we work with other teams", [
    ["Collaboration Enablers", G, "link", "What helps us work together"],
    ["Communication Challenges", B, "message-square-warning", "Where communication breaks down"],
    ["Synergy Opportunities", O, "merge", "Where we could join forces"],
    ["Trust and Psychological Safety", PK, "shield-check", "How safe we feel with each other"],
    ["Ideal Outcomes", P, "star", "What great looks like"],
  ], { popularity: 25 }),
  tpl("Definition of Done", "standard", "Agree what 'done' really means", [
    ["Quality Criteria", B, "badge-check", "Quality bars every item must meet"],
    ["Documentation & Communication", G, "file-text", "What must be written down or shared"],
    ["Testing & Validation", O, "flask-conical", "How we prove it works"],
    ["Deployment & Readiness", P, "rocket", "What it takes to ship"],
  ], { popularity: 24 }),
  tpl("Fishbone (Ishikawa)", "standard", "Dig into the root causes of a problem", [
    ["System", I, "cpu", "Tools and technology"],
    ["Process", T, "workflow", "How work flows"],
    ["Forms", B, "file-input", "Inputs, data and paperwork"],
    ["People", O, "users", "Skills and roles"],
    ["Policies", "#FF5722", "scale", "Rules and constraints"],
    ["Place", P, "map-pin", "Environment"],
  ], { popularity: 30 }),
  tpl("Lean Coffee", "standard", "An agenda-less, team-driven discussion", [
    ["To Discuss", G, "coffee", "Topics people want to talk about"],
    ["In Progress", R, "message-circle", "Being discussed now"],
    ["Discussed", B, "check-check", "Done"],
  ], { popularity: 45 }),
  tpl("Mountain Climber", "standard", "Plan the climb to your goal", [
    ["Base Camp", G, "tent", "Where we are now"],
    ["Obstacles Ahead", R, "mountain", "What's in our way"],
    ["Climbing Gear", B, "backpack", "What we have to help us"],
    ["Summit Goals", "#673AB7", "flag", "Where we want to get"],
  ], { popularity: 28 }),
  tpl("Original Four", "standard", "Norm Kerth's four key questions", [
    ["What did we do well?", G, "thumbs-up", ""],
    ["What did we learn?", B, "book-open", ""],
    ["What should we do differently?", O, "refresh-cw", ""],
    ["What still puzzles us?", P, "circle-help", ""],
  ], { popularity: 42 }),
  tpl("Sprint Retrospective", "standard", "A sprint-focused four-column retro", [
    ["What went well?", G, "smile", ""],
    ["What could be improved?", R, "wrench", ""],
    ["What actions can we take?", Y, "list-checks", ""],
    ["What still puzzles us?", "#9E9E9E", "circle-help", ""],
  ], { popularity: 80 }),
  tpl("Sprint Review Feedback", "standard", "Collect stakeholder feedback after a review", [
    ["What went well?", G, "smile", ""],
    ["What could be improved?", O, "wrench", ""],
    ["How can we improve?", B, "lightbulb", ""],
    ["Additional Feedback", P, "message-square", ""],
  ], { popularity: 30 }),
  tpl("Strategic Roadmap Planning", "standard", "Look ahead and plan the roadmap", [
    ["Key Objectives", G, "target", ""],
    ["Long-Term Goals", B, "telescope", ""],
    ["Short-Term Goals", O, "calendar-check", ""],
    ["Milestones", P, "milestone", ""],
  ], { popularity: 20 }),

  // Milestone
  tpl("New Year Kickoff", "milestone", "Start the year with clear priorities", [
    ["Highlights and Achievements", G, "trophy", ""], ["Challenges and Lessons Learned", R, "book-open", ""], ["Goals and Priorities", B, "target", ""], ["Continuous Improvement", P, "trending-up", ""],
  ], { tags: ["occasion"] }),
  tpl("Mid-Year Goal Check-In", "milestone", "Check progress halfway through the year", [
    ["Progress Update", G, "gauge", ""], ["Alignment with Values", B, "compass", ""], ["Hurdles and Challenges", R, "triangle-alert", ""], ["Habits and Behaviors", O, "repeat", ""], ["Next Steps", P, "footprints", ""],
  ]),
  tpl("Project Kickoff", "milestone", "Align before a project starts", [
    ["Project Goals", G, "target", ""], ["Key Processes", B, "workflow", ""], ["Potential Risks", R, "shield-alert", ""], ["Team & Dependencies", O, "users", ""], ["Timeline & Milestones", P, "calendar", ""],
  ]),
  tpl("Post-Mortem", "milestone", "Learn from a finished project or incident", [
    ["Project overview, goals and scope", B, "file-text", ""], ["What went well", G, "thumbs-up", ""], ["What didn't go well", R, "thumbs-down", ""], ["Root cause analysis", O, "search", ""], ["Lessons learned", P, "book-open", ""], ["Action items, owners and deadlines", Y, "list-checks", ""], ["Team appreciation and kudos", PK, "hand-heart", ""],
  ]),
  tpl("Post-Launch", "milestone", "Reflect after shipping", [
    ["What Went Well?", G, "rocket", ""], ["Challenges Faced", R, "triangle-alert", ""], ["Customer Feedback", B, "message-square", ""], ["Improvements for Next Time", P, "trending-up", ""],
  ]),
  tpl("End of Year", "milestone", "Look back over the whole year", [
    ["Highlights and achievements", G, "trophy", ""], ["Challenges and obstacles", R, "mountain", ""], ["Lessons learned", B, "book-open", ""], ["Areas for improvement", P, "trending-up", ""],
  ], { tags: ["occasion"] }),
  tpl("Fiscal Year-End Review", "milestone", "Review the financial year", [
    ["Revenue Analysis", G, "chart-line", ""], ["Expense Management", R, "receipt", ""], ["Strategic Initiatives", B, "target", ""], ["Strategic Outlook", P, "telescope", ""],
  ], { tags: ["finance"] }),
  tpl("Project Wrap Up", "milestone", "Close out a project together", [
    ["Successes and Wins", G, "trophy", ""], ["Challenges and Obstacles", R, "mountain", ""], ["Lessons Learned", B, "book-open", ""], ["Process Improvements", O, "workflow", ""], ["Team Dynamics and Culture", P, "users", ""],
  ]),
  tpl("Team Retreat Planning", "milestone", "Plan an offsite the team will love", [
    ["Retreat Goals", G, "target", ""], ["Agenda Planning", B, "calendar", ""], ["Team Bonding", PK, "heart-handshake", ""], ["Venue and Logistics", O, "map-pin", ""],
  ], { tags: ["occasion"] }),

  // Specialized
  ...([
    ["Company Culture", ["Our Core Values", "Communication and Collaboration", "Leadership and Management", "Innovation and Growth", "Employee Engagement", "Diversity and Inclusion"], ["hr", "leadership"]],
    ["Logistics and Supply Chain", ["Successful Deliveries", "Inventory Challenges", "Process Improvements", "Collaboration and Communication"], ["operations"]],
    ["Customer Feedback", ["Positive Feedback", "Areas for Improvement", "Innovative Ideas", "Action Plan"], ["customerSupport"]],
    ["Staff Retention Strategy", ["What motivates our employees?", "Our Company's Capabilities", "Areas for Improvement", "Retention Strategies", "Building a Supportive Culture"], ["hr"]],
    ["Fostering an Inclusive Workplace", ["Diversity Perspectives", "Equitable Opportunities", "Inclusive Practices", "Psychological Safety", "Allyship and Advocacy"], ["hr"]],
    ["Product Development Process", ["Process Alignment", "Process Efficiency", "Cross-Functional Collaboration", "Data-Driven Decisions", "Innovation and Growth"], ["development"]],
    ["Lead Generation and Quality", ["Lead Sources", "Lead Quality", "Conversion Rates", "Areas for Improvement"], ["sales", "marketing"]],
    ["Incident Response", ["Incident Overview", "What Went Well", "Areas for Improvement", "Action Items", "Lessons Learned", "Stakeholder Feedback"], ["development", "operations"]],
    ["Leadership Effectiveness", ["Our Achievements", "Areas for Improvement", "Strategic Alignment", "Stakeholder Feedback", "Team Dynamics"], ["leadership"]],
    ["Lead Generation Strategy", ["What went well?", "What didn't go well?", "What did we learn?", "What should we do next?"], ["sales", "marketing"]],
    ["Ticket Resolution", ["Ticket Highlights", "Process Challenges", "Communication Gaps", "Improvement Ideas"], ["customerSupport"]],
    ["Employee Engagement", ["What energizes you?", "What drains your energy?", "How can we improve teamwork?", "How can leadership support us?"], ["hr"]],
    ["Incident Response Planning", ["Potential Incidents", "Response Strategies", "Roles and Responsibilities", "Communication Protocols", "Recovery and Continuity", "Continuous Improvement"], ["operations"]],
    ["Bug Fixing", ["Recent Bugs", "Root Causes", "Preventative Actions", "Quality Targets", "Our Learnings"], ["development"]],
    ["DevOps", ["Successful Deployments", "Areas for Improvement", "Collaboration and Culture", "Tools and Processes"], ["development"]],
    ["Vision and Mission Alignment", ["Guiding Vision & Mission", "Progress & Achievements", "Obstacles & Misalignment", "Path Forward"], ["leadership"]],
    ["Budget Planning Futurespective", ["Strategic Initiatives", "Revenue Streams", "Cost Optimization", "Growth Investments"], ["finance"]],
    ["Code Review", ["What is going well?", "What isn't going well?", "What can we improve?", "What questions have surfaced?"], ["development"]],
    ["Strategic Alignment Review", ["Vision", "Goals", "Current Priorities", "Organizational Capabilities", "Stakeholder Engagement", "Risks and opportunities"], ["leadership", "management"]],
    ["Pipeline Management", ["Pipeline Bottlenecks", "Pipeline Streamlining", "Pipeline Roadblocks", "Pipeline Collaboration"], ["sales"]],
    ["Hiring Process", ["Successful Hiring Practices", "Hiring Process Challenges", "Areas for Improvement", "Action Plan"], ["hr"]],
    ["Marketing Campaign Futurespective", ["Campaign Goals", "Target Audience", "Brand Messaging", "Marketing Channels", "Campaign Strategies", "Metrics and Measurement"], ["marketing"]],
    ["New Team Member Onboarding", ["Company Culture", "Role Responsibilities", "Team Dynamics", "Growth and Development", "Open Discussion"], ["hr"]],
    ["Marketing Campaign", ["Campaign Performance", "Customer Feedback", "Return on Investment", "Brand Impact", "Lessons Learned"], ["marketing"]],
    ["Content Strategy", ["Audience Engagement", "Content Quality", "Channel Effectiveness", "Workflow Optimization"], ["marketing"]],
    ["Escalation Process", ["Recent Escalations", "Escalation Effectiveness", "Process Improvements", "Collaboration and Communication"], ["customerSupport"]],
    ["Social Media", ["What went well?", "What could be improved?", "What should we start doing?", "What should we stop doing?"], ["marketing"]],
    ["Technical Debt", ["Sources of Debt", "Impact and Risks", "Prioritization", "Action Plan"], ["development"]],
    ["Support Tools and Resources", ["Support Tools Evaluation", "Resource Availability", "Process Efficiency", "Collaboration and Communication"], ["customerSupport"]],
    ["Vendor Management", ["What's Working Well?", "Pain Points & Challenges", "Process & Workflow", "Strategic Alignment", "Cost Optimization"], ["operations"]],
    ["SLA Compliance", ["SLA Metrics Review", "SLA Challenges", "Improvement Opportunities", "Cross-Team Collaboration"], ["customerSupport", "operations"]],
    ["Lost Deals", ["What went wrong?", "What went well?", "What can we learn?", "What should we do differently?"], ["sales"]],
    ["Quarterly Sales", ["Wins and Achievements", "Challenges Faced", "Lessons Learned", "Actions for Next Quarter"], ["sales"]],
    ["Operational Efficiency Review", ["Operational Wins", "Areas for Improvement", "Potential Solutions", "Action Plans"], ["operations"]],
  ] as [string, string[], string[]][]).map(([name, titles, tags]) => {
    const colors = [G, B, O, P, R, T];
    const icons = ["circle-check", "lightbulb", "triangle-alert", "target", "users", "trending-up"];
    return tpl(name, "specialized", `A retro focused on ${name.toLowerCase()}`, titles.map((title, i) => [title, colors[i % colors.length], icons[i % icons.length], ""] as TopicSpec), { tags });
  }),
];

const weekdays = { freq: "week" as const, interval: 1, weekdays: ["mon", "tue", "wed", "thu", "fri"] };

export const STANDUP_TEMPLATES: BuiltinTemplate[] = [
  tpl("Daily Standup", "standard", "Yesterday, today, blockers", [
    ["What did you do yesterday?", "#3B82F6", "check", "Completed work, progress or decisions", "done"],
    ["What will you do today?", "#8B5CF6", "arrow-right", "Your focus and priorities", "doing"],
    ["What is blocking you?", "#EF4444", "octagon-alert", "Blockers, risks or where you need help", "blocked"],
  ], { meetingType: "standup", popularity: 100, schedule: { recurrence: weekdays, time: "09:00", opens: "anytime" } }),
  tpl("Daily Stand-down", "standard", "End-of-day wrap-up", [
    ["What did you finish today?", "#3B82F6", "check", "", "done"],
    ["What carries over to tomorrow?", "#8B5CF6", "arrow-right", "", "doing"],
    ["Any blockers for tomorrow?", "#EF4444", "octagon-alert", "", "blocked"],
  ], { meetingType: "standup", popularity: 60, schedule: { recurrence: weekdays, time: "16:00", opens: "anytime" } }),
  tpl("Async check-in", "standard", "Lightweight async update", [
    ["What did you get done since your last check-in?", "#3B82F6", "check", "", "done"],
    ["What's your focus today?", "#8B5CF6", "arrow-right", "", "doing"],
    ["Anything blocking you?", "#EF4444", "octagon-alert", "", "blocked"],
  ], { meetingType: "standup", popularity: 50, schedule: { recurrence: weekdays, time: "09:00", opens: "anytime" } }),
  tpl("Weekly sync", "standard", "Wins, priorities and help needed", [
    ["What were your wins this week?", "#10B981", "trophy", "", "done"],
    ["What are your top priorities next week?", "#8B5CF6", "arrow-right", "", "doing"],
    ["Where do you need help or unblocking?", "#EF4444", "octagon-alert", "", "blocked"],
  ], { meetingType: "standup", popularity: 40, schedule: { recurrence: { freq: "week", interval: 1, weekdays: ["fri"] }, time: "15:00", opens: "anytime" } }),
  tpl("Goal-focused standup", "community", "Updates framed around the sprint goal", [
    ["What did you do to move the sprint goal forward?", "#3B82F6", "check", "", "done"],
    ["What will you do today toward the goal?", "#8B5CF6", "arrow-right", "", "doing"],
    ["What is blocking the goal?", "#EF4444", "octagon-alert", "", "blocked"],
  ], { meetingType: "standup" }),
  tpl("Support team huddle", "community", "Queue health and escalations", [
    ["How is the queue looking?", "#3B82F6", "inbox", ""],
    ["Which tickets need escalation or another pair of eyes?", "#8B5CF6", "eye", "", "doing"],
    ["Anything blocking you from resolving a ticket?", "#EF4444", "octagon-alert", "", "blocked"],
  ], { meetingType: "standup", tags: ["customerSupport"] }),
  tpl("Design crit check-in", "community", "Design progress and feedback needs", [
    ["What are you designing right now?", "#3B82F6", "pen-tool", "", "doing"],
    ["What feedback or review do you need today?", "#8B5CF6", "message-square", ""],
    ["Anything blocking your design work?", "#EF4444", "octagon-alert", "", "blocked"],
  ], { meetingType: "standup" }),
];

export const ALL_BUILTIN_TEMPLATES = [...RETRO_TEMPLATES, ...STANDUP_TEMPLATES];

export function findBuiltinTemplate(id: string) {
  return ALL_BUILTIN_TEMPLATES.find((t) => t.id === id || t.key === id);
}
