# UI Specification

## Bukidnon Dental Portal Web Application

**Frontend:** React.js\
**Current web build system:** Create React App (`react-scripts`)\
**Design source:** Figma-exported UI specifications supplied for the
project\
**Scope:** Web frontend only

------------------------------------------------------------------------

## 1. Purpose

This document defines the approved visual and structural requirements
for the Bukidnon Dental Portal web application.

The Figma exports are the primary source for the guest-facing visual
design. React.js should reproduce the intended layout, typography,
spacing, colors, cards, buttons, forms, and responsive behavior without
copying the Figma CSS literally.

This document is intended to guide implementation and reduce unnecessary
design decisions or hallucinated UI changes during AI-assisted coding.

------------------------------------------------------------------------

## 2. Project Boundaries

The current implementation task is the React.js web application in:

``` text
web/
```

Do not modify the following during web UI implementation:

``` text
backend/
mobile/
```

The existing project uses a Laravel REST API for backend services and
React.js for the web frontend. The current web source is a static React
application with no routing, authentication flow, API client, or
role-based interface yet.

The UI implementation should therefore be done incrementally.

------------------------------------------------------------------------

## 3. Design Principles

-   Match the supplied Figma design as closely as practical.
-   Use React components instead of one large component.
-   Reuse common UI elements such as navigation, buttons, search
    controls, cards, and footer sections.
-   Keep styling in the existing web project's CSS/global stylesheet
    approach unless a deliberate architecture change is approved.
-   Do not introduce a new UI library or styling framework just to
    reproduce the Figma.
-   Do not invent content, pages, features, API data, or interactions
    that are not supported by the design or project requirements.
-   Keep the first implementation visual/static. API integration should
    be added separately after the UI structure is stable.
-   Preserve responsive behavior instead of hard-coding the Figma
    desktop canvas dimensions as the actual browser layout.

------------------------------------------------------------------------

## 4. Global Visual System

### 4.1 Font

Primary font:

``` text
Inter
```

The Figma designs consistently use Inter for headings, body text,
labels, buttons, and footer content.

If the exact font is not already available in the project, use the least
invasive method available in the existing React project. Do not add
unnecessary dependencies.

### 4.2 Primary Colors

  Purpose                    Value
  -------------------------- -----------
  Primary dark blue          `#003F87`
  Primary button blue        `#0056B3`
  Dark text                  `#181C20`
  Body text                  `#424752`
  Light page background      `#F7F9FF`
  Light section background   `#F1F4F9`
  Border                     `#C2C6D4`
  Map/background gray        `#EBEEF3`
  Secondary map gray         `#E5E7EB`
  Green accent               `#006C4F`
  Light green accent         `#67FCC6`
  White                      `#FFFFFF`

### 4.3 Common Typography

Large hero heading:

``` text
Font: Inter
Weight: 700
Size: 48px
Line height: 58px
Letter spacing: -0.96px
Color: #003F87
```

Standard section heading:

``` text
Font: Inter
Weight: 600
Size: 32px
Line height: 42px
Color: #181C20
```

Body text commonly uses:

``` text
Font: Inter
Weight: 400
Size: 16px
Line height: 24px to 26px
Color: #424752
```

Footer brand text:

``` text
Font: Inter
Weight: 700
Size: 24px
Line height: 34px
Color: #003F87
```

Footer section headings:

``` text
Font: Inter
Weight: 700
Size: 16px
Line height: 26px
Color: #181C20
```

Footer body/link text:

``` text
Font: Inter
Weight: 400
Size: 14px
Line height: 22px
Color: #424752
```

------------------------------------------------------------------------

## 5. Shared Page Structure

The guest pages use a common visual language:

``` text
Header / Navigation
        ↓
Page content
        ↓
Footer
```

The exact header contents and dimensions should follow the corresponding
Figma design.

The footer uses a light `#F1F4F9` background and a top border using
`#C2C6D4`.

The footer includes the BukidnonDental brand and an Explore section. The
supplied design contains links such as:

-   Find a Dentist
-   Clinic Directory

Do not add additional footer links unless they are present in the
approved design or later requirements.

------------------------------------------------------------------------

# 6. Guest Homepage

## 6.1 Figma Canvas

The supplied Figma export identifies the page as:

``` text
BukidnonDental - Guest Homepage
```

Desktop reference:

``` text
Width: 1280px
Height: 3910px
Background: #F7F9FF
```

The Figma dimensions are reference measurements. React implementation
must remain responsive.

## 6.2 Hero Section

Reference:

``` text
Height: 600px
Minimum height: 600px
Padding: 50px 48px
Background: #FFFFFF
```

The hero is a two-column layout.

Approximate desktop structure:

``` text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Text / CTA                         Dental Clinic Image     │
│  576px                              576px                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Hero heading

Text:

``` text
Find Trusted Dental Clinics Across Bukidnon
```

Style:

``` text
Inter
700
48px
58px line height
-0.96px letter spacing
#003F87
```

The heading reference width is approximately `576px`.

### Hero body

Style:

``` text
Inter
400
16px
26px line height
#424752
```

The reference content width is approximately `512px`.

### Hero CTA

Reference button:

``` text
Width: approximately 177px
Height: 60px
Padding: 18px 32px
Gap: 8px
Background: #0056B3
Border radius: 8px
```

The button must be implemented as a real React interactive element/link.

The exact destination/action should use the approved application route
when routing is implemented. Do not invent a backend action.

### Hero image

Reference image:

``` text
Dental Clinic Interior
Width: 576px
Height: 500px
Border: 4px solid #FFFFFF
Border radius: 32px
Shadow: 0px 25px 50px -12px rgba(0,0,0,0.25)
```

The design also contains a green translucent blurred overlay:

``` text
rgba(103, 252, 198, 0.2)
Blur: 50px
```

The image asset should use the actual supplied/project asset when
available. Do not replace it with a random stock image.

------------------------------------------------------------------------

## 6.3 Find Clinics Near You Section

Heading:

``` text
Find Clinics Near You
```

Style:

``` text
Inter
600
32px
42px line height
#181C20
```

Description:

``` text
Interactive map showing dental partners across Bukidnon.
```

Style:

``` text
Inter
400
16px
24px line height
#424752
```

The reference map area is:

``` text
Width: 1280px
Height: 450px
```

The Figma currently represents the map visually with gray placeholder
layers:

``` text
#EBEEF3
#E5E7EB
```

and a Bukidnon map placeholder image with approximately `0.6` opacity.

For the initial UI implementation, reproduce the visual placeholder if
an actual map integration is not yet part of the task.

Do not implement Google Maps API integration as part of a purely visual
UI task.

------------------------------------------------------------------------

## 6.4 Homepage Content Sections

The supplied homepage design contains additional promotional/content
areas below the hero and clinic map. One visible design section uses:

``` text
Badge: AFFORDABLE CARE
Heading: Affordable Care for Everyone
```

Supporting text:

``` text
We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon.
```

Reference heading style:

``` text
Inter
600
32px
40px line height
#181C20
```

Supporting text:

``` text
Inter
400
16px
26px line height
#424752
```

The implementation should preserve the Figma section order and visual
hierarchy. Use supplied assets where available.

The homepage also contains testimonial content. One supplied testimonial
is:

``` text
"Booking was so easy through BukidnonDental. I found a clinic in Malaybalay that fits my schedule perfectly."
```

Testimonial text style:

``` text
Inter
Italic
400
16px
24px line height
#424752
```

Do not invent additional testimonials or claims.

------------------------------------------------------------------------

# 7. Find Clinics Page

## 7.1 Figma Reference

Page:

``` text
Web Find Clinics
```

Desktop reference:

``` text
Width: 1280px
Height: 1470px
Background: #F7F9FF
```

Main content reference:

``` text
Padding: 32px 48px
Gap: approximately 32px
Maximum content width: approximately 1184px
```

## 7.2 Search Hero

Heading:

``` text
Find Your Perfect Smile
```

Style:

``` text
Inter
600
32px
42px line height
#181C20
```

Description:

``` text
```

Use the exact description from the approved Figma export if present. Do
not invent replacement wording.

## 7.3 Search and Filters Container

Reference:

``` text
Width: 1184px
Height: approximately 98px
Padding: 24px
Gap: 16px
Background: #FFFFFF
Border: 1px solid #C2C6D4
Shadow: 0px 1px 2px rgba(0,0,0,0.05)
Border radius: 12px
```

The search/filter area should be implemented as reusable React controls.

Possible controls visible in the Figma include search and filtering
fields. Their exact labels/options must follow the Figma design.

Do not connect these controls to the API until the UI task explicitly
includes API integration.

## 7.4 Clinic/Dentist Results

Result cards should follow the supplied Figma dimensions, borders,
spacing, status badges, imagery, and typography.

Do not invent backend fields. When static data is needed to reproduce
the design, use clearly separated mock data that can later be replaced
by API data.

------------------------------------------------------------------------

# 8. Dentists Page

## 8.1 Figma Reference

Page:

``` text
Web Dentists
```

Desktop reference:

``` text
Width: 1280px
Height: approximately 1926px
Background: #F7F9FF
```

## 8.2 Search Hero

Background:

``` text
#F1F4F9
```

Padding:

``` text
32px 48px
```

Heading:

``` text
Find the Right Dentist
```

Style:

``` text
Inter
600
32px
42px line height
#181C20
```

Description:

``` text
Expert dental care tailored to your needs in Bukidnon.
```

Style:

``` text
Inter
400
16px
26px line height
#424752
```

## 8.3 Search Field

Reference:

``` text
Height: approximately 48px
Border: 1px solid #C2C6D4
Border radius: 12px
Background: #FFFFFF
```

The supplied Figma includes the placeholder:

``` text
Search by name or clinic...
```

Use the same placeholder in the visual implementation.

## 8.4 Dentist Cards

Dentist cards use:

``` text
Background: #FFFFFF
Border: 1px solid #C2C6D4
Border radius: 12px
```

The supplied design includes a dentist image area and status badge.

One example in the Figma uses:

``` text
Dr. Sophia Chen
```

Do not treat the example dentist as real application data. It is
design/mock content unless the actual backend data provides it.

Status/accent elements include the green palette, including:

``` text
#67FCC6
#007354
```

Use these only where the Figma shows them.

------------------------------------------------------------------------

# 9. Services / Promotional Content

The supplied homepage design includes a service/value proposition
section using a blue category badge and content about affordable care.

Reference badge:

``` text
Background: #0056B3
Border radius: 9999px
Text: white
Font size: 12px
Font weight: 700
Letter spacing: 0.6px
Text transform: uppercase
```

Reference heading:

``` text
Affordable Care for Everyone
```

Reference supporting text:

``` text
We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon.
```

Use image cards/content blocks according to the supplied Figma assets
and layout.

------------------------------------------------------------------------

# 10. About / Contact

The supplied Figma set includes an About/Contact design reference.

The visual implementation must follow the supplied design rather than
inventing a new page structure.

Where the Figma uses:

-   content blocks
-   contact information
-   images
-   cards
-   headings
-   buttons
-   footer sections

reproduce their visual hierarchy and spacing.

If exact text or data is not present in the source design, leave the
content as an explicit implementation placeholder rather than
fabricating project information.

------------------------------------------------------------------------

# 11. Responsive Behavior

The Figma exports are primarily desktop references at `1280px`.

React implementation must not preserve absolute positioning that breaks
on smaller screens.

Recommended behavior:

### Desktop

-   Two-column hero layouts where shown.
-   Maximum content width around `1184px`.
-   Desktop navigation.
-   Multi-column result/card layouts where supported by the design.

### Tablet

-   Reduce horizontal padding.
-   Allow columns to shrink.
-   Search/filter controls may wrap.
-   Cards may reduce column count.

### Mobile

-   Stack two-column sections vertically.
-   Hero image moves below hero text when necessary.
-   Headings scale down while maintaining hierarchy.
-   Search/filter controls stack vertically.
-   Cards become one column.
-   Footer columns stack.
-   Avoid horizontal overflow.

Exact mobile dimensions are not specified by the supplied desktop Figma
exports. Therefore, responsive values should be implemented
conservatively and should preserve the desktop visual design rather than
inventing a separate mobile design.

------------------------------------------------------------------------

# 12. Component Strategy

The UI should be built with reusable React components.

Suggested structure:

``` text
web/src/
├── components/
│   ├── Header/
│   ├── Footer/
│   ├── Button/
│   ├── SearchBar/
│   ├── FilterControl/
│   ├── ClinicCard/
│   ├── DentistCard/
│   ├── StatusBadge/
│   └── SectionHeading/
│
├── pages/
│   ├── GuestHome/
│   ├── FindClinics/
│   ├── Dentists/
│   ├── Services/
│   └── AboutContact/
│
├── layouts/
│   └── GuestLayout/
│
└── styles/
```

This is a suggested organization, not a requirement to create every
folder immediately.

For the first implementation task, create only the components actually
needed by the target page.

------------------------------------------------------------------------

# 13. Static Data vs API Data

## Initial visual implementation

Use static/mock data only when required to reproduce the Figma design.

Keep mock data separate from presentation components.

Example:

``` text
src/data/
```

or a local data module appropriate to the existing project structure.

## Later API integration

The actual web API should use the existing Laravel REST API.

The current project audit confirms that the web frontend does not yet
have an API client or Axios configuration, while the backend exposes
public clinic discovery and authentication endpoints.

Do not invent API endpoints.

Before API integration, verify the actual Laravel routes/controllers.

------------------------------------------------------------------------

# 14. Navigation and Routing

The current web application has no React routing.

When routing is introduced, guest pages should be represented by clear
application routes.

Suggested conceptual routes:

``` text
/
 /clinics
 /dentists
 /services
 /about
```

These are route intentions only. Confirm the final route names before
implementation.

Do not add authentication-protected routes until the web authentication
foundation is implemented.

------------------------------------------------------------------------

# 15. Accessibility

The React implementation should:

-   Use semantic HTML.
-   Use real buttons for actions.
-   Use links for navigation.
-   Provide meaningful `alt` text for meaningful images.
-   Use empty alt text for decorative images.
-   Keep keyboard focus visible.
-   Avoid using color alone to communicate important state.
-   Associate labels with form inputs.
-   Preserve readable contrast.

Accessibility additions should not materially alter the approved visual
design.

------------------------------------------------------------------------

# 16. Interaction Rules

For visual-only implementation:

-   Buttons should have appropriate hover/focus states.
-   Search inputs should be usable but do not need backend search.
-   Filters can be visually interactive only if required by the design.
-   Cards should not navigate to invented routes.
-   Loading states, API errors, authentication, and real search behavior
    belong to later implementation tasks unless explicitly requested.

Do not create fake API calls or simulated backend responses just to make
the page appear functional.

------------------------------------------------------------------------

# 17. Image and Asset Rules

Use the actual Figma/project assets when available.

Important named design assets include:

``` text
Dental Clinic Interior
Bukidnon Map Placeholder
Dentist working
Modern equipment
Dentist profile images
```

Figma CSS references such as:

``` text
background: url(.png);
```

do not identify the actual asset filename.

Therefore:

1.  Inspect the existing `web/public` or asset directories.
2.  Reuse matching assets if they exist.
3.  If an asset is missing, use a clearly identified placeholder only
    when necessary.
4.  Do not download random images from the internet without approval.
5.  Do not invent asset filenames.

------------------------------------------------------------------------

# 18. Do Not Hallucinate

The following must not be invented during UI implementation:

-   API endpoints
-   database fields
-   user roles not defined by the project
-   clinic records
-   dentist records
-   subscription information
-   billing behavior
-   payment processing
-   backend capabilities
-   additional pages
-   additional navigation links
-   additional testimonials
-   fake integrations

If something required by the Figma is not available in the repository,
stop and identify the missing asset or requirement rather than silently
replacing it with unrelated content.

------------------------------------------------------------------------

# 19. Implementation Order

Use small, verifiable tasks.

Recommended order:

``` text
1. Guest Homepage visual implementation
2. Shared Header/Footer cleanup
3. Find Clinics visual implementation
4. Dentists visual implementation
5. Services visual implementation
6. About/Contact visual implementation
7. React routing
8. Authentication UI
9. API client
10. Public API integration
11. Role-based authenticated UI
```

Do not combine all of these into one Codex task.

------------------------------------------------------------------------

# 20. Acceptance Criteria for UI Tasks

A UI task is complete when:

-   The requested page renders successfully in the existing React app.
-   The page visually follows the supplied Figma reference.
-   Desktop layout matches the reference structure.
-   Responsive behavior does not produce horizontal overflow.
-   Typography, colors, spacing, borders, shadows, and radius values are
    reasonably matched.
-   Existing project boundaries are preserved.
-   No mobile files are changed.
-   No backend files are changed for a visual-only task.
-   No unnecessary packages are installed.
-   No unrelated pages or features are modified.
-   The React build completes successfully.
-   The implementation uses reusable components where repetition exists.
-   No invented API behavior is introduced.

------------------------------------------------------------------------

# 21. Project Constraints from Repository Audit

The existing repository has these relevant conditions:

-   `web/` is a Create React App application.
-   React version is currently `19.2.7`.
-   `react-scripts` is currently `5.0.1`.
-   There is currently no React Router.
-   There are currently no reusable web components/layouts.
-   The current web app is a static dentist portfolio.
-   Axios is installed but currently unused by the web source.
-   The backend is Laravel 12.
-   The backend exposes REST endpoints under `/api`.
-   Authentication uses Laravel Sanctum personal access tokens and
    Bearer authentication.
-   The project contains `patient`, `staff`, `dentist`, `clinic_admin`,
    and `system_admin` roles.
-   The mobile application is outside the current web implementation
    scope.

These constraints are based on the repository audit and should be
treated as implementation context, not as reasons to redesign the
system.

------------------------------------------------------------------------

# 22. AI Coding Rules

When using Codex or another coding agent:

1.  Read this file before changing the web UI.
2.  Inspect the existing `web/` files before creating new architecture.
3.  Work only on the requested page/task.
4.  Reuse existing CSS conventions unless there is a clear reason not
    to.
5.  Do not modify `backend/` or `mobile/` for a visual-only task.
6.  Do not install packages unless explicitly required and approved.
7.  Do not invent missing assets.
8.  Do not invent API contracts.
9.  Do not refactor unrelated code.
10. Run the appropriate web build/test after the change.
11. Report changed files and any unresolved visual differences.
12. If the Figma and repository conflict, stop and report the conflict
    rather than silently choosing a new design.

------------------------------------------------------------------------

# 23. Source of Truth

For guest-facing visual design:

``` text
Figma-exported UI specifications supplied with the project
```

For current implementation constraints:

``` text
Existing repository code
```

For backend API behavior:

``` text
Actual Laravel routes/controllers/models
```

For project scope and functional requirements:

``` text
Approved capstone requirements/proposal
```

Do not treat a Figma CSS export as a complete application specification.
It defines visual intent and measurements, not backend behavior or
database contracts.
