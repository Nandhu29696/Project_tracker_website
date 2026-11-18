# Project Tracker — Complete Setup & Phase-wise Plan

> A responsive, professional work-tracking web app (inspired by Azure DevOps Boards) to manage **Projects, Plans/Sprints, Epics, Features, User Stories, Tasks and Bugs**, with **role-based access** for **Admin, Manager and Employee**.
>
> **Stack:** React 18 + Vite + Tailwind CSS · Node.js (Express + TypeScript) · PostgreSQL 16 (Prisma ORM) · Docker / Docker Compose · Git (GitHub/GitLab)

---

## 0. Analysis of the existing Excel tracker (`Project Details.xlsx`)

### Sheet1 — Project list (8 rows)
| Column | Maps to (new app) | Notes |
|---|---|---|
| Sl.No | auto `id` / `key` (e.g. `PRJ-001`) | Numbering skips 3; use DB-generated IDs instead |
| Category | `project.category` (enum: AI Tool, Web App, Mobile, Website) | Make admin-configurable lookup |
| Project Name | `project.name` | |
| Description | `project.description` (rich text) | |
| Priority | `project.priority` (Critical/High/Medium/Low) | Letscalm is blank → make required |
| Final Status | `project.status` (Active, On Hold, Client No Response, Closed) | Mostly empty; merge with Dev Status |
| Dev Status | `project.devStatus` (Not Started, In Progress, Completed) | |
| Deployment | `environment` records (DEV, QA, PROD/Live) | Values are inconsistent (Deployed / DEV deployed / PROD / Live) → normalise into environments table |
| Start Date / End Date | `project.startDate`, `project.targetDate` | BCM: start 2029 > end 2026 → add validation `start <= end` |
| Website URL | `environment.url` | Contains titles, not URLs → store real URL + display name |
| Login Credentials | `credential` vault (linked to project) | |

### Sheet2 — Login credentials
Contains **plain-text usernames/passwords and API keys** for several apps.
**Recommendation:** never store these in a spreadsheet or plain DB column. Build a **Credentials Vault** module (Phase 4): values encrypted with AES-256-GCM at rest, visible only to Admin + project Managers, every "reveal" is audit-logged. **Rotate the credentials currently in the sheet** once migrated.

### The notes "Tracker / overall application / issue"
Interpreted as: one tracker for all applications, plus issue (bug) tracking per application → covered by Work Items + Bugs.

---

## 1. Feature Overview

### 1.1 Work item hierarchy (ADO-style)
```
Project
 └── Epic
      └── Feature
           └── User Story ──┬── Task
                            └── Bug   (bugs can also be standalone under a Project)
```
Every work item has: `key` (e.g. `BCM-142`), title, description (rich text), type, state, priority, severity (bugs), assignee, reporter, area/category, iteration (sprint), story points / original estimate / remaining / completed hours, start/due date, tags, attachments, comments, history, links (parent/child, related, blocks/blocked-by).

### 1.2 Workflow states (configurable per type)
| Type | States |
|---|---|
| Epic / Feature / Story | New → Active → Resolved → Closed (+ Removed) |
| Task | To Do → In Progress → Done |
| Bug | New → Triaged → Active → Resolved → Verified → Closed (+ Reopened) |

### 1.3 Core modules
1. **Auth & Users** – login, JWT + refresh token, password reset, profile, avatar.
2. **Projects** – create/edit/archive, members, category, priority, status, environments (DEV/QA/PROD URLs).
3. **Work Items** – CRUD, hierarchy, assignee, comments, @mentions, attachments, history/audit trail.
4. **Boards** – Kanban board per project (drag & drop columns = states), swimlanes by assignee/priority.
5. **Backlog & Plans (Sprints/Iterations)** – sprint creation, drag backlog items into sprint, capacity per member, sprint burndown.
6. **Bugs** – quick "New Bug" form, severity, repro steps, environment, screenshots.
7. **Dashboards** – My Work, project health, burndown, bugs by severity, workload by assignee, overdue items.
8. **Queries / Filters** – saved filters (e.g. "My open bugs", "High priority this sprint").
9. **Notifications** – in-app bell + email (assignment, mention, state change, due soon).
10. **Credentials Vault** – encrypted per-project secrets (replaces Sheet2).
11. **Admin** – users, roles, categories, workflow states, audit log, Excel import/export.

---

## 2. Role-Based Access Control (RBAC)

Two layers:
- **Global role** (on the user): `ADMIN`, `MANAGER`, `EMPLOYEE`.
- **Project membership** (per project): `OWNER/MANAGER`, `MEMBER`, `VIEWER`. A Manager only manages projects they own or are assigned to.

### Permission matrix
| Capability | Admin | Manager | Employee |
|---|:-:|:-:|:-:|
| Manage users, roles, system settings | ✅ | ❌ | ❌ |
| View audit logs | ✅ | Own projects | ❌ |
| Create / archive / delete project | ✅ | Create + archive own | ❌ |
| Add/remove project members | ✅ | Own projects | ❌ |
| Create sprints / plans, set capacity | ✅ | Own projects | ❌ |
| Create Epic / Feature | ✅ | ✅ | ❌ |
| Create User Story / Task / Bug | ✅ | ✅ | ✅ (in projects they belong to) |
| Assign work items to anyone | ✅ | ✅ (project members) | Self only (or as allowed) |
| Edit any work item | ✅ | Own projects | Items assigned to / created by them |
| Change state of work item | ✅ | ✅ | Items assigned to them |
| Delete work item | ✅ | Own projects | ❌ (soft "Removed" state only) |
| Comment / attach files | ✅ | ✅ | ✅ |
| View credentials vault | ✅ | Own projects | ❌ (unless granted) |
| Dashboards | All projects | Own projects + team | My Work + member projects |
| Excel import / export | ✅ | Export own projects | ❌ |

### Implementation
- Permissions as constants, e.g. `project:create`, `workitem:assign`, `vault:reveal`.
- `roles → permissions` map in code (seeded to DB so Admin can tweak later).
- Backend middleware: `authenticate` → `authorize('workitem:update')` → **resource check** (is user a member/assignee of this project/item?).
- Frontend: `<Can permission="project:create">` wrapper + protected routes. *UI hiding is convenience only; the API always enforces.*

---

## 2A. Authentication, Registration & Email Notifications (Phase 1)

### Sign-up / sign-in methods
| Method | Flow |
|---|---|
| **Email + password registration** | `POST /auth/register` → user created as **EMPLOYEE**, `email_verified_at = null` → verification email (24 h link) → user clicks → verified → welcome email. Login is blocked until verified (`REQUIRE_EMAIL_VERIFICATION=true`). |
| **Email + password login** | `POST /auth/login` → bcrypt check → access JWT (15 min) in response body + **refresh token in httpOnly cookie** (7 days). |
| **Google OAuth2 (Sign in / Sign up with Google)** | `GET /auth/google` → Google consent (Authorization Code flow + **PKCE** + `state` in a signed cookie) → `GET /auth/google/callback` → server exchanges code, verifies the ID token (audience, `email_verified`, optional allowed domains) → find user by `google_id` → else link to existing user with same email → else create new **EMPLOYEE** → sets refresh cookie → redirects to `/auth/callback` in the web app, which calls `/auth/refresh` to get the access token. **No tokens ever appear in URLs.** |
| **Admin invite** | Admin creates user + role → invite email with "set your password" link (72 h). |
| **Forgot / reset password** | `POST /auth/forgot-password` (always generic response, no email enumeration) → reset link (1 h) → `POST /auth/reset-password` → all sessions revoked + "password changed" email. |

### Roles on registration
- Self-registration and Google sign-up **always create EMPLOYEE**. Only an Admin can promote to MANAGER/ADMIN.
- The first Admin is created by the seed script from `SEED_ADMIN_*` env vars.
- Optional controls: `ALLOW_SELF_REGISTRATION=false` (invite-only), `GOOGLE_ALLOWED_DOMAINS=yourcompany.com`.

### Token & session security
- **Access token:** JWT HS256, 15 min, claims `sub`, `role`, `iss`, `aud`; kept **in memory** on the client (not localStorage).
- **Refresh token:** random 64-byte opaque value, only its **SHA-256 hash** stored in DB; httpOnly + `SameSite=Lax` + `Secure` (prod) cookie scoped to `/api/v1/auth`.
- **Rotation + reuse detection:** each refresh issues a new token; re-use of an old token revokes the whole token family (stolen-token protection).
- On every request the API re-loads the user, so **deactivation / role changes apply immediately**.
- Cookie endpoints check the `Origin` header (CSRF protection); `helmet`, CORS allow-list, rate limiting on auth routes, bcrypt (12 rounds), password policy (min 8 chars, letter + number), audit log for login/register/role changes.

### Google Cloud setup (one-time)
1. Google Cloud Console → **APIs & Services → OAuth consent screen** → External/Internal, app name, support email, scopes `openid email profile`.
2. **Credentials → Create OAuth client ID → Web application**
   - Authorized JavaScript origins: `http://localhost:5173` (+ production domain)
   - Authorized redirect URIs: `http://localhost:5173/api/v1/auth/google/callback` (+ `https://<prod-domain>/api/v1/auth/google/callback`)
3. Copy Client ID / Secret into `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`). The "Continue with Google" button appears automatically once configured.

### Email notifications
| Phase 1 (auth) | Later phases |
|---|---|
| Verify email · Welcome · Password reset · Password changed · Admin invite · Role changed · Account deactivated | Work item assigned · @mention · State changed · Due tomorrow · Sprint started (Phase 3–5, queued via BullMQ) |

- **Dev:** [Mailpit](https://mailpit.axllent.org) container catches all emails → view at `http://localhost:8025`.
- **Prod:** any SMTP — Gmail/Google Workspace (app password), SendGrid, Amazon SES, Brevo. Configure `SMTP_*` + `MAIL_FROM`.
- Every send is recorded in `email_logs` (status SENT/FAILED). Email failures never break the API request.

---

## 3. Recommended Tech Stack (final)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | Fast dev server, type safety |
| Styling | **Tailwind CSS** + **shadcn/ui** (Radix primitives) | Professional, accessible components |
| State / data | **TanStack Query** (server state) + **Zustand** (UI state) | Caching, optimistic updates |
| Forms | **React Hook Form + Zod** | Shared validation schemas with backend |
| Routing | React Router v6 | |
| Drag & drop | **@dnd-kit** | Kanban & backlog reordering |
| Rich text | **Tiptap** | Descriptions, comments, @mentions |
| Charts | **Recharts** | Burndown, bug trends |
| Tables | **TanStack Table** | Backlog/query grids |
| Backend | **Node.js 20 + Express + TypeScript** | (NestJS is a good alternative if team prefers structure) |
| ORM | **Prisma** | Migrations, type-safe queries |
| DB | **PostgreSQL 16** | |
| Auth | JWT access (15 min) + httpOnly refresh cookie (7 d), **bcrypt/argon2** | |
| Validation | **Zod** | |
| Realtime | **Socket.IO** | Live board updates, notifications |
| Files | Local volume (dev) → **S3 / MinIO** (prod) | |
| Email | Nodemailer (SMTP) | |
| Jobs | **BullMQ + Redis** (optional, Phase 5) | Emails, due-date reminders |
| Logging | **pino** | |
| Testing | **Vitest** + React Testing Library, **Supertest**, **Playwright** (E2E) | |
| Lint/format | ESLint + Prettier + Husky + lint-staged + commitlint | |
| DevOps | **Docker, Docker Compose, Nginx**, GitHub Actions CI | |

---

## 4. Database Design (PostgreSQL / Prisma)

### Main tables
| Table | Key columns |
|---|---|
| `users` | id, name, email (unique), password_hash, role (ADMIN/MANAGER/EMPLOYEE), avatar_url, is_active, last_login_at |
| `refresh_tokens` | id, user_id, token_hash, expires_at, revoked_at |
| `categories` | id, name (AI Tool, Web App, Mobile, Website) |
| `projects` | id, key (e.g. `BCM`), name, description, category_id, priority, status, dev_status, start_date, target_date, owner_id, archived_at |
| `project_members` | project_id, user_id, project_role (MANAGER/MEMBER/VIEWER) |
| `environments` | id, project_id, name (DEV/QA/PROD), url, display_name, deployed_at, status |
| `iterations` (sprints/plans) | id, project_id, name, goal, start_date, end_date, state (Planned/Active/Closed) |
| `capacity` | iteration_id, user_id, hours_per_day, days_off |
| `work_items` | id, project_id, number (per-project seq), type, title, description, state, priority, severity, story_points, original_estimate, remaining_work, completed_work, assignee_id, reporter_id, parent_id, iteration_id, start_date, due_date, board_order, created_at, updated_at, deleted_at |
| `work_item_links` | source_id, target_id, link_type (related/blocks/duplicates) |
| `tags` / `work_item_tags` | |
| `comments` | id, work_item_id, author_id, body, created_at, edited_at |
| `attachments` | id, work_item_id, file_name, mime, size, storage_key, uploaded_by |
| `work_item_history` | id, work_item_id, changed_by, field, old_value, new_value, changed_at |
| `notifications` | id, user_id, type, payload (jsonb), read_at |
| `saved_queries` | id, owner_id, name, filter (jsonb), is_shared |
| `credentials` | id, project_id, label, username, secret_encrypted, iv, auth_tag, notes, created_by |
| `audit_logs` | id, actor_id, action, entity, entity_id, metadata (jsonb), ip, created_at |

### Indexes
`work_items(project_id, state)`, `work_items(assignee_id, state)`, `work_items(iteration_id)`, `work_items(parent_id)`, unique `(project_id, number)`, GIN full-text on `title || description`.

---

## 5. API Design (REST, `/api/v1`)

```
POST   /auth/login | /auth/refresh | /auth/logout | /auth/forgot-password | /auth/reset-password
GET    /auth/me

GET    /users                      (admin)       POST /users   PATCH /users/:id   DELETE /users/:id
GET    /projects                   POST /projects    GET|PATCH|DELETE /projects/:id
GET    /projects/:id/members       POST /projects/:id/members   DELETE /projects/:id/members/:userId
GET    /projects/:id/environments  POST ...  PATCH ...
GET    /projects/:id/iterations    POST ...  PATCH /iterations/:id
GET    /projects/:id/work-items?type=&state=&assignee=&iteration=&q=&page=
POST   /projects/:id/work-items
GET|PATCH|DELETE /work-items/:id
PATCH  /work-items/:id/state       PATCH /work-items/:id/assign   PATCH /work-items/reorder
GET|POST /work-items/:id/comments  POST /work-items/:id/attachments
GET    /work-items/:id/history     POST /work-items/:id/links
GET    /projects/:id/board          (grouped by state)
GET    /dashboard/me | /dashboard/project/:id
GET    /notifications              PATCH /notifications/:id/read
GET|POST /projects/:id/credentials  POST /credentials/:id/reveal  (audit-logged)
POST   /admin/import/excel         GET /projects/:id/export
GET    /admin/audit-logs
```
Document with **OpenAPI (Swagger)** at `/api/docs`; keep a Postman collection in the repo.

Standard response: `{ data, meta: { page, pageSize, total } }`; errors: `{ error: { code, message, details } }`.

---

## 6. Folder Structure (monorepo)

```
project-tracker/
├── apps/
│   ├── web/                     # React + Vite + Tailwind
│   │   ├── src/
│   │   │   ├── api/             # axios client + TanStack Query hooks
│   │   │   ├── components/      # ui/ (shadcn), layout/, workitems/, board/
│   │   │   ├── features/        # auth, projects, workitems, boards, sprints, bugs, dashboard, admin, vault
│   │   │   ├── hooks/
│   │   │   ├── lib/             # permissions, utils, zod schemas
│   │   │   ├── routes/          # route config + ProtectedRoute
│   │   │   ├── store/           # zustand
│   │   │   └── main.tsx
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   └── tailwind.config.ts
│   └── api/                     # Node + Express
│       ├── src/
│       │   ├── config/          # env (zod-validated), logger
│       │   ├── middleware/      # auth, authorize, validate, errorHandler, rateLimit
│       │   ├── modules/         # auth, users, projects, workitems, iterations, comments, ...
│       │   │   └── workitems/   # routes.ts, controller.ts, service.ts, schema.ts, workitems.test.ts
│       │   ├── lib/             # prisma, crypto (vault), mailer, socket
│       │   ├── jobs/
│       │   └── server.ts
│       ├── prisma/              # schema.prisma, migrations/, seed.ts
│       └── Dockerfile
├── packages/
│   └── shared/                  # shared TS types, enums, zod schemas, permission constants
├── docker-compose.yml           # dev
├── docker-compose.prod.yml      # prod
├── .env.example
├── .github/workflows/ci.yml
├── package.json                 # npm/pnpm workspaces
└── README.md
```

---

## 7. UI / UX Guidelines (professional & responsive)

- **Layout:** collapsible left sidebar (Projects, Boards, Backlogs, Sprints, Bugs, Queries, Dashboards, Admin) + top bar (project switcher, global search `Ctrl+K`, "+ New" work item, notifications, profile).
- **Mobile (<768px):** sidebar becomes drawer; boards scroll horizontally with column snap; tables switch to card list; work-item detail opens full-screen.
- **Design tokens:** neutral slate palette, one brand colour (e.g. blue-600), Inter font, 8px spacing grid, `rounded-lg`, subtle shadows; **dark mode** via Tailwind `class` strategy.
- **Work item type colours/icons** (ADO-like): Epic orange, Feature purple, Story blue, Task yellow, Bug red.
- **Work item detail:** side panel / modal — title, state & assignee pickers at top, tabs: Details · Comments · History · Links · Attachments.
- **Quick actions:** inline title edit, keyboard shortcuts, drag & drop between columns/sprints, bulk select & update.
- Accessibility: keyboard navigation, focus rings, colour contrast ≥ 4.5:1.

### Key screens
1. Login / Forgot password
2. My Work (assigned to me, due soon, mentions)
3. Projects list (grid/table — mirrors your Excel columns) + Project overview
4. Board (Kanban)
5. Backlog (hierarchical tree grid)
6. Sprint / Plan view (taskboard + capacity + burndown)
7. Bugs list & New Bug form
8. Work item detail
9. Dashboards
10. Admin: Users, Roles, Categories, Workflow, Audit log, Import
11. Credentials Vault (per project)

---

## 8. Docker Setup

### `docker-compose.yml` (development)
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      retries: 10

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile, target: dev }
    env_file: .env
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
    ports: ["4000:4000"]
    volumes: ["./apps/api:/app/apps/api", "/app/node_modules"]
    depends_on: { db: { condition: service_healthy } }

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile, target: dev }
    environment:
      VITE_API_URL: http://localhost:4000/api/v1
    ports: ["5173:5173"]
    volumes: ["./apps/web:/app/apps/web", "/app/node_modules"]
    depends_on: [api]

  adminer:            # optional DB UI
    image: adminer
    ports: ["8080:8080"]

volumes:
  pgdata:
```

### `apps/api/Dockerfile` (multi-stage)
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM base AS dev
COPY . .
WORKDIR /app/apps/api
RUN npx prisma generate
CMD ["npm", "run", "dev"]

FROM base AS build
COPY . .
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

### `apps/web/Dockerfile` (multi-stage → Nginx)
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM base AS dev
COPY . .
WORKDIR /app/apps/web
CMD ["npm", "run", "dev", "--", "--host"]

FROM base AS build
COPY . .
WORKDIR /app/apps/web
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
```

### `apps/web/nginx.conf`
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location /api/       { proxy_pass http://api:4000; proxy_set_header Host $host; }
  location /socket.io/ { proxy_pass http://api:4000; proxy_http_version 1.1;
                         proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
  location /           { try_files $uri /index.html; }
  gzip on; gzip_types text/css application/javascript application/json;
}
```

### Production (`docker-compose.prod.yml`)
- `web` (Nginx, port 80/443) → proxies `/api` to `api`; `db` **not** exposed publicly.
- TLS via a reverse proxy (Caddy or Nginx + Certbot) or the cloud load balancer.
- Daily `pg_dump` backup container/cron to off-site storage.
- Images pushed to GHCR/Docker Hub by CI; server runs `docker compose pull && docker compose up -d`.

### `.env.example`
```
NODE_ENV=development
PORT=4000
DB_USER=tracker
DB_PASSWORD=change_me
DB_NAME=tracker
DATABASE_URL=postgresql://tracker:change_me@localhost:5432/tracker
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me
VAULT_ENCRYPTION_KEY=32_byte_base64_key
CORS_ORIGIN=http://localhost:5173
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASS=  MAIL_FROM=
```
> `.env` is git-ignored. Never commit real secrets.

---

## 9. Git Workflow

- **Branches:** `main` (production) · `develop` (integration) · `feature/<ticket>-short-desc` · `fix/<ticket>-...` · `release/x.y.z` · `hotfix/...`
- **Commits:** Conventional Commits — `feat(workitems): add bug severity field`, `fix(auth): ...`, `chore: ...` (enforced by commitlint + Husky).
- **PRs:** into `develop`, ≥1 review, CI must pass (lint, type-check, tests, Docker build). Squash merge.
- **Releases:** tag `v1.0.0` on `main` → CI builds & pushes Docker images → deploy.
- **CI (`.github/workflows/ci.yml`):** install → lint → typecheck → unit tests (Postgres service container) → build images → (on tag) push + deploy.
- `.gitignore`: `node_modules`, `dist`, `.env*` (except `.env.example`), `uploads/`, `coverage/`.

---

## 10. Phase-wise Delivery Plan

> Estimates assume 1–2 developers. Each phase ends with a demo and a tagged release.

### Phase 0 — Planning & Design (Week 1)
- [ ] Finalise requirements, roles & permission matrix (Section 2)
- [ ] Clean up Excel data (fix BCM dates, missing priority, real URLs, statuses)
- [ ] Wireframes / Figma for key screens (Section 7)
- [ ] ER diagram & API contract (Sections 4–5)
- [ ] Create Git repo, branch protections, issue board

**Deliverable:** approved design + backlog.

### Phase 1 — Foundation & Auth (Weeks 2–3)
- [x] Monorepo scaffold (web, api, shared), ESLint/Prettier _(Husky/commitlint deferred)_
- [x] Docker Compose dev environment (db, api, web, adminer, mailpit) + no-Docker local mode (`npm run db:local:init`, `MAIL_TRANSPORT=file`)
- [x] Prisma schema: users, refresh_tokens, audit_logs; migrations + seed (1 admin)
- [x] `.env` / `.env.example` with DB, JWT, cookie, SMTP, Google OAuth and seed settings (validated with Zod at startup)
- [x] Auth: register + email verification, login, refresh (rotation), logout, forgot/reset password, change password, `/auth/me`
- [x] **Google OAuth2** sign-in / sign-up (PKCE + state), account linking by email (Section 2A)
- [x] **Email notifications** service (Nodemailer + HTML templates, Mailpit in dev, `email_logs` table)
- [x] RBAC middleware (`authenticate`, `authorize`, resource checks) + shared permission constants
- [x] Frontend: Tailwind setup, app shell (sidebar/topbar, responsive, dark mode), login/register/forgot/reset/verify pages, Google button, protected routes, `<Can>` component
- [x] Admin → User management (invite/create, edit role, deactivate) + Profile page
- [x] CI pipeline (lint, typecheck, test, build)

**Deliverable:** users can log in; admin manages users and roles.

### Phase 2 — Projects & Members (Weeks 4–5)
- [x] Projects CRUD (category, priority, status, dev status, dates with validation, owner)
- [x] Project members & project roles
- [x] Environments (DEV/QA/PROD URLs, deployment status) — replaces "Deployment" + "Website URL" columns
- [x] Projects list (table + card view, filters, search, sort) and Project overview page
- [x] **Excel import** of `Project Details.xlsx` Sheet1 (with validation report for bad rows)
- [x] Export projects to Excel/CSV

**Deliverable:** all 8 existing projects live in the app.

### Phase 3 — Work Items, Tasks & Bugs (Weeks 6–8)
- [x] Work item model (Epic/Feature/Story/Task/Bug), per-project keys (`BCM-1`)
- [x] Create/edit form with **assignee picker** (project members only), priority, severity, estimates, dates, tags
- [x] Parent/child hierarchy + links
- [x] Workflow states per type & state-transition rules
- [x] Markdown description (safe rendering, write/preview), comments with @mentions (email), attachments (signature-checked, sandboxed downloads)
- [x] History / audit trail of field changes
- [x] Bug-specific fields: repro steps, environment, expected/actual, screenshots
- [x] Backlog view (hierarchical tree grid), Bugs list, "My Work" page
- [x] Filters & saved queries (personal)

**Deliverable:** full work-item tracking with assignees.

### Phase 4 — Boards, Plans/Sprints & Vault (Weeks 9–10)
- [x] Kanban board with drag & drop (@dnd-kit), swimlanes, WIP limits
- [x] Iterations/Sprints: create, set dates/goal, start/complete (unfinished work rolls over), add backlog items to a sprint (multi-select picker), burndown from daily snapshots
- [x] Team capacity per sprint; sprint taskboard
- [x] Real-time updates (Socket.IO) on boards
- [x] **Credentials Vault** (AES-256-GCM with per-record AAD, reveal permission, rate-limited + audit-logged reveals, Sheet2 importer with masked preview) — **you still need to rotate the passwords that lived in the spreadsheet**

**Deliverable:** Agile planning like ADO Boards/Sprints; secrets out of Excel.

### Phase 5 — Dashboards, Notifications & Reporting (Weeks 11–12)
- [ ] Dashboards: project health, burndown, velocity, bugs by severity/state, workload per assignee, overdue items
- [ ] Admin overview: all projects status (replacement for the Excel sheet)
- [ ] In-app notifications + email (assigned, mentioned, state changed, due tomorrow) via BullMQ/Redis
- [ ] Global search (`Ctrl+K`) using Postgres full-text
- [ ] Export reports (Excel/PDF)

**Deliverable:** management visibility & alerts.

### Phase 6 — Quality, Security & Production Deployment (Weeks 13–14)
- [ ] Unit + integration tests (≥70% on services), Playwright E2E for login, create task, assign, move on board, raise bug
- [ ] Security: helmet, rate limiting on auth, CORS lockdown, input validation everywhere, file-upload type/size limits, OWASP checklist, `npm audit`
- [ ] Performance: pagination everywhere, DB indexes, query profiling, frontend code-splitting
- [ ] Production Docker Compose + Nginx + HTTPS; backups & restore test
- [ ] Monitoring: health endpoint `/api/health`, structured logs, uptime check (optionally Sentry)
- [ ] User guide & admin guide; README with setup steps

**Deliverable:** v1.0 live in production.

### Phase 7 — Enhancements (Backlog / post v1)
- Custom fields & custom workflows per project
- Gantt / timeline (roadmap) view for Epics/Features
- Time logging & timesheets
- Git integration (link commits/PRs to work items via `#BCM-12` in commit messages)
- SSO (Microsoft Entra ID / Google OAuth)
- AI assist: auto-summarise bugs, suggest assignee/priority, duplicate-bug detection (fits your AI tool portfolio)
- Mobile PWA with push notifications
- Multi-tenant / organisation support

---

## 11. Getting Started (once Phase 1 scaffold exists)

```bash
git clone <repo-url> project-tracker && cd project-tracker
cp .env.example .env            # fill secrets
docker compose up -d --build    # db, api, web, adminer
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma db seed
# Web:  http://localhost:5173
# API:  http://localhost:4000/api/v1   Docs: http://localhost:4000/api/docs
# DB UI: http://localhost:8080
```

---

## 12. Key Suggestions Summary

1. **Move credentials out of Excel immediately** and rotate them — they are currently plain text.
2. **Normalise statuses:** merge "Final Status" + "Dev Status" into one project status and separate environment/deployment records.
3. **Validate dates** (BCM start date 2029 is after its end date) and make priority mandatory.
4. **Enforce RBAC on the API**, not just the UI; scope Managers to their own projects.
5. Use **Prisma migrations + seed** and **Docker multi-stage builds** for reproducible environments.
6. Ship in phases — Phases 1–3 alone already replace the Excel tracker; Phases 4–5 bring ADO-level planning.
7. Keep a **shared package** for types, enums and Zod schemas to avoid frontend/backend drift.
