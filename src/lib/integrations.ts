export type IntegrationField = { key: string; label: string; placeholder?: string; secret?: boolean; optional?: boolean; help?: string };
export type IntegrationDef = {
  type: string;
  name: string;
  description: string;
  kind: "tasks" | "chat" | "docs" | "automation";
  publishes: ("actions" | "agreements" | "summary" | "estimates" | "events")[];
  fields: IntegrationField[];
  docs?: string;
};

export const INTEGRATIONS: IntegrationDef[] = [
  {
    type: "jira",
    name: "Jira",
    description: "Publish action items as Jira issues and sync estimates as story points",
    kind: "tasks",
    publishes: ["actions", "estimates"],
    fields: [
      { key: "baseUrl", label: "Site URL", placeholder: "https://your-site.atlassian.net" },
      { key: "email", label: "Account email" },
      { key: "apiToken", label: "API token", secret: true, help: "Create one at id.atlassian.com → Security → API tokens" },
      { key: "projectKey", label: "Project key", placeholder: "ENG" },
      { key: "issueType", label: "Issue type", placeholder: "Task", optional: true },
      { key: "storyPointsField", label: "Story points field id", placeholder: "customfield_10016", optional: true },
    ],
  },
  {
    type: "github",
    name: "GitHub",
    description: "Publish action items as GitHub issues",
    kind: "tasks",
    publishes: ["actions", "estimates"],
    fields: [
      { key: "token", label: "Personal access token", secret: true, help: "Needs the Issues: read & write permission" },
      { key: "repo", label: "Repository", placeholder: "owner/name" },
      { key: "labels", label: "Labels (comma separated)", optional: true },
    ],
  },
  {
    type: "gitlab",
    name: "GitLab",
    description: "Publish action items as GitLab issues",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "baseUrl", label: "GitLab URL", placeholder: "https://gitlab.com", optional: true },
      { key: "token", label: "Access token", secret: true },
      { key: "projectId", label: "Project ID or path", placeholder: "group/project" },
    ],
  },
  {
    type: "azure",
    name: "Azure DevOps",
    description: "Publish action items as Azure DevOps work items",
    kind: "tasks",
    publishes: ["actions", "estimates"],
    fields: [
      { key: "organization", label: "Organization" },
      { key: "project", label: "Project" },
      { key: "pat", label: "Personal access token", secret: true },
      { key: "workItemType", label: "Work item type", placeholder: "Task", optional: true },
    ],
  },
  {
    type: "linear",
    name: "Linear",
    description: "Publish action items as Linear issues",
    kind: "tasks",
    publishes: ["actions", "estimates"],
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "teamId", label: "Team ID", help: "Find it in Linear → Settings → Teams → (copy ID)" },
    ],
  },
  {
    type: "trello",
    name: "Trello",
    description: "Publish action items as Trello cards",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "key", label: "API key" },
      { key: "token", label: "Token", secret: true },
      { key: "listId", label: "List ID" },
    ],
  },
  {
    type: "asana",
    name: "Asana",
    description: "Publish action items as Asana tasks",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "token", label: "Personal access token", secret: true },
      { key: "projectId", label: "Project ID" },
    ],
  },
  {
    type: "clickup",
    name: "ClickUp",
    description: "Publish action items as ClickUp tasks",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "token", label: "API token", secret: true },
      { key: "listId", label: "List ID" },
    ],
  },
  {
    type: "monday",
    name: "monday.com",
    description: "Publish action items to a monday.com board",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "token", label: "API token", secret: true },
      { key: "boardId", label: "Board ID" },
    ],
  },
  {
    type: "shortcut",
    name: "Shortcut",
    description: "Publish action items as Shortcut stories",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "token", label: "API token", secret: true },
      { key: "workflowStateId", label: "Workflow state ID" },
    ],
  },
  {
    type: "basecamp",
    name: "Basecamp",
    description: "Publish action items as Basecamp to-dos",
    kind: "tasks",
    publishes: ["actions"],
    fields: [
      { key: "accessToken", label: "Access token", secret: true },
      { key: "accountId", label: "Account ID" },
      { key: "projectId", label: "Project ID" },
      { key: "todolistId", label: "To-do list ID" },
    ],
  },
  {
    type: "slack",
    name: "Slack",
    description: "Post meeting invites, actions, agreements and summaries to a Slack channel",
    kind: "chat",
    publishes: ["actions", "agreements", "summary", "events"],
    fields: [{ key: "webhookUrl", label: "Incoming webhook URL", secret: true, placeholder: "https://hooks.slack.com/services/…" }],
  },
  {
    type: "microsoftTeams",
    name: "Microsoft Teams",
    description: "Post meeting invites, actions, agreements and summaries to a Teams channel",
    kind: "chat",
    publishes: ["actions", "agreements", "summary", "events"],
    fields: [{ key: "webhookUrl", label: "Incoming webhook / workflow URL", secret: true }],
  },
  {
    type: "notion",
    name: "Notion",
    description: "Publish meeting reports to Notion",
    kind: "docs",
    publishes: ["summary"],
    fields: [
      { key: "token", label: "Integration token", secret: true },
      { key: "parentPageId", label: "Parent page ID" },
    ],
  },
  {
    type: "confluence",
    name: "Confluence",
    description: "Publish meeting reports to Confluence",
    kind: "docs",
    publishes: ["summary"],
    fields: [
      { key: "baseUrl", label: "Site URL", placeholder: "https://your-site.atlassian.net" },
      { key: "email", label: "Account email" },
      { key: "apiToken", label: "API token", secret: true },
      { key: "spaceKey", label: "Space key" },
      { key: "parentId", label: "Parent page ID", optional: true },
    ],
  },
  {
    type: "webhook",
    name: "Webhook",
    description: "Send event notifications to your own endpoint",
    kind: "automation",
    publishes: ["events"],
    fields: [
      { key: "url", label: "Endpoint URL" },
      { key: "secret", label: "Signing secret", secret: true, optional: true, help: "Requests are signed with HMAC-SHA256 in the x-weretro-signature header" },
      { key: "events", label: "Events (comma separated, blank for all)", optional: true },
    ],
  },
  {
    type: "n8n",
    name: "n8n",
    description: "Automate WeRetro with n8n workflows",
    kind: "automation",
    publishes: ["events"],
    fields: [
      { key: "url", label: "n8n webhook URL" },
      { key: "events", label: "Events (comma separated, blank for all)", optional: true },
    ],
  },
  {
    type: "zapier",
    name: "Zapier",
    description: "Connect WeRetro to thousands of apps with Zapier",
    kind: "automation",
    publishes: ["events"],
    fields: [
      { key: "url", label: "Zapier catch-hook URL" },
      { key: "events", label: "Events (comma separated, blank for all)", optional: true },
    ],
  },
];

export const integrationDef = (type: string) => INTEGRATIONS.find((i) => i.type === type);
