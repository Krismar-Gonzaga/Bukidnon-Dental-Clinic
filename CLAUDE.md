# CLAUDE.md

Permanent rules for this repository. Task prompts add task-specific requirements only; these rules always apply.

## Project Overview

Bukidnon Dental Portal: SaaS web + mobile dental clinic management system for multiple clinics/branches.

- `web/` — React web frontend (Create React App / `react-scripts`, JavaScript/JSX, Axios). **Current development scope.**
- `backend/` — Laravel REST API with Sanctum. Owned by another teammate.
- `mobile/` — React Native app. Owned by another teammate.

Current priority: build the web frontend from the completed Figma designs, incrementally, keeping backend and mobile isolated.

## Scope and Protected Areas

Modify files **inside `web/` only**, unless a task explicitly authorizes another location.

Never modify without explicit permission for that specific task:

- `backend/` (including migrations, models, controllers, routes, config)
- `mobile/` (code and config)
- Root `package.json` / `package-lock.json`, and `web/package.json` / `web/package-lock.json`
- `.env` files
- `.idea/`, `.vscode/`
- Git configuration

Do not "fix" backend or mobile problems to make the frontend work. Report them instead.

Never print, expose, copy, or commit secrets or `.env` contents. Never log or report authentication tokens. Never hardcode real credentials.

## Development Workflow

Before changing code:

1. Check `git status`.
2. Read the relevant existing files and understand the current implementation.
3. Identify the smallest set of files required.
4. State the intended approach and files briefly.

During implementation:

- Make only the requested changes; prefer small, reversible edits.
- Reuse existing components, styles, and dependencies when practical.
- No broad architectural changes, rebuilds from scratch, or unrelated refactoring/cleanup unless requested.
- Keep unrelated user changes untouched; never reset, revert, delete, or overwrite them.
- Grow the architecture incrementally (pages, components, layouts, routes, service layer, auth state, design tokens) — not all at once.

## UI / Figma Rules

- Figma designs are the visual source of truth. Match layout, spacing, typography, colors, borders, radius, sizing, hierarchy, and responsive behavior as closely as practical.
- When exact Figma values are unavailable, make reasonable estimates and clearly report them.
- Do not invent major sections or redesign completed sections without instruction.
- Use reusable components for repeated UI patterns; keep styling organized (shared design tokens, no inline styles everywhere).
- Do not add UI elements unsupported by the design or requirements. No emoji in place of proper icons. Avoid generic AI-looking/template layouts.
- If a design asset is missing from the repo, use a clearly replaceable temporary placeholder and report it. Do not download random external assets or add CDN dependencies.
- The `frontend-design:frontend-design` skill may be used for UI work, within these rules.

## Provisional Content and Mock Data

- Figma sample content is provisional unless explicitly identified as final.
- Clinic names, service names, prices, descriptions, ratings, reviews, locations, and similar business data used during frontend development are mock/sample data — never treat them as final business information.
- Keep provisional content easy to replace: prefer centralized mock/config/data structures over repeated hardcoded business values scattered across components.
- Keep mock data separate from presentation logic; design components so mock data can later be swapped for API data with minimal UI changes.
- Real business data will come from the backend API/database.

## Frontend / Backend Separation

- Build and verify the UI independently while backend work is incomplete, using mock/static data where necessary.
- Do not invent backend endpoints or modify backend code to make the frontend work.
- Backend integration happens later, when the API is ready and the task requests it.

## API / Data Rules

When API integration is requested:

- Use the existing Laravel backend; inspect its routes/controllers before assuming an endpoint exists or works (including role endpoints).
- Never invent endpoints or response fields without evidence. If an endpoint is missing or broken, report it — do not change the backend.
- Keep API logic in a service layer, out of presentation components.

Data:

- Never modify production data or run destructive database commands.
- Do not present fabricated data as real backend data. Mock data only when the task is explicitly frontend-only or the endpoint is unavailable, and keep it clearly separated and labeled.

Roles (Public User, Patient, Dentist, Dental Clinic Staff, Clinic Administrator, System Administrator): follow documented requirements; do not invent role-specific interfaces.

Multi-tenant: design with clinic/tenant context in mind; do not hardcode a single clinic (unless the task is an explicit prototype); do not invent tenant-management behavior.

## Git Rules

Working branch: `feature/web-frontend`.

- Do not commit, push, merge into `main`, or create/merge PRs unless explicitly instructed.

## Dependency Rules

No install, uninstall, upgrade, downgrade, or migration of dependencies without explicit approval. Specifically:

- No migration away from CRA (e.g. to Vite).
- Do not remove dependencies (including React Native ones) just because they look unused.
- No `npm audit fix`; no package changes just to silence warnings.
- If a dependency problem blocks the task, report it first.

Use `npm.cmd` (Windows) for npm commands.

## Verification

After implementation:

1. Run the most relevant checks: `npm.cmd run build`, `npm.cmd test`, `npm.cmd start` (from `web/`). If one cannot be run, say why.
2. Check `git status`; confirm protected areas are unchanged.
3. Do not claim completion or visual accuracy that was not actually verified.

## Task Discipline

- Each task: clear objective, limited file scope, forbidden areas, acceptance criteria, verification.
- If the task grows beyond its scope, **stop and report** instead of expanding it.
- Ambiguity that could cause destructive or architectural change: ask first. Small low-risk ambiguity: make the smallest reasonable assumption and state it.
- Complete only the requested task. Do not start later sections, the next task, or unrelated improvements.
- Do not redesign previously completed sections unless explicitly requested.
- Stop when the requested task is complete.

Caveman workflow: investigate before modifying, keep changes surgical, prefer evidence over assumptions, don't repeat exploration, verify, stop. Caveman never overrides verification or safety rules.

Code quality: reusable components where practical, no unnecessary duplication, clear names, small focused components, semantic accessible HTML, responsive maintainable CSS, separation of UI / state / API concerns. Avoid monoliths, needless abstractions, magic numbers, and unnecessary dependencies.

## Final Report

- **Completed** — what was implemented
- **Files changed** — every created, modified, deleted file
- **Verification** — commands run and results
- **Assumptions** — including estimated Figma values and provisional content
- **Limitations / issues**
