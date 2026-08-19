---
name: Academic Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#25005a'
  on-tertiary-container: '#9863ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d2bbff'
  on-tertiary-fixed: '#25005a'
  on-tertiary-fixed-variant: '#5a00c6'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  content-readable: 720px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is built on the principle of **Soft Minimalism**, prioritizing focus and cognitive ease for academic environments. It draws from modern software excellence—combining the structural precision of high-end developer tools with the editorial elegance of premium fintech platforms.

The target audience consists of researchers, students, and academics who require a workspace that feels like a physical library: quiet, organized, and high-quality. The UI should evoke a sense of **Calm Intelligence**, utilizing deep slates and expansive whitespace to allow the user's content to take center stage. AI interactions are treated with a specialized "aura" of subtle purple, distinguishing machine-assisted work from the user's manual input without breaking the visual flow.

## Colors
This design system utilizes a sophisticated palette centered on Deep Slate for core text and structural grounding. 

- **Primary (#0F172A):** Used for headlines, primary navigation text, and deep-background icons.
- **Accent Blue (#2563EB):** Reserved for primary calls-to-action, active states, and focus indicators.
- **AI Purple (#7C3AED):** Strictly applied to AI-generated content indicators, floating AI action buttons, and sparkle icons.
- **Background Tiers:** The base layer is `#F8FAFC`, while sidebars and secondary panels use `#F1F5F9` to create subtle depth without high-contrast separation.

## Typography
The system uses **Inter** exclusively to maintain a utilitarian, highly readable, and professional feel across all roles. 

Hierarchy is established through weight and letter spacing rather than excessive size variations. Display and Large Headline styles use a slight negative letter spacing (-0.01em to -0.02em) to appear tighter and more "editorial." Body text uses a generous line height (1.5x) to ensure long-form research papers remain legible. Label styles are set in medium weight to provide clear metadata hierarchy without needing larger font sizes.

## Layout & Spacing
A strict **8pt spacing system** governs all dimensions. The layout uses a 12-column fluid grid for the main dashboard, but switches to a "Content-Focused Width" (720px) for long-form writing and document viewing to minimize eye strain and maximize focus.

- **Sidebar:** Fixed width at 260px, collapsible.
- **Margins:** 32px on desktop, scaling down to 16px on mobile.
- **Stacking:** Elements are spaced in multiples of 8 (8, 16, 24, 32, 48, 64) to maintain rhythmic consistency across all views.

## Elevation & Depth
Depth is achieved primarily through **Tonal Layering** and **Low-Contrast Outlines**. 

- **Surface Levels:** The primary workspace sits on the base neutral. Floating panels (like the Command Palette) use a pure white background with a 1px border (`#E2E8F0`).
- **Shadows:** Avoid heavy, dark shadows. Use a single, highly-diffused ambient shadow for floating elements: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`.
- **AI Layers:** Elements triggered by AI actions (floating context bars) use a 1px border tinted with 20% Purple to differentiate them from standard system panels.

## Shapes
The shape language is **Soft and Precise**. A 6px to 8px radius is the standard for almost all containers, including input fields, buttons, and cards. This provides a professional, "software-first" feel that is warmer than sharp brutalism but more serious than bubbly consumer apps.

- **Standard Elements:** 6px (rounded-md)
- **Large Containers/Cards:** 12px (rounded-lg)
- **Interactive Tags/Chips:** 4px (rounded-sm)

## Components
- **Buttons:** Primary buttons use the Accent Blue with white text. Secondary buttons use a transparent background with a 1px `#E2E8F0` border. AI-specific buttons use a subtle purple gradient (10% opacity) or a purple icon prefix.
- **Input Fields:** Minimalist design with a 1px border. Focus state uses a 2px blue ring with 20% opacity.
- **Command Palette:** Centered, floating modal with a search icon prefix. Keybindings (KBD) are styled with a subtle grey background and 4px radius.
- **Cards:** White background, 1px border, no shadow unless hovered. Hover state introduces a subtle shadow and shifts the border color to `#CBD5E1`.
- **Sidebar Items:** Clear, 14px labels with 24px icons. Active states use a soft blue background (`#EFF6FF`) and a blue vertical "indicator" on the far left.
- **Floating AI Bar:** Positioned contextually above text selections; uses a blurred background effect (16px blur) to feel modern and intelligent.