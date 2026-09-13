# AGENTS.md

## Project Overview

Bukidnon Dental Portal is a dental clinic management system with:
- `backend/` Laravel REST API
- `web/` React web application
- `mobile/` React Native / Expo mobile application
- `docs/` project specifications and documentation

The current implementation priority is the `web/` application.

## Source of Truth

Before making UI changes, read:
1. `docs/UI_SPEC.md`
2. Existing code in `web/`
3. Relevant project documentation when available

Use the Figma design and `docs/UI_SPEC.md` as the visual source of truth.

Do not invent requirements that are not supported by the project documentation or existing implementation.

## Scope Rules

For web UI tasks:
- Work primarily inside `web/`.
- Do NOT modify `mobile/`.
- Do NOT modify `backend/` unless the task explicitly requires a backend change.
- Do NOT change database structure or run migrations for UI-only tasks.
- Preserve the existing project structure unless there is a clear reason to change it.
- Reuse existing dependencies and components when practical.

## React Rules

- Use the existing React setup and conventions.
- Prefer reusable components over duplicated markup.
- Keep components focused and maintainable.
- Do not introduce a new framework or major library without a clear need.
- Do not replace Create React App unless explicitly requested.
- Avoid unnecessary package installation.
- Keep UI behavior simple and predictable.

## API and Data Rules

- Do not invent API endpoints, response formats, fields, authentication behavior, or database relationships.
- Inspect the existing Laravel routes/controllers/models before connecting new UI features to the API.
- If an API is not yet available, use clearly isolated mock/static data only when necessary for the UI.
- Never expose secrets, tokens, passwords, or environment variables in frontend code.

## Authentication and Roles

The existing project uses Laravel Sanctum for API authentication.

Known application roles include:
- `patient`
- `staff`
- `dentist`
- `clinic_admin`
- `system_admin`

Do not assume that every role has access to every page or feature. Verify permissions from the existing backend implementation or project requirements.

## UI Implementation

When implementing Figma designs:
- Match layout, spacing, typography, colors, borders, shadows, radius, and hierarchy as closely as practical.
- Use the values documented in `docs/UI_SPEC.md`.
- Keep the design responsive.
- Preserve accessibility basics such as semantic HTML, readable contrast, labels, and keyboard-accessible controls.
- Do not add visual elements that are not part of the design unless needed for usability or functionality.

## Assets

- Reuse existing project assets when available.
- Do not invent asset paths.
- If an important Figma asset is unavailable, use a temporary clearly identifiable placeholder rather than silently substituting unrelated content.
- Keep asset references organized and maintainable.

## Coding Workflow

For each task:
1. Inspect the relevant existing files.
2. Read the applicable documentation.
3. Make the smallest necessary change.
4. Test the affected functionality.
5. Check for console/build errors.
6. Summarize what changed and any remaining issues.

Do not rewrite unrelated files.

## Token-Efficient AI Coding

Keep implementation focused.

- Work on one feature/page at a time.
- Avoid repeating large project files in prompts.
- Use `docs/UI_SPEC.md` instead of duplicating Figma specifications.
- Do not refactor unrelated code during feature implementation.
- Do not perform speculative improvements.
- Ask for clarification only when a missing requirement prevents correct implementation.
- Prefer small, reviewable changes over large rewrites.

## Current UI Implementation Order

Unless the user specifies another priority, implement in this order:

1. Guest Homepage
2. Find Clinics
3. Dentists
4. Shared navigation and footer refinements
5. Authentication pages
6. Role-based dashboards
7. Other authenticated web features

Complete and verify each page before moving to the next.

## Completion Criteria

A task is complete only when:
- The requested UI/functionality is implemented.
- Existing functionality is not unnecessarily broken.
- The implementation follows `docs/UI_SPEC.md`.
- No unrelated project areas were changed.
- The affected page works at reasonable desktop and mobile widths.
- There are no known avoidable build or console errors.

## Important

When requirements conflict:
1. Follow explicit user instructions.
2. Follow the project documentation.
3. Follow `docs/UI_SPEC.md` for UI decisions.
4. Follow the existing code architecture.
5. Do not guess. State the uncertainty and inspect the relevant code first.
