# Development Plan

## 1. Purpose

This document defines the implementation order for the Bukidnon Dental Portal web application.

The goal is to implement the approved Figma UI in the existing React application while preserving the existing Laravel backend and mobile application.

Implementation should be incremental, testable, and token-efficient for AI-assisted coding.

---

## 2. Current Scope

### Primary scope

- `web/` React application
- Figma-based UI implementation
- Responsive web layouts
- Shared web components
- Web navigation and page structure
- Integration with existing backend APIs when the required API is confirmed

### Out of scope unless explicitly requested

- `mobile/` React Native / Expo application
- Rebuilding the Laravel backend
- Database redesign
- Database migrations
- Replacing the existing frontend framework
- Adding unrelated features or libraries

---

## 3. Source of Truth

Use the following order when making implementation decisions:

1. Explicit user instructions
2. Approved Figma designs
3. `docs/UI_SPEC.md`
4. Existing project code and architecture
5. Other project documentation

Do not invent missing requirements.

If a UI requires backend data and the corresponding API is unclear or unavailable, inspect the existing backend before creating an integration.

---

## 4. Implementation Strategy

Build the web application in small vertical slices.

For each page:

1. Inspect the existing React files.
2. Identify reusable components.
3. Implement the page structure.
4. Match the Figma layout and visual specifications.
5. Add responsive behavior.
6. Connect real API data only when the API contract is confirmed.
7. Test the page.
8. Fix visual or functional issues.
9. Move to the next page.

Do not implement the entire portal in one task.

---

# 5. Phase 0: Project Preparation

### Goal

Prepare the existing React application for controlled UI implementation.

### Tasks

- Inspect the current `web/` structure.
- Identify the existing entry point.
- Identify existing CSS/global styles.
- Identify existing assets.
- Identify existing components, if any.
- Confirm the current React scripts and dependencies.
- Confirm the current development/build commands.
- Avoid unnecessary dependency changes.

### Completion criteria

- Existing web app still runs.
- Existing functionality is preserved.
- No unrelated folders are modified.

---

# 6. Phase 1: Shared UI Foundation

### Goal

Create only the reusable UI pieces needed by the approved Figma pages.

### Initial shared components

Potential components include:

- Header / Navigation
- Footer
- Button
- Section container
- Search input
- Filter controls
- Clinic card
- Dentist card
- Badge
- Loading state
- Empty state

Only create components when they are actually reused.

### Rules

- Follow `docs/UI_SPEC.md`.
- Reuse styles instead of duplicating them.
- Do not build speculative components for future features.
- Keep the implementation simple.

### Completion criteria

- Shared components work independently.
- Styling matches the approved visual system.
- Components can be reused by multiple pages.

---

# 7. Phase 2: Guest Homepage

### Priority

Highest.

### Goal

Implement the Figma Guest Homepage in the React web application.

### Main sections

1. Header/navigation
2. Hero section
3. Hero image
4. Primary CTA
5. Find Clinics Near You section
6. Map area
7. Affordable Care section
8. Testimonial section
9. Footer

### Requirements

- Follow `docs/UI_SPEC.md`.
- Match Figma typography, spacing, colors, borders, shadows, and radius.
- Use available project assets where appropriate.
- Keep the map area isolated so a real map can be integrated later.
- Do not invent map functionality.
- Ensure responsive behavior.

### Completion criteria

- Homepage visually matches the approved Figma design.
- Navigation and CTA behavior are functional where requirements are known.
- Desktop and mobile layouts are usable.
- No avoidable console/build errors.

---

# 8. Phase 3: Find Clinics

### Goal

Implement the Find Clinics page based on the Figma design.

### Main elements

- Page heading
- Supporting text
- Search area
- Filter controls
- Clinic results
- Clinic cards
- Empty/loading states where needed

### Data strategy

First implement the UI using controlled static/mock data if the required API contract is not confirmed.

Before API integration:

- Inspect the Laravel routes.
- Inspect relevant controllers/resources.
- Confirm response fields.
- Confirm authentication requirements if any.

Never invent an endpoint.

### Completion criteria

- Figma layout is implemented.
- Search/filter UI is functional to the extent supported by the available data.
- Real API integration is used only after the contract is confirmed.

---

# 9. Phase 4: Dentists

### Goal

Implement the Dentists page based on the Figma design.

### Main elements

- Page heading
- Supporting text
- Search/filter area if included in the approved design
- Dentist results
- Dentist cards
- Relevant empty/loading states

### Data strategy

Follow the same verification process used for Find Clinics.

### Completion criteria

- Figma design is implemented.
- Responsive layout works.
- API integration is based on confirmed backend behavior only.

---

# 10. Phase 5: Navigation and Public Page Refinement

### Goal

Connect and refine the public-facing pages.

### Tasks

- Verify navigation links.
- Verify active navigation states.
- Verify CTA destinations.
- Verify footer links.
- Verify consistent header/footer behavior.
- Check responsive navigation.
- Remove temporary placeholders that are no longer needed.

### Completion criteria

A user can move between completed public pages without broken routes or links.

---

# 11. Phase 6: Authentication UI

### Goal

Implement web authentication screens required by the project.

### Possible pages

- Login
- Registration if required for the web
- Forgot password if required
- Password reset if required

### Rules

- Inspect existing Sanctum/authentication behavior before integration.
- Do not invent authentication endpoints.
- Do not expose tokens or secrets.
- Preserve the backend authentication architecture.

### Completion criteria

- UI matches the approved design.
- Authentication behavior follows the existing backend implementation.
- Invalid/loading/success states are handled appropriately.

---

# 12. Phase 7: Role-Based Web Areas

### Goal

Implement authenticated web interfaces based on confirmed project requirements and backend permissions.

### Roles

Known roles include:

- `staff`
- `dentist`
- `clinic_admin`
- `system_admin`

Do not assume permissions beyond what the backend and requirements support.

### Potential areas

Depending on confirmed requirements:

- Dashboard
- Appointments
- Patient records
- Treatment records
- Inventory
- Reports
- Notifications
- Clinic management
- Staff management
- System administration

Implement one feature area at a time.

---

# 13. Phase 8: API Integration

API integration should happen progressively, not as one large task.

For each API-backed feature:

1. Identify the frontend requirement.
2. Inspect the corresponding Laravel route.
3. Inspect controller/request/resource/model behavior.
4. Confirm endpoint and HTTP method.
5. Confirm request fields.
6. Confirm response fields.
7. Confirm authentication/role requirements.
8. Implement the frontend integration.
9. Handle loading, success, empty, and error states.
10. Test against the actual backend.

If the backend implementation does not support a required feature, document the gap instead of inventing a frontend contract.

---

# 14. Phase 9: Responsive and Accessibility Pass

After the main pages are implemented:

### Responsive checks

Test at minimum:

- Desktop
- Tablet
- Mobile

Check:

- Navigation
- Text wrapping
- Cards
- Buttons
- Forms
- Search/filter controls
- Images
- Spacing
- Horizontal overflow

### Accessibility checks

Check:

- Semantic HTML
- Form labels
- Button names
- Image alternative text
- Keyboard accessibility
- Focus states
- Readable contrast

---

# 15. Phase 10: Final QA

Before considering the web UI complete:

### Functional

- Routes work.
- Buttons have correct destinations/actions.
- Forms behave correctly.
- API-backed pages handle loading and errors.
- Authentication behavior works where implemented.

### Visual

- Typography matches the specification.
- Colors match the specification.
- Spacing is consistent.
- Cards and controls match the design.
- Images use the correct assets.
- Responsive layouts do not break.

### Technical

- No avoidable console errors.
- No avoidable build errors.
- No broken imports.
- No unused speculative dependencies.
- No accidental changes to `mobile/`.
- No unnecessary backend changes.

---

# 16. Git and Change Management

Keep changes small and reviewable.

Recommended sequence:

```text
UI foundation
    ↓
Guest Homepage
    ↓
Find Clinics
    ↓
Dentists
    ↓
Public navigation refinement
    ↓
Authentication
    ↓
Role-based features
    ↓
API integration
    ↓
Responsive/accessibility pass
    ↓
Final QA
```

Create a Git commit after each stable milestone.

Suggested commit style:

```text
feat(web): implement guest homepage
feat(web): implement find clinics page
feat(web): implement dentists page
feat(web): add public navigation
feat(web): add authentication UI
```

Do not combine unrelated work into one commit.

---

# 17. AI Coding Rules

When using Codex or another coding agent:

### Give one task at a time

Good:

> Implement the Guest Homepage using `docs/UI_SPEC.md`. Do not modify `backend/` or `mobile/`.

Avoid:

> Build the entire Bukidnon Dental Portal.

### Require inspection first

The agent should inspect the relevant existing files before changing them.

### Keep scope explicit

Every implementation prompt should state:

- Target folder
- Target page/feature
- Source of truth
- Files or areas that must not be changed
- Acceptance criteria

### Avoid hallucination

The agent must not invent:

- API endpoints
- Database fields
- Authentication flows
- User roles
- Figma requirements
- Assets
- Features

When uncertain, inspect the repository or report the uncertainty.

---

# 18. Current Priority

The immediate implementation target is:

## Guest Homepage

Do not proceed to the other pages until the Guest Homepage is implemented and visually reviewed.

The next Codex task should therefore focus only on:

```text
web/
└── Guest Homepage
```

with `docs/UI_SPEC.md` as the UI specification.

---

# 19. Definition of Done

The web implementation is considered ready for the next milestone when:

- The current milestone matches its approved Figma design.
- The implementation follows `docs/UI_SPEC.md`.
- Existing project architecture is preserved.
- No unrelated files were changed.
- No unnecessary dependencies were added.
- The page is responsive.
- Known interactions work.
- There are no known avoidable build or console errors.
- The changes are committed as a focused Git commit.
