---
name: Executive Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#534434'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#867461'
  outline-variant: '#d8c3ad'
  surface-tint: '#855300'
  primary: '#855300'
  on-primary: '#ffffff'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#ffb95f'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#30c88f'
  on-tertiary-container: '#004e34'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 240px
  panel-padding: 16px
  item-gap: 12px
  stack-tight: 4px
  canvas-margin: 48px
---

## Brand & Style
The design system is engineered for high-stakes professional productivity, specifically tailored for AI-assisted document refinement. The personality is authoritative, precise, and unobtrusive, positioning itself as a sophisticated tool for career advancement rather than a consumer-grade app.

The design style leans heavily into **Minimalism** with a **Corporate / Modern** structure. It utilizes a clear spatial hierarchy to separate navigation, workspace, and utility panels. The interface prioritizes density and information clarity, using subtle lines and distinct background tones rather than heavy shadows to define structure. The emotional response should be one of "controlled efficiency"—giving the user confidence that the AI is a precise instrument under their command.

## Colors
The palette is intentionally restrained to keep the focus on the user's content. 
- **Primary (#F59E0B):** Reserved for AI-driven insights, primary actions, and highlights. It signifies "active intelligence."
- **Deep Navy Sidebar (#0F172A):** Provides a grounding architectural anchor, distinguishing navigation from the work area.
- **Canvas White (#FFFFFF):** The resume preview area must remain pure white to simulate a printed A4 document accurately.
- **Semantic Colors:** Success Green (#10B981) for confirmed AI edits and Alert Red (#EF4444) for critical warnings or quota limits.
- **Neutral Grays:** Used for borders, secondary text, and metadata labels to maintain a high-density, low-fatigue environment.

## Typography
Inter is used for its exceptional legibility at small sizes and its neutral, professional tone. 
- **Hierarchy:** Use `headline-lg` sparingly for page titles. `headline-md` serves as the primary header for library cards and resume sections.
- **Density:** `body-sm` is the workhorse for high-density side-panels and metadata.
- **Functional Accents:** JetBrains Mono is introduced for "mono-label" roles, such as quota counts, version numbers, or technical metadata, providing a "tooling" aesthetic.
- **Multi-language:** The system scales seamlessly for Chinese characters; ensure a minimum line-height of 1.5x for CJK text to maintain readability in bilingual contexts.

## Layout & Spacing
The layout uses a **Fixed-Fluid Hybrid** model.
- **Sidebar:** Fixed at 240px, anchored to the left.
- **Utility Panel:** A secondary fixed-width panel (360px) on the right or left for AI insights and the Information Library.
- **Workspace:** A fluid center area that houses the A4 Resume Canvas. The canvas itself should maintain a fixed aspect ratio (210mm x 297mm) centered with `canvas-margin` on all sides.
- **Density:** A tight 4px/8px/12px grid is used for component internals. This allows for maximum information density in the library and comparison views without feeling cluttered.

## Elevation & Depth
This design system avoids traditional shadows to maintain a "flat professional" look.
- **Structural Separation:** Depth is achieved through color-blocking (Navy vs. Off-white) and 1px borders (#E2E8F0).
- **Active State:** Elements being dragged or currently selected by the AI use a subtle 2px solid primary border rather than a shadow.
- **Floating Panels:** Only global modals or dropdown menus use a very low-opacity, large-radius ambient shadow (`0 10px 25px -5px rgba(0,0,0,0.1)`) to suggest a slight lift from the utility layer.

## Shapes
The shape language is **Soft (0.25rem)**. This provides just enough curvature to feel modern and accessible while maintaining the rigid, structured feel of a professional document tool. 
- **Buttons and Inputs:** Use a 4px radius.
- **Resume Preview:** Remains sharp (0px) to mimic actual paper.
- **Comparison Blocks:** Use a 4px radius with a clear vertical divider.

## Components
- **Sidebar Navigation:** Dark background (#0F172A). Active items use a primary orange left-accent bar (3px) and a ghost-white text color. Icons should be stroke-based and 20px.
- **Information Library Cards:** Compact. Include a `label-caps` "Last Used" timestamp in the top right. Use a light gray background (#F1F5F9) that shifts to white on hover.
- **AI Highlight Cards:** Bordered with #F59E0B at 50% opacity. Must include a "Needs Confirmation" badge—a small pill with a primary orange background and white text.
- **Comparison Blocks:** A side-by-side view. The "Original" side uses a muted gray text; the "STAR-structured" side uses standard body-md with AI-improved keywords highlighted in primary orange.
- **Packaging Mode Toggle:** When "On," the UI header turns to a subtle Warning Red tint to indicate that edits are now permanent/destructive.
- **Admin Table:** High-density. Rows at 40px height. Use `mono-label` for numerical data (quotas, IDs). Headers are `label-caps` with a subtle bottom border.
- **Drag Handles:** Six-dot pattern (⋮⋮) visible only on hover for library items and resume sections to indicate reorderability.