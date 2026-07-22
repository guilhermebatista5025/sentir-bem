---
name: Serene Clinical Intelligence
colors:
  surface: '#edfdf9'
  surface-dim: '#cdddda'
  surface-bright: '#edfdf9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e7f7f3'
  surface-container: '#e1f1ee'
  surface-container-high: '#dbece8'
  surface-container-highest: '#d6e6e2'
  on-surface: '#101e1c'
  on-surface-variant: '#3e4947'
  inverse-surface: '#253331'
  inverse-on-surface: '#e4f4f0'
  outline: '#6e7977'
  outline-variant: '#bec9c6'
  surface-tint: '#046a62'
  primary: '#006059'
  on-primary: '#ffffff'
  primary-container: '#237a72'
  on-primary-container: '#b7fff5'
  inverse-primary: '#85d5cb'
  secondary: '#6a4fa1'
  on-secondary: '#ffffff'
  secondary-container: '#c2a4fe'
  on-secondary-container: '#503586'
  tertiary: '#006342'
  on-tertiary: '#ffffff'
  tertiary-container: '#007e56'
  on-tertiary-container: '#c4ffde'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a0f1e7'
  primary-fixed-dim: '#85d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#523787'
  tertiary-fixed: '#83f9c1'
  tertiary-fixed-dim: '#66dca6'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#edfdf9'
  on-background: '#101e1c'
  surface-variant: '#d6e6e2'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  card-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  auxiliary:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-width: 260px
  header-height: 72px
  container-gap: 32px
  card-padding: 24px
  inline-gap: 12px
  stack-gap: 20px
---

## Brand & Style

The design system is crafted to bridge the gap between clinical precision and human empathy. It serves psychologists and clinic administrators who require a high-performance workspace that doesn't sacrifice the "human touch" essential to mental health services.

The style is **Corporate / Modern** with a strong leaning toward **Soft Minimalism**. By utilizing a palette of organic teals and soft lavenders, the interface moves away from the sterile, cold aesthetics of traditional medical software. The emotional response is one of "ordered calm"—helping practitioners feel organized, capable, and grounded even during demanding clinical days. High whitespace, generous roundedness, and subtle depth create a frictionless environment for sensitive data entry and patient management.

## Colors

The color strategy uses a base of **#237A72 (Deep Teal)** to establish authority and trust, balanced by a soft background of **#F4F8F7** to reduce eye strain during long sessions. 

- **Primary:** Used for main actions, active states, and brand presence.
- **Secondary:** Used sparingly for accentuation, such as highlighting psychological assessments or specific patient insights.
- **Surface:** All interactive containers and cards use pure white to pop against the tinted background.
- **Status:** Standardized semantic colors for appointment statuses, payment alerts, and clinical notes urgency.

## Typography

This design system utilizes a dual-typeface strategy. **Plus Jakarta Sans** provides a modern, friendly geometric character for headings, ensuring the dashboard feels approachable. **Inter** is used for all functional body text and data entry to ensure maximum legibility and a systematic feel.

- Use `display-lg` for dashboard welcomes and page titles.
- Use `headline-sm` for sidebar categories and modal titles.
- All clinical notes and patient records should use `body-lg` for optimal readability.
- Use `auxiliary` for timestamps, metadata, and placeholder hints.

## Layout & Spacing

The layout is structured around a **Fixed Sidebar** and a **Fluid Main Content Area**. 

1.  **Grid:** A 12-column responsive grid is used for the main content area. On desktop, side margins are 32px; on mobile, they reduce to 16px.
2.  **Sidebar:** Persists at 260px. Navigation items use a 12px horizontal padding.
3.  **Header:** A 72px tall utility bar containing breadcrumbs and user profile, anchored to the top of the viewport.
4.  **Spacing Rhythm:** Use a base-4 system. 20px is the standard vertical rhythm between cards, while 32px is used to separate distinct logic sections within the dashboard.

## Elevation & Depth

To maintain a soft and welcoming environment, this design system avoids heavy shadows. Depth is communicated through:

- **Surface Layering:** The primary background is #F4F8F7. White cards sit on top of this, creating immediate visual separation without needing borders.
- **Ambient Shadows:** Cards and dropdowns utilize a very subtle, tinted shadow: `0px 8px 28px rgba(25, 73, 68, 0.05)`. The green tint in the shadow prevents the UI from looking "dirty" compared to neutral grey shadows.
- **Low-Contrast Outlines:** A 1px solid border (#DDE7E5) is used for input fields and card boundaries to provide definition in high-brightness environments.

## Shapes

The shape language is significantly rounded to reinforce the "welcoming" brand personality. 

- **Cards:** Strictly 18px radius to create a soft, protective feel for patient data.
- **Buttons & Chips:** 14px radius. 
- **Inputs:** 12px radius to maintain a consistent language with larger containers while appearing compact enough for data-heavy forms.
- **Active Indicators:** Vertical bar indicators on the sidebar should have a 4px right-side radius to "point" toward the content.

## Components

### Buttons
- **Primary:** Solid #237A72 with white text. 14px radius.
- **Secondary:** Solid #DDF1ED with #237A72 text. No border.
- **Ghost:** Transparent background with #6D7E7B text; shifts to #237A72 on hover.

### Cards
- Always white (#FFFFFF) with an 18px radius.
- Padding should be 24px internally.
- Use the ambient green-tinted shadow for "hover" states on clickable cards.

### Input Fields
- 1px solid #DDE7E5 border.
- Background: #FFFFFF.
- Focus state: 1px solid #237A72 with a 3px outer glow of #DDF1ED.

### Navigation (Sidebar)
- Active state: Background #DDF1ED, Text #237A72.
- A 4px thick vertical bar (#237A72) on the far left of the active nav item.

### Chips/Tags
- Status tags use a light background (10% opacity of the status color) with the solid status color for text.
- Example: Success tag is #25A675 at 10% opacity with #25A675 bold text.

### Professional Additions
- **Patient Progress Graph:** Use #237A72 for primary data lines and #8E72C7 for secondary comparison lines.
- **Calendar Events:** Use #DDF1ED for standard appointments and #EEE8F8 for specialized therapy sessions.