# Folio — Plan

A personal notes + task app that works properly on iPhone, costs nothing to run, and can be fed by Siri and AI assistants.

Status: **draft for review** · Owner: Andro-human · Last updated: 2026-10-19

---

## 1. Why build this

| Tried | What broke |
|---|---|
| Notion | Good notes, weak tasks, poor iPhone UX |
| Todoist | Good tasks, can't do multi-page notes |
| Amplenote | Close to right, but a subscription |

Requirements:

- Notes with folders, nested sub-pages and rich text.
- Tasks with lists, priority, deadlines, reminders and repeats.
- Excellent on iPhone (PWA), fine on desktop.
- Quick capture from Siri, ChatGPT and Claude.
- Tasks show up in Google Calendar, and other calendars are visible in-app.
- Push notifications for reminders.
- No recurring fees.

## 2. Non-goals (v1)

- A native iOS app. It would need a $99/yr Apple Developer account, so it stays a PWA.
- Reading or editing existing notes offline. Online-only, except creating new items (see §6).
- Sharing or collaboration. Single user.
- A full month-grid calendar UI. Google Calendar is the calendar; the app shows an agenda.
- Plugins, themes marketplace, Android/Windows-specific work.

---

## 3. Core model: everything is a page, some pages are tasks

- A **page** has a title, a rich-text body, optional sub-pages, and lives in a **folder**.
- Any page can be turned into a **task** ("Make this a task"). That adds task fields. Turning it off removes them, and the page stays a normal note.
- A task's title is the page title. The body is optional elaboration and it can have sub-pages like any other page.
- Checkboxes inside a page body are plain formatting (e.g. a packing list). They are **not** tasks and never appear in task views.
- **Sub-pages:** a page has one parent. You can create a sub-page, or move an existing page under another page.
- **Links:** `@`-mention any page inside a body to link it without moving it. Each page shows a "Linked from" (backlinks) section.
- **Folders** organise notes and can be nested. Task pages appear in task views (Today, Upcoming, per-list) wherever they live.
- Quick-captured notes are appended to **today's jot** (below); there is no separate Inbox.

### Jots (daily pages)

A jot is a page tied to a calendar day: the default place to write things down without first deciding where they belong.

- **One page per day,** titled with the date ("Mon, 19 Oct 2026"). It's created the first time you write in it, so empty days don't leave empty pages.
- **Where jots appear:**
  - The **Today** tab shows today's jot under the day's agenda, so opening the app puts the cursor where you write.
  - **Notes → Jots** is a pinned feed of every day, newest first. Each day is editable in place, and older days start collapsed to a preview.
- **In a jot, every line is a task by default** (Bullet Journal-style rapid logging):
  - Type a line and press Enter, and it becomes a task. A task page is created and the line becomes a **task chip**: a checkbox, the title, and a deadline/list badge, rendered live from the task.
  - Quick syntax inside the line is parsed client-side with `chrono-node`, no LLM: "call bank tomorrow 5pm #work !high". The line text without the tokens becomes the title.
  - With no syntax, the task goes to the default list with no deadline and Medium priority.
  - Ticking the chip completes the task. Editing the chip's text renames the task, and changes made elsewhere update the chip.
  - The task shows "Created in: Mon 19 Oct" in its backlinks.
  - Empty lines never create tasks. The page is created when you leave the line, not on each keystroke.
- **Plain notes in a jot (thoughts, not to-dos):**
  - Start the line with `- `, or use the Task/Note button in the keyboard toolbar (`/note` on desktop). It's shown with a dash instead of a checkbox. Tapping a task's circle completes it.
  - **Indented lines under a task are notes,** so a task can have context written beneath it without creating sub-tasks.
  - Toggling task → note deletes the task page, after confirming if the task has a body or sub-pages. Toggling note → task creates one.
- **Regular (non-jot) pages work the other way around:**
  - Lines are plain text, and `/task` or the toolbar task button makes a task chip.
  - `[ ]` is a plain formatting checkbox, and chips look visibly different from it.
  - A checklist line can be turned into a task with "Make task" from its menu.
- **Moving things out:** "Move to page…" on a selection turns a passage into its own page (or a sub-page). The jot keeps a link to it.
- **Captures land here:**
  - Siri "Add task", MCP `create_task` and offline task captures add a task chip to today's jot, as well as creating the task.
  - Siri "Add note", the share sheet and MCP `append_to_jot` add a plain note line, timestamped ("21:42 — …").
  - Appends go through a server-side RPC, so they never overwrite the body.
- **Undated tasks from jots** show in their list and in the jot they came from. A "No date" filter in Tasks catches anything that would otherwise be buried in old jots.
- **Day boundary:** the date comes from the user's timezone in `profiles`.

### Task fields

| Field | Values |
|---|---|
| List | Personal, Work, Errands, or user-defined |
| Priority | High · Medium · Low |
| Status | To do · Deferred · Done ¹ |
| Deadline | Date, or date + time |
| Reminder | Separate time (defaults to the deadline when it has a time) |
| Repeat | RRULE: "every Monday", "1st of month", … |
| Timestamps | Created, updated, completed |

¹ Open decision: Deferred as a status (recommended, so a deferred task keeps its priority) vs. as a priority. See §12.

---

## 4. Architecture

```
iPhone / desktop browser
  └─ PWA (React + Vite)  ── hosted on Vercel
       ├─ CRUD on pages/folders/tasks ──► Supabase Postgres (PostgREST + RLS, user's JWT)
       └─ token mgmt, Google connect ───► Edge Function "api"

Siri Shortcut ──POST /capture (Bearer token)──► Edge Function "api"  (Hono router)
ChatGPT / Claude ──MCP (Streamable HTTP)──────► Edge Function "api"
pg_cron (every minute) ──► Edge Function "api" /internal/tick
                              ├─ send due reminders (web push)
                              └─ retry pending Google Calendar syncs
DB webhook on tasks change ──► /internal/gcal-sync ──► Google Calendar API
```

### Hosting: Vercel + Supabase only, no always-on server

- **Frontend:** Vercel, as with MT-Wallet.
- **Database and auth:** a new Supabase project on the free plan. The free plan allows 2 active projects, so MT-Wallet + this one use both. Free projects pause after 7 days without activity; daily use prevents that.
- **Backend:** one Supabase Edge Function (Deno) running **Hono**, a small Express-like router. All endpoints live in one function.
  - The function sleeps until a request arrives.
  - The free plan includes 500k invocations/month. The per-minute cron uses about 43k.
- **Scheduler:** **pg_cron** inside Postgres replaces `setInterval`. Every job is a short request.
- **Why no Azure-style server:** MT-Wallet needs one for always-on Gmail Pub/Sub, in-process timers and background work after replying. Nothing here needs that: every backend task is request → reply within seconds. Add a server later only if that changes.

### Repo layout (single repo)

```
/                     Vite PWA (deployed by Vercel)
  src/
  public/sw-push.js
/supabase
  functions/
    api/              Hono app: capture, MCP, tokens, google, internal/*
    _shared/          webpush.ts, auth.ts, db.ts, parse.ts, tiptap-markdown.ts
/.github/workflows    deploy functions, monthly backup
PLAN.md
```

- **Schema changes:** SQL is run once against the project and **not kept in the repo**. The live database is the source of truth; `supabase db dump --schema-only` regenerates the full schema whenever it's needed.
- **Types:** the app and the functions share types generated by `supabase gen types`.
- **GitHub:** repo under `Andro-human`, with the remote set to `git@github.com-personal:…`.
- **Commits:** repo-local git identity, using the GitHub noreply email unless told otherwise.

---

## 5. Data model

```sql
folders (
  id uuid pk, user_id, parent_id → folders null,
  name, position, created_at, updated_at
)

pages (
  id uuid pk,                 -- client-generated (makes offline capture idempotent)
  user_id, folder_id → folders null,
  parent_page_id → pages null,    -- sub-pages
  jot_date date null,             -- set ⇔ page is that day's jot; unique(user_id, jot_date)
  title text, content jsonb,      -- TipTap JSON
  content_text text,              -- plain text, for search + MCP
  search tsvector generated (title || content_text),
  version int,                    -- optimistic concurrency
  created_at, updated_at, deleted_at  -- soft delete → Trash
)

page_links (from_page_id, to_page_id)  -- maintained on save from @-mentions; powers backlinks

lists (id, user_id, name, color, position)

tasks (
  page_id pk → pages,         -- 1:1, row exists ⇔ page is a task
  list_id → lists,
  priority enum(high, medium, low),
  status enum(todo, deferred, done),
  deadline timestamptz null, deadline_has_time bool,
  remind_at timestamptz null, reminded_at timestamptz null,
  rrule text null,
  gcal_event_id text null, gcal_dirty bool,
  completed_at timestamptz null
)

task_completions (page_id, completed_at)  -- history for recurring tasks

api_tokens (
  id, user_id, name, scope enum(capture, mcp),
  token_hash text,            -- sha256; plaintext shown once, never stored
  last_used_at, created_at, revoked_at
)

push_subscriptions (user_id, endpoint, p256dh, auth)  unique(user_id, endpoint)

google_connections (
  user_id pk, google_email,
  refresh_token_enc, refresh_token_iv,   -- AES-256-GCM, key in function secret
  tasks_calendar_id, needs_reconnect bool
)

profiles (user_id pk, timezone default 'Asia/Kolkata', default_list_id, jots_folder_id)
```

- **RLS:** `user_id = auth.uid()` on every table.
- **Edge Function writes:** the function uses the service role, so every query filters by the `user_id` resolved from the token.
- **Recurring tasks:**
  - Completing one writes a `task_completions` row.
  - It then moves `deadline`/`remind_at` to the next RRULE occurrence, resets `status` and `reminded_at`, and marks it `gcal_dirty`.
  - The task stays one page; its history is the completions table.

---

## 6. Frontend

### Stack (reused from MT-Wallet)

- React 18, Vite, TypeScript, Tailwind + shadcn/ui, React Query, react-router, framer-motion, vaul, sonner.
- `vite-plugin-pwa` (Workbox `generateSW`), plus the `public/sw-push.js` push handler.
- Supabase Auth, email + password. Not magic links: on iOS they open in Safari instead of the installed PWA.

### Editor: TipTap

- **Extensions:** StarterKit (headings, lists, bold, code…), TaskList (formatting checkboxes), Link, Placeholder, Mention (`@` page links), a slash `/` command menu, and two custom nodes:
  - **SubPage:** a block that links to a child page.
  - **TaskChip:** an inline reference to a task page, rendered live (see §3 Jots).
  - **JotLine:** in jot pages, each top-level line defaults to a TaskChip, `- ` makes a note line, and indented lines under a task are notes.
- **Mobile:** formatting toolbar pinned above the iOS keyboard, positioned with `visualViewport`.
- **Images:** phase 8, via Supabase Storage.

### Saving (online-only)

- Autosave, debounced ~800 ms. Calls an RPC `save_page(id, base_version, title, content, content_text, mention_ids)`.
- The RPC bumps `version` and rewrites `page_links`.
- **Conflicts:** if `base_version` is stale (edited on another device), show a "This page changed on another device — reload" banner. Never silently overwrite.
- React Query refetches on focus, so switching devices shows fresh data. No local cache of existing data.

### Offline capture

Offline, the app still opens, and new notes and tasks can still be created. Existing notes are not shown.

- **App opens offline:** the service worker precaches the app build.
- **Offline state:** list/page views show a clear "You're offline" state.
- **Outbox:**
  - The quick-capture sheet keeps working.
  - Items go into an **outbox** in IndexedDB (`idb-keyval`) with a client-generated UUID.
  - The app shows an "N waiting to sync" badge.
- **Flush:** happens on app start, on `online` and on `visibilitychange`. Each item is an upsert by id, so retries never duplicate. Items are deleted locally once acknowledged.
- **iOS limit:** no Background Sync API, so the outbox only flushes while the app is open.
- **Not covered:** the Siri Shortcut needs network.

### Navigation

- Bottom tab bar with 4 tabs: **Today · Tasks · Notes · Search**.
- A central **capture** button opens a vaul bottom sheet: type or dictate, toggle note/task, pick a list and deadline.
- **Today:** a compact agenda (overdue, due today, today's Google Calendar events), with today's jot editor below it.
- **Notes:** has a pinned **Jots** feed at the top.
- **Tasks:** lists, an Upcoming view (next 14 days, grouped by day, calendar events interleaved), and Deferred.
- **Notes:** folder tree → pages → sub-pages, with breadcrumbs.
- **Search:** Postgres full-text over title + body.

### Fixes vs. MT-Wallet

- VAPID public key comes from an env var, not hardcoded.
- "Update available" prompt (`virtual:pwa-register`) instead of silent auto-update.
- No `user-scalable=no`.
- One shared `PageHeader` component instead of 12 copy-pasted sticky headers.
- A layout route for auth instead of per-route `ProtectedRoute`.
- Only the shadcn primitives actually used.
- Real iOS splash screens, or none.
- Check `display-mode: standalone` and tell the user to "Add to Home Screen" before offering push.

### Design

Clean & minimal (Things 3 / Apple Notes territory), its own identity, nothing from MT-Wallet:

- **Type:** the system font stack, which is SF Pro on iPhone and Mac. Large bold screen titles, 17px body.
- **Colour:** white (light) or near-black (dark) surfaces, light grey cards, one blue accent. Red only for overdue, high priority and destructive actions.
- **List colours:** a fixed palette (blue, green, orange, red, purple, teal, gray).
- **Phone layout:** iOS-style tab bar plus a floating + button.
- **Tokens:** all in `src/index.css`.

---

## 7. Backend: Edge Function `api` (Hono)

### Auth (one shared middleware)

| Caller | Credential |
|---|---|
| PWA | Supabase JWT (`Authorization: Bearer <jwt>`) |
| Siri Shortcuts | `api_tokens` scope `capture`, `Authorization: Bearer <token>` header only |
| MCP clients | `api_tokens` scope `mcp`, token in URL path `/mcp/<token>` |
| pg_cron / DB webhook | Shared secret header, `/internal/*` only |

- **Why MCP puts the token in the URL:** claude.ai and ChatGPT custom connectors can't set custom headers without OAuth.
- **Mitigations for URL tokens:**
  - The token is MCP-scoped only, so it can't hit `/capture`.
  - It's revocable from Settings.
  - Request paths are never logged. MT-Wallet's `shortcut-ingest` leaks its key into logs this way; don't repeat it.
- **Later:** replace URL tokens with OAuth 2.1. Supabase Auth's OAuth server support targets MCP; verify it at that point.
- **Token lookup:** sha256 the presented token, then look it up by hash. Update `last_used_at`.

### Routes

```
POST /capture                 {text, kind?: "task"|"note"} → parsed + created, returns a one-line summary
POST /tokens  · DELETE /tokens/:id     (JWT) create returns plaintext once
GET  /google/connect  · GET /google/callback   (JWT, HMAC-signed state)
POST /mcp/:token              MCP Streamable HTTP, stateless
POST /internal/tick           reminders + gcal retry sweep (pg_cron, every minute)
POST /internal/gcal-sync      DB webhook on tasks insert/update/delete
```

### Capture parsing

- **Parser:** the input is free text ("call the bank Friday 5pm, high priority, work"). Gemini Flash-Lite (current version) turns it into structured output `{kind, title, body?, list?, priority?, deadline?, deadline_has_time, remind_at?, rrule?}`.
  - **Thinking/reasoning disabled:** MT-Wallet's COST-INVESTIGATION found thinking tokens were the hidden cost.
  - The prompt includes the user's timezone, the current time and the list names.
- **Fallback:** if the LLM fails or times out (~4 s), use `chrono-node` for the date, the raw text as title and the default list.
- **Shortcut timeout:** this all finishes within the Shortcut's timeout, so no reply-then-process-in-background (unlike MT-Wallet).

### MCP server

- **Pattern:** MT-Wallet's `chatMcp.ts`, which is the official `@modelcontextprotocol/sdk`, `McpServer` + `StreamableHTTPServerTransport`, `sessionIdGenerator: undefined`, a new server per POST, and GET/DELETE → 405. This fits serverless exactly.
- **Tools:**
  - `create_note(title, markdown?, folder?, parent_page?)`
  - `append_to_note(page, markdown)`
  - `append_to_jot(markdown, date?)` · `read_jots(from, to)` (e.g. "summarise my week")
  - `create_task(title, list?, priority?, deadline?, remind_at?, rrule?, notes_markdown?)`
  - `update_task(page, …fields)` · `complete_task(page)`
  - `list_tasks(view: today|upcoming|list|deferred, list?)`
  - `search(query)` → titles + snippets
  - `read_page(page)` → markdown
- **Page lookup:** a `page` argument accepts an id or a title, matched fuzzily.
- **Markdown ↔ TipTap JSON:** assistants speak markdown, but pages store TipTap JSON, so the function needs conversion both ways. **Spike this early** (TipTap's markdown extension vs. a small custom converter for the node types used).
- **Clients:**
  - Claude: web/desktop/mobile custom connector.
  - ChatGPT: connector / developer mode.
  - Gemini: unclear whether the consumer app supports custom MCP; verify, don't promise.

### Reminders (web push)

- `/internal/tick` claims due reminders atomically, so each fires exactly once:
  ```sql
  update tasks set reminded_at = now()
  where remind_at <= now() and reminded_at is null and status <> 'done'
  returning …
  ```
- **Payload:** the task title and deadline, deep-linking to `/p/<page_id>`.
- **Action buttons** ("Done", "Snooze 1h") are added, but iOS may not render them. Tapping the notification always works.
- **Sender:** MT-Wallet's hand-rolled VAPID + aes128gcm WebCrypto code, consolidated into one `_shared/webpush.ts` (currently duplicated across two functions).
- **Expired subscriptions:** 404/410 → delete the subscription.
- **iOS requirement:** iOS 16.4+, and only after "Add to Home Screen". The app checks for this and explains it.

### Google Calendar

- **Connect flow:** from MT-Wallet's `PLAN-gmail-multiuser.md` design.
  - OAuth with an HMAC-signed `state`.
  - Refresh token encrypted with AES-256-GCM.
  - `invalid_grant` → `needs_reconnect` + an in-app banner.
- **Gotcha:** an OAuth app left in **Testing** status issues refresh tokens that expire after 7 days. Set the consent screen to **In production**. An unverified app is fine for personal use; you click through one warning.
- **Write:**
  - On connect, create a dedicated **"Tasks"** calendar.
  - Each task with a deadline becomes an event there: timed if it has a time, all-day otherwise. Recurring tasks get an RRULE.
  - Done or deleted → remove/mark the event.
  - Triggered by a DB webhook on `tasks`; `gcal_dirty` + the per-minute sweep retries failures.
- **Read:** fetch events from all of the user's calendars for Today/Upcoming. Fetched live, short server cache (~5 min); no local storage.
- **Scopes:** minimal set covering "manage calendars this app creates" + read-only for others (e.g. `calendar.app.created` + `calendar.readonly`). Confirm the exact scopes at implementation time.

---

## 8. Siri and iOS Shortcuts

| Shortcut | Flow |
|---|---|
| **Add task** ("Hey Siri, add task") | Dictate Text → POST `/capture` `{text, kind:"task"}` → speak "Added: Call the bank, Fri 5 pm" |
| **Add note** | Dictate Text → POST `/capture` `{text, kind:"note"}` → appended to today's jot |
| **Save to notes** (Share Sheet) | Shared text/URL → POST `/capture` `{kind:"note"}` |

- Token goes in the `Authorization` header.
- Settings has a "Set up Siri" page with the token and shareable iCloud Shortcut links.

---

## 9. Build phases

Each phase is usable on its own. **Switch over after phase 2.**

| # | Phase | Delivers |
|---|---|---|
| 0 | **Foundation** | Repo, Supabase project, Vercel, schema, auth, PWA shell (copied from MT-Wallet with §6 fixes), tab layout, design tokens, CI deploy for functions |
| 1 | **Notes + jots** | Folders, pages, sub-pages, TipTap editor + mobile toolbar, autosave + conflict banner, `@` links + backlinks, search, Trash, daily jots + Jots feed |
| 2 | **Tasks** | Make-a-task, lists, priority/status/deadline/repeat, Today / Upcoming / per-list / Deferred, recurring completion, task chips in jots and pages. **Monthly backup workflow** (copy `mtwallet-ops`) |
| 3 | **Quick + offline capture** | Capture sheet, IndexedDB outbox, offline state |
| 4 | **Siri** | `api_tokens`, `/capture` with LLM parse + fallback, the three Shortcuts |
| 5 | **Reminders** | Push subscription, `/internal/tick` via pg_cron, notification deep links |
| 6 | **MCP** | Markdown ↔ TipTap spike first, then tools, connect Claude + ChatGPT |
| 7 | **Google Calendar** | Connect flow, Tasks calendar write-sync, events in Today/Upcoming |
| 8 | **Polish** | 8 am daily digest push, images, snooze, settings, performance pass |

---

## 10. Cost

| Item | Cost |
|---|---|
| Vercel Hobby | Free |
| Supabase Free (DB, Auth, Edge Functions, pg_cron) | Free |
| Gemini Flash-Lite for capture parsing | ~pennies/month at personal volume |
| Google Calendar API | Free |
| Domain (optional) | ~₹800/yr, only if a custom domain is wanted |

## 11. Risks

| Risk | Mitigation |
|---|---|
| TipTap + iOS keyboard quirks (toolbar position, scroll jumps) | Prototype the editor on a real iPhone in phase 1, before building around it |
| Markdown ↔ TipTap conversion for MCP | Spike at the start of phase 6; restrict to the node types in use |
| Supabase free project pausing | Daily use; the monthly backup protects data |
| Google refresh token expiry | "In production" consent status; `needs_reconnect` banner |
| iOS evicting PWA storage | Only the outbox lives locally; it flushes on the next open |
| Two-device edit conflicts | `version` check + reload banner; never silent overwrite |
| Task-by-default jots flooding task lists with half-thoughts | One-tap toggle to note; deleting a chip line deletes its task (with undo); a "No date" filter to triage |
| A Siri/MCP append to today's jot while it's open in the editor | Append is a server RPC, so nothing is lost; the open editor gets the reload banner on its next save. Later: Supabase Realtime to merge live |

## 12. Open decisions

1. **Deferred:** status (recommended) or priority?
2. **Priority levels:** High / Medium / Low, or just High / Low?
3. **Task statuses:** To do / Deferred / Done enough, or add In progress?
4. ~~Design~~ **Decided:** clean & minimal, own identity (see §6 Design).
5. ~~Name~~ **Decided:** Folio, served from the owner's own domain.
6. **Commit email:** GitHub noreply (`95043753+Andro-human@users.noreply.github.com`) or a personal address?
7. ~~Task trigger in the editor~~ **Decided:**
   - In jots, every line is a task by default; `- ` or a marker tap makes a plain note.
   - In regular pages, lines are text by default; `/task` or the toolbar button makes a task.
8. **Note-line marker in jots:** `- ` prefix + tap-to-toggle (recommended)? Or a different prefix, e.g. `>`, if `-` feels like it should start a bullet list?
