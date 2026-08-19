# Requirements Document

## Introduction

This specification defines requirements for implementing the "Academic Precision" design system across the Recall Desktop UI. The redesign transforms the existing neo-brutalist interface into a soft minimalist aesthetic optimized for academic research and spaced repetition learning. The implementation follows a phased approach to minimize disruption to existing functionality while systematically migrating all views and components to the new design tokens, typography, spacing, and component patterns defined in DESIGN.md.

## Glossary

- **Design_System**: The Academic Precision design system defined in DESIGN.md, including color tokens, typography scale, spacing units, shape language, and component patterns
- **Design_Token**: A named variable representing a design decision (color, spacing, typography) used consistently across the UI
- **Base_UI_Primitive**: Foundational reusable components (Button, Input, Card, Tag) that implement design tokens and are composed into higher-level components
- **Layout_Shell**: The fixed sidebar navigation and main content area structure that frames all application views
- **View_Component**: Top-level route components (LibraryView, BookDetailView, ReviewView, AnalyticsView) that render complete application screens
- **Complex_Component**: Specialized components with intricate behavior (CommandPalette, PdfAnnotationLayer, NotionEditor) requiring careful migration
- **Tailwind_Config**: The Tailwind CSS v4 configuration file using @theme syntax to define custom design tokens
- **Global_CSS**: The index.css file containing @theme definitions, base layer styles, and component-specific overrides
- **Soft_Minimalism**: The aesthetic principle emphasizing calm intelligence, expansive whitespace, diffused shadows, and content-first hierarchy
- **Migration_Phase**: A discrete implementation stage with specific deliverables and completion criteria
- **Accessibility_Standard**: WCAG 2.1 Level AA compliance requirements for color contrast, keyboard navigation, and screen reader support

## Requirements

### Requirement 1: Design Token System

**User Story:** As a developer, I want all design decisions encoded as design tokens, so that the UI maintains visual consistency and can be updated systematically.

#### Acceptance Criteria

1. THE Tailwind_Config SHALL define all color tokens from DESIGN.md using @theme syntax
2. THE Tailwind_Config SHALL define typography scale with Inter font family exclusively
3. THE Tailwind_Config SHALL define spacing tokens using an 8pt base unit (8, 16, 24, 32, 48, 64)
4. THE Tailwind_Config SHALL define shape tokens (radius-tag: 4px, radius-standard: 6px, radius-large: 12px)
5. THE Global_CSS SHALL apply design tokens to base HTML elements (body, headings, links)
6. THE Global_CSS SHALL define focus ring styles using accent-blue with 20% opacity
7. WHEN any component references a color, spacing, or typography value, THE component SHALL use design token classes exclusively

### Requirement 2: Base UI Primitives

**User Story:** As a developer, I want foundational UI components that implement the design system, so that I can compose consistent interfaces efficiently.

#### Acceptance Criteria

1. THE Button component SHALL support primary, secondary, and ghost variants using design tokens
2. THE Button component SHALL apply diffused ambient shadows (0 4px 6px -1px rgb(0 0 0 / 0.05))
3. THE Button component SHALL implement hover states with color shifts and subtle shadow changes
4. THE Input component SHALL use 1px borders with #E2E8F0 color
5. WHEN an Input receives focus, THE Input SHALL display a 2px blue ring with 20% opacity
6. THE Card component SHALL use white background with 1px border and no shadow by default
7. WHEN a Card is hovered, THE Card SHALL introduce subtle shadow and shift border to #CBD5E1
8. THE Tag component SHALL use 4px radius with label-sm typography
9. THE Tag component SHALL support color variants for categories, status, and AI indicators

### Requirement 3: Typography Implementation

**User Story:** As a user, I want text hierarchy that is clear and readable, so that I can efficiently scan and consume academic content.

#### Acceptance Criteria

1. THE Design_System SHALL use Inter font exclusively across all text elements
2. THE Design_System SHALL apply display-lg style (48px, 700 weight, -0.02em spacing) to hero headings
3. THE Design_System SHALL apply headline-lg style (32px, 600 weight, -0.01em spacing) to page titles
4. THE Design_System SHALL apply headline-md style (24px, 600 weight) to section headings
5. THE Design_System SHALL apply body-lg style (18px, 400 weight, 28px line-height) to long-form content
6. THE Design_System SHALL apply body-md style (16px, 400 weight, 24px line-height) to standard UI text
7. THE Design_System SHALL apply label-md style (14px, 500 weight) to metadata and labels
8. THE Design_System SHALL apply label-sm style (12px, 500 weight, 0.02em spacing) to secondary metadata
9. THE Design_System SHALL apply mono-sm style (13px, Inter font) to code snippets and technical identifiers

### Requirement 4: Color System

**User Story:** As a user, I want a calm, professional color palette, so that I can focus on content without visual distraction.

#### Acceptance Criteria

1. THE Design_System SHALL use #0F172A (Deep Slate) for primary text and headlines
2. THE Design_System SHALL use #2563EB (Accent Blue) for primary CTAs, active states, and focus indicators
3. THE Design_System SHALL use #7C3AED (AI Purple) exclusively for AI-generated content indicators and AI action buttons
4. THE Design_System SHALL use #F8FAFC for base background
5. THE Design_System SHALL use #F1F5F9 for sidebar and secondary panel backgrounds
6. THE Design_System SHALL maintain minimum 4.5:1 contrast ratio between text and background colors
7. WHEN AI-related elements are rendered, THE Design_System SHALL apply purple tint to distinguish from user-generated content

### Requirement 5: Layout Shell

**User Story:** As a user, I want consistent navigation and content framing, so that I can orient myself across different application views.

#### Acceptance Criteria

1. THE Layout_Shell SHALL render a fixed 260px width sidebar
2. THE Layout_Shell SHALL apply collapsible behavior to sidebar with persistent state
3. THE Layout_Shell SHALL use 32px margins on desktop viewports
4. THE Layout_Shell SHALL use 16px margins on mobile viewports (≤768px)
5. THE Layout_Shell SHALL constrain main content to 720px width for reading-focused views
6. THE Layout_Shell SHALL use 12-column fluid grid for dashboard and library views
7. THE Sidebar SHALL display navigation items with 24px icons and 14px labels
8. WHEN a navigation item is active, THE Sidebar SHALL apply #EFF6FF background and blue vertical indicator

### Requirement 6: Spacing System

**User Story:** As a developer, I want predictable spacing units, so that layouts maintain rhythmic consistency.

#### Acceptance Criteria

1. THE Design_System SHALL enforce 8pt spacing unit as the base increment
2. THE Design_System SHALL provide spacing scale: 8, 16, 24, 32, 48, 64 pixels
3. THE Design_System SHALL apply 24px gutter spacing between major layout sections
4. THE Design_System SHALL apply 16px vertical spacing between stacked UI elements
5. THE Design_System SHALL apply 8px spacing within component internals (button padding, icon gaps)
6. WHEN developers apply spacing classes, THE classes SHALL use only 8pt multiples

### Requirement 7: Elevation and Depth

**User Story:** As a user, I want visual depth that feels subtle and professional, so that the interface doesn't appear flat or overly dramatic.

#### Acceptance Criteria

1. THE Design_System SHALL use tonal layering (color shifts) as the primary depth technique
2. THE Design_System SHALL apply diffused ambient shadows to floating elements exclusively
3. THE Design_System SHALL use shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)
4. THE Design_System SHALL avoid hard box shadows with high opacity or offset
5. WHEN AI-triggered elements are rendered, THE elements SHALL use 1px purple-tinted border (20% opacity)
6. THE Design_System SHALL use pure white backgrounds for floating panels with 1px #E2E8F0 border

### Requirement 8: Shape Language

**User Story:** As a developer, I want consistent border radius values, so that components feel cohesive and professionally designed.

#### Acceptance Criteria

1. THE Design_System SHALL apply 6px radius to standard elements (buttons, inputs, navigation items)
2. THE Design_System SHALL apply 12px radius to large containers and cards
3. THE Design_System SHALL apply 4px radius to tags and chips
4. THE Design_System SHALL apply full radius (9999px) to avatar elements
5. THE Design_System SHALL avoid sharp corners (0px radius) except for full-bleed containers

### Requirement 9: LibraryView Migration

**User Story:** As a user, I want the library view to reflect the Academic Precision aesthetic, so that my book collection feels organized and professional.

#### Acceptance Criteria

1. WHEN LibraryView is rendered, THE view SHALL use design token colors, typography, and spacing
2. THE LibraryView SHALL replace neo-brutalist card styling with soft minimalist cards
3. THE LibraryView SHALL apply white card backgrounds with 1px #E2E8F0 borders
4. THE LibraryView SHALL apply 12px radius to book cards
5. THE LibraryView SHALL use headline-lg typography for page title
6. THE LibraryView SHALL use body-md typography for card metadata
7. WHEN a book card is hovered, THE card SHALL apply subtle shadow and border color shift
8. THE LibraryView SHALL maintain existing functionality (file upload, drag-drop, deletion, navigation)

### Requirement 10: BookDetailView Migration

**User Story:** As a user, I want the book detail view to prioritize reading focus, so that I can consume content comfortably.

#### Acceptance Criteria

1. WHEN BookDetailView is rendered, THE view SHALL use design token colors, typography, and spacing
2. THE BookDetailView SHALL constrain main content to 720px width for optimal readability
3. THE BookDetailView SHALL apply body-lg typography (18px, 28px line-height) to article content
4. THE BookDetailView SHALL use headline-md for section headings within content
5. THE BookDetailView SHALL maintain existing PDF viewer, annotation, and navigation functionality

### Requirement 11: ReviewView Migration

**User Story:** As a user, I want the flashcard review interface to feel calm and focused, so that I can concentrate during study sessions.

#### Acceptance Criteria

1. WHEN ReviewView is rendered, THE view SHALL use design token colors, typography, and spacing
2. THE ReviewView SHALL apply white card backgrounds with diffused ambient shadows
3. THE ReviewView SHALL use headline-md typography for flashcard question text
4. THE ReviewView SHALL use body-lg typography for flashcard answer text
5. THE ReviewView SHALL apply accent-blue to primary action buttons (Show Answer, Next Card)
6. THE ReviewView SHALL maintain existing FSRS scheduling and progress tracking functionality

### Requirement 12: AnalyticsView Migration

**User Story:** As a user, I want the analytics dashboard to present data clearly, so that I can understand my learning progress at a glance.

#### Acceptance Criteria

1. WHEN AnalyticsView is rendered, THE view SHALL use design token colors, typography, and spacing
2. THE AnalyticsView SHALL use 12-column fluid grid for dashboard layout
3. THE AnalyticsView SHALL apply white card backgrounds with 1px borders to stat cards
4. THE AnalyticsView SHALL use headline-lg typography for metric values
5. THE AnalyticsView SHALL use label-md typography for metric labels
6. THE AnalyticsView SHALL apply accent-blue to chart accent elements
7. THE AnalyticsView SHALL maintain existing Recharts integration and data fetching functionality

### Requirement 13: CommandPalette Migration

**User Story:** As a user, I want the command palette to feel modern and intelligent, so that keyboard navigation is efficient and delightful.

#### Acceptance Criteria

1. WHEN CommandPalette is rendered, THE component SHALL use centered floating modal layout
2. THE CommandPalette SHALL apply white background with 1px #E2E8F0 border
3. THE CommandPalette SHALL apply 6px radius to outer container
4. THE CommandPalette SHALL use diffused ambient shadow
5. THE CommandPalette SHALL apply body-md typography to command items
6. THE CommandPalette SHALL apply label-sm typography to keyboard shortcuts (KBD elements)
7. WHEN a command item is selected, THE item SHALL apply #EFF6FF background
8. THE CommandPalette SHALL render KBD elements with subtle grey background and 4px radius
9. THE CommandPalette SHALL maintain existing cmdk functionality and keyboard navigation

### Requirement 14: PDF Annotation Layer Migration

**User Story:** As a user, I want PDF annotations to feel integrated and professional, so that highlighting and note-taking is visually cohesive.

#### Acceptance Criteria

1. WHEN PdfAnnotationLayer renders highlights, THE highlights SHALL use design token colors
2. THE PdfAnnotationLayer SHALL apply ai-purple (20% opacity) to AI-generated highlights
3. THE PdfAnnotationLayer SHALL apply accent-blue (20% opacity) to user-created highlights
4. THE PdfAnnotationLayer SHALL render annotation popovers with white background and 1px border
5. THE PdfAnnotationLayer SHALL apply 6px radius to popover containers
6. THE PdfAnnotationLayer SHALL use body-md typography for annotation text
7. THE PdfAnnotationLayer SHALL maintain existing react-pdf-highlighter integration and click handling

### Requirement 15: Sidebar Component Migration

**User Story:** As a user, I want navigation that is clear and accessible, so that I can switch between views efficiently.

#### Acceptance Criteria

1. WHEN Sidebar is rendered, THE component SHALL apply #F1F5F9 background
2. THE Sidebar SHALL render navigation items with 24px icons and 14px labels (label-md typography)
3. THE Sidebar SHALL apply 6px radius to navigation items
4. WHEN a navigation item is active, THE item SHALL apply #EFF6FF background and blue vertical indicator
5. WHEN a navigation item is hovered, THE item SHALL apply #F1F5F9 background
6. THE Sidebar SHALL render AI-related icons (BrainCircuit) in ai-purple color
7. THE Sidebar SHALL maintain existing routing and keyboard shortcut hint display

### Requirement 16: Notion-Style Editor Migration

**User Story:** As a developer, I want the Notion-style editor to integrate with the design system, so that content creation feels cohesive with the rest of the UI.

#### Acceptance Criteria

1. WHEN NotionNotesEditor is rendered, THE editor SHALL use design token typography for text content
2. THE NotionNotesEditor SHALL apply body-lg style to paragraph text
3. THE NotionNotesEditor SHALL apply headline-md style to heading blocks
4. THE NotionNotesEditor SHALL apply mono-sm style to code blocks
5. THE NotionNotesEditor SHALL use accent-blue for selection highlights
6. THE NotionNotesEditor SHALL apply 6px radius to block containers
7. THE NotionNotesEditor SHALL maintain existing BlockNote integration and slash command functionality

### Requirement 17: Accessibility Compliance

**User Story:** As a user with accessibility needs, I want the interface to be perceivable and operable, so that I can use the application independently.

#### Acceptance Criteria

1. THE Design_System SHALL maintain minimum 4.5:1 contrast ratio for body text against backgrounds
2. THE Design_System SHALL maintain minimum 3:1 contrast ratio for large text (≥18px) against backgrounds
3. THE Design_System SHALL maintain minimum 3:1 contrast ratio for UI component boundaries against adjacent colors
4. WHEN keyboard focus is applied, THE focused element SHALL display visible focus indicator (2px blue ring)
5. THE Design_System SHALL support tab navigation for all interactive elements
6. THE Design_System SHALL provide accessible labels for icon-only buttons via aria-label attributes
7. WHEN screen readers encounter interactive elements, THE elements SHALL announce their role and state
8. THE Design_System SHALL avoid using color as the sole means of conveying information

### Requirement 18: Responsive Layout Behavior

**User Story:** As a user on different devices, I want the interface to adapt gracefully, so that the application is usable across screen sizes.

#### Acceptance Criteria

1. WHEN viewport width is ≤768px, THE Layout_Shell SHALL use 16px margins instead of 32px
2. WHEN viewport width is ≤768px, THE Sidebar SHALL collapse to icon-only mode or hide completely
3. WHEN viewport width is ≤768px, THE Layout_Shell SHALL use single-column layout for card grids
4. WHEN viewport width is ≥1200px, THE Layout_Shell SHALL constrain content to 1200px max-width
5. THE Design_System SHALL maintain touch-friendly target sizes (≥44px) for interactive elements on mobile
6. THE Design_System SHALL use headline-lg-mobile typography (28px) on mobile viewports instead of headline-lg

### Requirement 19: Animation and Motion

**User Story:** As a user, I want subtle motion that enhances understanding, so that transitions feel smooth without being distracting.

#### Acceptance Criteria

1. THE Design_System SHALL apply 200ms ease-out transitions to hover state changes
2. THE Design_System SHALL apply 300ms ease-in-out transitions to layout changes (sidebar collapse)
3. THE Design_System SHALL apply 150ms ease-out transitions to focus ring appearances
4. WHEN modals appear, THE modals SHALL use fade-in animation over 200ms
5. WHEN CommandPalette opens, THE palette SHALL use scale-up animation from 95% to 100% over 150ms
6. THE Design_System SHALL respect prefers-reduced-motion user preference by disabling animations
7. THE Design_System SHALL avoid gratuitous animations that don't serve functional purposes

### Requirement 20: Phased Implementation Strategy

**User Story:** As a developer, I want a structured migration plan, so that the redesign can be implemented incrementally without breaking existing functionality.

#### Acceptance Criteria

1. THE implementation SHALL follow five sequential phases: Tokens, Primitives, Shell, Views, Complex Components
2. WHEN Phase 1 is complete, THE Tailwind_Config and Global_CSS SHALL define all design tokens
3. WHEN Phase 2 is complete, THE components/ui folder SHALL contain Button, Input, Card, Tag components
4. WHEN Phase 3 is complete, THE App.tsx and Sidebar components SHALL use new design tokens
5. WHEN Phase 4 is complete, THE LibraryView, BookDetailView, ReviewView, AnalyticsView SHALL use design tokens
6. WHEN Phase 5 is complete, THE CommandPalette, PdfAnnotationLayer, NotionNotesEditor SHALL use design tokens
7. WHEN each phase is completed, THE application SHALL remain functional with no regression in existing features
8. THE implementation SHALL include verification testing after each phase to confirm functionality and visual accuracy
