# Project Tracker

Responsive, ADO-style tracker for **projects, work items, sprints and bugs** with role-based access (**Admin / Manager / Employee**).
Roadmap and design: see [PROJECT_PLAN.md](PROJECT_PLAN.md).

| Layer    | Tech                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Web      | React 19 · Vite 8 · Tailwind CSS 4 · TanStack Query · React Hook Form + Zod   |
| API      | Node 22 · Express 5 · TypeScript · Prisma 7 (pg adapter) · JWT · Google OAuth2 |
| Database | PostgreSQL 16                                                                 |
| Email    | Nodemailer (SMTP) · Mailpit in development                                     |
| DevOps   | Docker / Docker Compose · Nginx · GitHub Actions                              |

## Phase 1 status — done

- Email + password **registration with email verification**, login, logout, forgot / reset password, change password, profile
- **Google OAuth2** sign-in / sign-up (Authorization Code + PKCE + state), automatic account linking by email
- **JWT** access tokens (15 min, in memory) + rotating **httpOnly refresh cookie** with reuse detection
- **RBAC**: shared permission matrix (`packages/shared/src/permissions.ts`) enforced by API middleware and used by the UI (`<Can>`)
- **Admin user management**: invite by email, change role, activate / deactivate, resend invite
- **Email notifications**: verify, welcome, reset, password changed, invite, role changed, account (de)activated — logged in `email_logs`
- Security: helmet (CSP, HSTS), CORS allow-list, rate limiting, CSRF origin check, bcrypt, audit log, env validation
- Responsive app shell (sidebar → drawer on mobile), dark mode

## Phase 2 status — done

- **Projects**: create / edit / archive / restore / delete (admin, archived only), auto-generated keys (`BCM`, `AEA` …), priority, status, dev status, dates (start ≤ target enforced)
- **Project access**: Admin sees all; others see only projects they belong to. Project roles **Manager / Member / Viewer**; only project managers edit. Only global Admins/Managers can be project managers
- **Members**: add (with email notification), change project role, remove (owner and last manager protected)
- **Environments**: DEV / QA / UAT / STAGING / PROD with URL, deployment status (Not deployed / Deployed / Live / Down), deploy date, notes
- **Projects list**: search, filters (status, priority, dev status, category, archived, mine), sorting, table / card views, filters kept in the URL
- **Excel import** with preview (`/projects/import`): maps `Project Details.xlsx` columns, skips existing names, flags bad data, never imports credentials
- **Export** to Excel / CSV (respects current filters)
- **Categories** admin page (colour, rename, deactivate, delete when unused)
- Dashboard shows live project counts and recently updated projects

## Phase 3 status — done

- **Work items**: Epic → Feature → User Story → Task / Bug, numbered per project (`BCM-1`, `BCM-2` …). Parent rules: Feature→Epic, Story→Feature/Epic, Bug→Story/Feature, Task→Story/Bug
- **Workflows** per type, enforced by the API (`packages/shared/src/schemas/workitem.ts`):
  - Epic / Feature / Story: New → Active → Resolved → Closed (+ Removed)
  - Task: To Do → In Progress → Done (+ Removed); Done sets remaining work to 0
  - Bug: New → Triaged → Active → Resolved → Verified → Closed (+ Removed); resolving sets a resolution (Fixed, Won't fix …), reopening clears it
- **Who can do what**: Viewers read only. Members create stories, tasks and bugs; only Admins / Managers create Epics and Features and assign work to others (employees assign themselves). Employees edit items assigned to or created by them. Project managers delete
- **Fields**: assignee (project members only), priority, severity, story points, original / remaining / completed hours, start / due dates, tags; bugs add repro steps, expected / actual result, found-in environment
- **Collaboration**: Markdown descriptions and comments, `@mentions` (emailed), links (related / blocks / duplicate), attachments up to 10 MB with image previews, full field history
- **Views**: project backlog tree (roll-up progress and points), Work Items list with filters and **saved queries**, Bugs, My Work, work item page at `/items/BCM-12`; the top bar **+ New** creates items anywhere
- **Emails**: assigned to you, mentioned

## Phase 4 status — done

- **Board** (project → Board): Kanban columns New / Active / Resolved / Done for stories & bugs, tasks, features or epics. Drag cards between columns (only workflow-legal moves are accepted) and across swimlanes (by assignee → reassigns, by priority → re-prioritises, by parent); drop on a card to reorder. Soft **WIP limits** per column (project managers)
- **Sprints** (project → Sprints): create with dates and goal, add items from the backlog, **start** (one active sprint per project) and **complete** (unfinished items go to the backlog or the next sprint). Overview with points / hours / open items, **burndown** (actual vs ideal, from daily snapshots; hover or table view), **taskboard** (tasks by parent story) and **capacity** (hours per day, days off, load per person, unassigned work)
- **Sprints page**: active and planned sprints across your projects; items have a Sprint field
- **Live updates**: boards, backlogs, sprints and work item pages refresh when someone else changes something (Socket.IO, authenticated, per-project rooms; events carry only ids)
- **Credentials vault** (project → Vault, Admins + project managers only):
  - secrets encrypted with AES-256-GCM (`VAULT_ENCRYPTION_KEY`), bound to their project + record so ciphertexts cannot be swapped
  - list views never contain secrets; **Reveal** is explicit, rate limited, audit-logged, hides again after 30 s
  - edit = rotate (new secret, `lastRotatedAt`), per-credential access log
  - **Import** (`/vault/import`, admins): reads Sheet2-style blocks, suggests the project per block, preview shows masked secrets only

> After importing the passwords that lived in `Project Details.xlsx`, change them in the systems they belong to and rotate them in the vault — they have been stored in plain text in a spreadsheet.

## Phase 5 status — done

- **Notifications**: bell in the top bar with a live unread count and a full `/notifications` page. Triggers: assigned to you, @mentioned, state change and new comments on items you created or own, due tomorrow, added to a project. Everyone can switch **email** per type under Profile → Notifications (in-app is always on). Actors are never notified about their own changes
- **Search** (`Ctrl+K` or the search box): PostgreSQL full-text search over work item titles and descriptions (prefix matching, ranked, highlighted snippet), exact keys like `BCM-12`, project names; results respect project access. The palette also has quick actions
- **Project → Insights**: health (on track / at risk / off track **with the reasons**), open / overdue / done counts, work by state, open bugs by severity, created vs closed per week, sprint velocity (committed vs completed), workload per person, overdue list, **Excel report** (summary, work items, bugs, sprints)
- **Reports** (sidebar): portfolio of every project you can see — health, open work, bugs, active sprint, target date, deployments — filter by health, export to **Excel**, or **Print / Save as PDF**
- **Dashboard**: live counts plus a "Due soon" list of your items due in the next 7 days

## Repository layout

```
apps/api         Express API (src/modules/auth, src/modules/users, prisma/)
apps/web         React app (src/pages, src/components, src/features/auth)
packages/shared  Roles, permissions, Zod schemas, shared types
docker-compose.yml / docker-compose.prod.yml
```

## 1. Configure environment

`.env` (git-ignored) already exists with generated secrets. To recreate it: `cp .env.example .env` and fill in the values.
Key settings:

| Variable                                          | Purpose                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `DB_USER / DB_PASSWORD / DB_NAME / DB_HOST_PORT` | Postgres container (host port **5433** to avoid a local install)  |
| `JWT_ACCESS_SECRET`, `COOKIE_SECRET`              | ≥ 32 random chars each                                            |
| `REQUIRE_EMAIL_VERIFICATION`                      | block password login until email is verified                       |
| `ALLOW_SELF_REGISTRATION`                         | `false` = invite-only                                              |
| `GOOGLE_CLIENT_ID / _SECRET / _CALLBACK_URL`      | Google sign-in (button hidden while empty)                         |
| `GOOGLE_ALLOWED_DOMAINS`                          | e.g. `mycompany.com` to restrict Google sign-up                    |
| `SMTP_*`, `MAIL_FROM`                             | outgoing email (defaults to Mailpit)                               |
| `SEED_ADMIN_*`                                    | first admin account created by the seed                            |

## 2a. Run with Docker (recommended)

```bash
docker compose up -d --build
docker compose exec api npx tsx prisma/seed.ts     # create first admin (SEED_ADMIN_* in .env)
```

| URL                            | What                                         |
| ------------------------------ | -------------------------------------------- |
| http://localhost:5173          | Web app                                      |
| http://localhost:4000/api/health | API health                                 |
| http://localhost:8025          | **Mailpit** – every email the app sends      |
| http://localhost:8080          | Adminer DB UI (server `db`)                   |

Migrations are applied automatically when the API container starts.

## 2b. Run without Docker (Node 22 + an installed PostgreSQL)

A project-local PostgreSQL cluster is created in `./.pgdata` using your installed PostgreSQL binaries
(auto-detected under `C:\Program Files\PostgreSQL\<version>\bin`, or set `PG_BIN`). It listens on
`DB_HOST_PORT` (5433) and does not touch any existing PostgreSQL service. Delete `.pgdata` to remove it.

```bash
npm install
npm run db:local:init               # first time: create cluster, role and database (also starts it)
npm run db:local:start              # later sessions (after a reboot)
npm run db:deploy                   # apply migrations
npm run db:seed                     # categories + first admin
npm run dev:api                     # terminal 1 -> http://localhost:4000
npm run dev:web                     # terminal 2 -> http://localhost:5173 (proxies /api to :4000)
```

Without a mail server, set `MAIL_TRANSPORT=file` in `.env`: every email is saved as an HTML file in
`apps/api/.mail-outbox/` and its links (verify, reset, invite) are printed in the API log.
Set `MAIL_TRANSPORT=smtp` with real `SMTP_*` values to deliver email.

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`, then change the password under **Profile & security**.

## 3. Google sign-in setup

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **OAuth consent screen**: app name, support email, scopes `openid email profile`.
2. **Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origin: `http://localhost:5173`
   - Authorized redirect URI: `http://localhost:5173/api/v1/auth/google/callback`
3. Put the Client ID / Secret into `.env`, restart the API. "Continue with Google" appears on the login and register pages.

For production add `https://<your-domain>` and `https://<your-domain>/api/v1/auth/google/callback`.

## 4. Email in production

Set `SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / MAIL_FROM`, e.g.

- **Gmail / Google Workspace**: `smtp.gmail.com`, `465`, `SMTP_SECURE=true`, an [App Password](https://myaccount.google.com/apppasswords)
- **SendGrid**: `smtp.sendgrid.net`, `587`, user `apikey`, password = API key
- **Amazon SES / Brevo / Mailgun**: their SMTP credentials

The API logs `SMTP connection OK` at start-up when the settings work. Delivery results are stored in the `email_logs` table.

## 5. Production deployment

```bash
# .env: NODE_ENV=production, COOKIE_SECURE=true, TRUST_PROXY=1,
#       APP_URL / CORS_ORIGIN / GOOGLE_CALLBACK_URL = https://your-domain, real SMTP
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api node dist/seed.js
```

Nginx (web container) serves the SPA and proxies `/api` to the API; Postgres is not exposed. Terminate TLS in front (Caddy, nginx + certbot, or a cloud load balancer).

## Scripts

| Command                              | Description                         |
| ------------------------------------ | ----------------------------------- |
| `npm run dev:api` / `npm run dev:web` | Dev servers                         |
| `npm run lint` / `npm run format`    | ESLint / Prettier                   |
| `npm run typecheck`                  | TypeScript in all workspaces        |
| `npm test`                           | Vitest (shared + API)               |
| `npm run build`                      | Production builds                   |
| `npm run db:migrate`                 | Create a new migration (dev)        |
| `npm run db:deploy` / `db:seed` / `db:studio` | Apply migrations / seed / Prisma Studio |
| `npm run db:local:init` / `start` / `stop` / `status` | Project-local PostgreSQL (no Docker) |

## API

```
GET  /api/health
GET  /api/v1/auth/providers
POST /api/v1/auth/register | verify-email | resend-verification | login | refresh | logout
POST /api/v1/auth/forgot-password | reset-password | change-password
GET  /api/v1/auth/me        PATCH /api/v1/auth/me
GET  /api/v1/auth/google    GET /api/v1/auth/google/callback
GET  /api/v1/users          POST /api/v1/users          (admin: invite)
GET  /api/v1/users/:id      PATCH /api/v1/users/:id     POST /api/v1/users/:id/resend-invite

GET  /api/v1/categories     POST /api/v1/categories     PATCH|DELETE /api/v1/categories/:id   (admin)
GET  /api/v1/projects?q&status&devStatus&priority&categoryId&archived&mine&sort&order&page&pageSize
POST /api/v1/projects       GET|PATCH|DELETE /api/v1/projects/:id
POST /api/v1/projects/:id/archive | restore
POST /api/v1/projects/:id/members      PATCH|DELETE /api/v1/projects/:id/members/:userId
POST /api/v1/projects/:id/environments PATCH|DELETE /api/v1/environments/:envId
POST /api/v1/projects/import?dryRun=true|false   (body: raw .xlsx, Content-Type: application/octet-stream)
GET  /api/v1/projects/export?format=xlsx|csv&<list filters>

GET  /api/v1/projects/:id/backlog?includeDone=true|false
POST /api/v1/projects/:id/work-items
GET  /api/v1/work-items?projectId&type=BUG,TASK&status=open|done|all|removed&state&priority&severity
                       &assignee=me|none|<id>&createdBy=me&parentId&tag&q&sort&order&page&pageSize
GET  /api/v1/work-items/key/BCM-12     GET|PATCH|DELETE /api/v1/work-items/:id
GET  /api/v1/work-items/:id/history
GET|POST /api/v1/work-items/:id/comments   PATCH|DELETE /api/v1/comments/:id
POST /api/v1/work-items/:id/links          DELETE /api/v1/work-item-links/:id
POST /api/v1/work-items/:id/attachments    (raw body + X-File-Name header)
GET|DELETE /api/v1/attachments/:id
GET|POST /api/v1/saved-queries             DELETE /api/v1/saved-queries/:id

GET  /api/v1/projects/:id/board?level=requirements|tasks|features|epics&iteration=<id>|none&assignee
PUT  /api/v1/projects/:id/board-settings    { "wipLimits": { "in_progress": 5 } }
GET|POST /api/v1/projects/:id/iterations     GET /api/v1/iterations?state=ACTIVE,PLANNED
GET|PATCH|DELETE /api/v1/iterations/:id      (GET = sprint detail: stats, capacity, burndown)
POST /api/v1/iterations/:id/start | complete { "moveTo": "backlog" | "<sprint id>" }
PUT  /api/v1/iterations/:id/capacity         { "entries": [{ "userId", "hoursPerDay", "daysOff" }] }
GET|POST /api/v1/projects/:id/credentials    PATCH|DELETE /api/v1/credentials/:id
POST /api/v1/credentials/:id/reveal          GET /api/v1/credentials/:id/access-log
POST /api/v1/vault/import?dryRun=true|false  (raw .xlsx; commit needs X-Import-Map header)

GET  /api/v1/notifications?unread=true&page   GET /api/v1/notifications/unread-count
POST /api/v1/notifications/read  { "ids": ["<id>"] | "all" }
GET|PUT /api/v1/notifications/preferences     { "email": { "COMMENTED": false } }
GET  /api/v1/search?q=<text>&limit=8
GET  /api/v1/projects/:id/insights           GET /api/v1/projects/:id/report.xlsx
GET  /api/v1/reports/portfolio?archived=true  GET /api/v1/reports/portfolio.xlsx

Socket.IO (path /socket.io): connect with auth { token: <access token> },
every socket also receives "notification:new" / "notification:read" for its own user,
emit "project:join" <projectId>, receive "project:changed" { projectId, scope }
```

Errors are always `{ "error": { "code", "message", "details?" } }`.

## Known notes

- `npm audit` reports a ReDoS advisory in `picomatch` (no patched release yet). It only affects build/test tooling (Vite, Vitest, tsup, typescript-eslint), not the shipped app: `npm audit --omit=dev` is clean.
- TypeScript is pinned to 6.0 because typescript-eslint does not support TypeScript 7 yet.
- `exceljs` depends on `uuid@8` (advisory for `v3/v5/v6` with a buffer argument, which exceljs does not use). A root `overrides` entry pins it to the patched `uuid@11`.
- Auth endpoints allow 20 attempts per IP per 15 minutes (`AUTH_RATE_LIMIT`). Counters are in memory, so restarting the API resets them.
- **Back up `VAULT_ENCRYPTION_KEY`** separately from the database backups. Without it the stored secrets cannot be decrypted; with it, a database dump alone is still useless to an attacker.
- Live updates use in-memory Socket.IO rooms: run one API instance (or add the Socket.IO Redis adapter before scaling out). Burndown snapshots are taken on every sprint change plus hourly.
- Notifications are stored in PostgreSQL and emailed in the background (no Redis/BullMQ needed). The "due tomorrow" job runs hourly inside the API and records which due date it reminded about, so it never sends twice — even across restarts. `npm run reminders -w @tracker/api` runs it once by hand (e.g. from cron).
- Search uses a `tsvector` column maintained by a database trigger (see the `search_trigger` migration) with the `simple` text configuration, so it works for any language and for codes / names.
