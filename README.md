# WeRetro

Open-source agile meetings for teams: **retrospectives, standups, health checks and estimations** in one app, with shared actions, agreements and a parking lot that follow your team from meeting to meeting.

Built with Next.js 16, React 19, Tailwind CSS 4, Drizzle ORM and Postgres (Neon or any Postgres 14+).

## Features

**Meetings**

- **Retrospectives**: brainstorm → group → vote → discuss → review → close. 70+ built-in templates (standard, milestone and specialized) plus custom templates. Optional icebreaker, check-in question and "review open actions" steps.
- **Standups**: recurring series with a schedule, questions you choose, async updates, carry-over of yesterday's items and blockers, @mentions and reminders.
- **Health checks**: 15 built-in health models (numeric, happiness, Likert, favorability and more), anonymous surveys, radar and distribution charts, comparison with the previous check, comment summaries.
- **Estimations**: planning poker with 8 built-in decks or custom decks, hidden votes and reveal, consensus suggestions, import from and sync back to Jira, Linear, GitHub, Azure DevOps and others.

**Facilitation**

- Anonymity per meeting: names, aliases, or fully anonymous; hidden ideas until the next step.
- Per-step options (vote limits, topic and item limits, reveal timing, sorting, who can group or add actions).
- Present mode, shared timer with music, live reactions, agree/disagree, slower/faster, raised hands.
- 20+ icebreaker games and a question bank; check-in and check-out questions.
- Comments, reactions, polls, kudos, GIFs, images and Excalidraw whiteboards on ideas.
- Facilitator hand-over, guest links, observers, customize a meeting while it runs.

**Teams and organizations**

- Organizations with owners, admins and insights viewers; teams with admin, member and observer roles; configurable permissions per team.
- Programs that group several teams, team transparency, allowed email domains and domain capture, guest controls.
- Team home with open meetings, actions, agreements, parking lot, and recently closed meetings.
- Insights per team, program or organization: health trends, action completion, participation, sentiment and themes.
- Exports to Markdown, CSV, Excel and a printable PDF report.
- Email notifications (mentions, kudos, assignments, reminders, summaries) with per-user preferences.
- Recently deleted meetings and series can be restored for 30 days.

**Integrations and API**

- Publish actions, agreements and summaries to Jira, GitHub, GitLab, Linear, Trello, Asana, ClickUp, Azure DevOps, Shortcut, monday.com, Basecamp, Slack, Microsoft Teams, Notion and Confluence.
- Outgoing webhooks, Zapier and n8n with HMAC signatures.
- REST API (`/api/v1`), an MCP server (`/api/mcp`) for AI assistants, and SCIM 2.0 user provisioning (`/api/scim/v2`). See `/docs/api` in a running instance.

**AI (optional, Claude)**

- Grouping and action suggestions, meeting summaries, health comment summaries, AI-generated templates and health models, icebreaker questions, theme analysis in insights, and an in-meeting assistant that can read previous meetings and create actions.
- Off unless `ANTHROPIC_API_KEY` is set; organizations can also turn it off.

## Quick start

Requirements: Node.js 20+, pnpm, and a Postgres database.

```bash
git clone <your fork url> weretro
cd weretro
pnpm install
cp .env.example .env.local     # set DATABASE_URL, APP_URL and SESSION_SECRET
pnpm db:push                   # create the tables
pnpm db:seed                   # optional demo data
pnpm dev
```

Open http://localhost:3000. With the seed data, sign in as `avery@weretro.dev` with the password `weretro-demo`.

Without `SMTP_URL`, emails (sign-in links, invitations, summaries) are not sent. They are stored and shown at **/dev/mail** in development.

### Using Neon

1. Create a project at [neon.tech](https://neon.tech) and copy the pooled connection string.
2. Set `DATABASE_URL` to it. URLs that contain `neon.tech` automatically use the Neon serverless driver (set `DB_DRIVER=pg` to force node-postgres).
3. Run `pnpm db:push`.

## Deploying to Vercel

1. Import the repository in Vercel and add the Neon integration (or set `DATABASE_URL` yourself).
2. Set `APP_URL` to your production URL, `SESSION_SECRET` to a random string, and `CRON_SECRET` to protect the scheduler.
3. `vercel.json` runs `/api/cron` every 10 minutes. It creates scheduled standups and recurring meetings and sends action reminders.
4. Optional: `SMTP_URL` and `MAIL_FROM` for email, OAuth client IDs for Google, GitHub and Microsoft sign-in, `ANTHROPIC_API_KEY` for AI, `GIPHY_API_KEY` or `TENOR_API_KEY` for GIF search.

Any other host works too: run `pnpm build && pnpm start` and call `GET /api/cron` with `Authorization: Bearer $CRON_SECRET` every few minutes.

## Configuration

All settings are environment variables. See [.env.example](.env.example) for the full list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | yes | Public URL, used in emails and OAuth callbacks |
| `SESSION_SECRET` | yes | Signs guest links |
| `SMTP_URL`, `MAIL_FROM` | no | Outgoing email |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | no | AI features (default model `claude-opus-5-5`) |
| `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*` | no | OAuth sign-in |
| `CRON_SECRET` | no | Protects `/api/cron` |
| `GIPHY_API_KEY`, `TENOR_API_KEY` | no | GIF search |

## How it works

- **App Router** pages render on the server; interactive parts are client components. Mutations use server actions or small JSON routes.
- **Realtime** without extra infrastructure: every meeting row has a `version` that each change increments. Browsers long-poll `GET /api/meetings/:id/state?v=<version>`, which returns as soon as the version changes. Within one server process waiters wake instantly through an in-memory event bus; across serverless instances the poll re-checks the database every second.
- **Per-viewer state**: the server builds each participant's view of a meeting, so hidden ideas, anonymous votes and private health ratings never reach other browsers.
- **Meeting operations** (`src/server/meetings/ops.ts`) are the single place where meeting data changes. The UI, the AI assistant, demo robots and the seed script all use them.

```
src/
  app/                  routes (pages, server actions, API routes)
  components/           UI (meeting room, settings, insights, shadcn/ui)
  db/                   Drizzle schema and client
  lib/                  shared types, constants, templates, health models
  server/               auth, access control, meetings, integrations, AI, API
scripts/seed.ts         demo data
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm typecheck` | Generate route types and run TypeScript |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Sync the schema to the database |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and run SQL migrations |
| `pnpm db:seed` | Load demo data |

## License

[MIT](LICENSE)
