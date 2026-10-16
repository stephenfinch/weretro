import type { MeetingType } from "./types";

/** Per-team notification switches each member controls in Team settings → Notifications. */
export const TEAM_NOTIFICATIONS: { key: string; group: "meetings" | "actions" | "mentions"; label: string; hint: string }[] = [
  { key: "reminder.standup", group: "meetings", label: "Standup reminders", hint: "When your standup update is due" },
  { key: "reminder.retrospective", group: "meetings", label: "Retrospective reminders", hint: "When your retrospective is due" },
  { key: "reminder.healthCheck", group: "meetings", label: "Health check reminders", hint: "When your health check is due" },
  { key: "reminder.estimation", group: "meetings", label: "Estimation reminders", hint: "When your estimation is due" },
  { key: "open.standup", group: "meetings", label: "Standup open", hint: "When a recurring standup opens for input" },
  { key: "open.retrospective", group: "meetings", label: "Retrospective open", hint: "When a recurring retrospective opens for input" },
  { key: "open.healthCheck", group: "meetings", label: "Health check open", hint: "When a recurring health check opens for input" },
  { key: "summary.retrospective", group: "meetings", label: "Automatic retrospective summaries", hint: "When a retrospective is completed (skips empty meetings)" },
  { key: "summary.healthCheck", group: "meetings", label: "Automatic health check summaries", hint: "When a health check is completed (skips empty meetings)" },
  { key: "summary.estimation", group: "meetings", label: "Automatic estimation summaries", hint: "When an estimation is completed (skips empty meetings)" },
  { key: "summary.standup", group: "meetings", label: "Automatic standup summaries", hint: "When a standup is completed (skips empty meetings)" },
  { key: "actionReminders", group: "actions", label: "Periodic action reminders", hint: "When an action due date is approaching" },
  { key: "mentions", group: "mentions", label: "Mentions", hint: "When someone @mentions you" },
  { key: "kudos", group: "mentions", label: "Kudos", hint: "When you receive kudos from a team member" },
];

export const TEAM_NOTIFICATION_GROUPS = [
  { key: "meetings", label: "Meetings" },
  { key: "actions", label: "Actions" },
  { key: "mentions", label: "Mentions & kudos" },
] as const;

/** Everything is on unless the member turned the item or its whole group off. */
export function teamWants(prefs: Record<string, unknown> | null | undefined, key: string) {
  const item = TEAM_NOTIFICATIONS.find((n) => n.key === key);
  if (item && prefs?.[`group.${item.group}`] === false) return false;
  return prefs?.[key] !== false;
}

export const teamKey = (kind: "reminder" | "open" | "summary", type: MeetingType | string) => `${kind}.${type}`;
