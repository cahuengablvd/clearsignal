# Product Showcase Design QA

- Source visual truth: `C:\Users\CAHUENGABLVD\Downloads\779a380b848959605dddf40aa8ea085d_720w.mp4`
- Supporting source screen: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-15 154049.png`
- Implementation screenshot: `C:\Claude Code\ClearSignal\.codex-carousel-act.png`
- Combined comparison: `C:\Claude Code\ClearSignal\.codex-carousel-comparison.png`
- Viewports checked: desktop plus 320px, 375px, 390px, and 430px mobile widths
- States checked: Measure, Explain, Act, previous/next, progress controls, keyboard navigation, autoplay, autoplay cancellation, and mobile accordion

## Full-View Comparison Evidence

The implementation preserves the reference's central active-card emphasis, partially visible side cards, depth through scale and opacity, restrained motion, and a dark stage around a light focal card. The ClearSignal information architecture remains product-specific rather than copying the reference content.

## Focused Region Comparison Evidence

The carousel region was checked separately in all three stages. The active card remains fixed in size, side previews remain visible, controls do not shift, and the Act state keeps the prioritized actions legible without nested card clutter.

## Findings

No actionable P0, P1, or P2 differences remain.

- Typography: hierarchy and line lengths remain readable in all three desktop states; mobile copy retains the existing landing-page type scale.
- Spacing and layout: the active card is stable, side cards create depth without causing horizontal overflow, and the mobile accordion stays compact.
- Colors and tokens: warm ivory, espresso, copper accents, borders, and shadows match the existing ClearSignal visual system.
- Image and asset fidelity: no new raster or decorative asset was required; existing Lucide and product logo components remain consistent with the page.
- Copy and content: Measure, Explain, and Act use the requested product-specific metrics, evidence, and actions.
- Accessibility and interaction: controls are buttons, progress exposes `aria-current`, keyboard arrows work, focus rings are visible, reduced motion is respected, and mobile summaries exceed the 44px tap-target minimum.
- Console: no application-origin errors were observed. Chrome wallet-extension errors were present and are unrelated to ClearSignal.

## Comparison History

1. Initial pass found that the right inactive card's preview copy was hidden behind the active card. The inactive copy was aligned toward its exposed outer edge.
2. Interaction testing initially appeared broken because a stale local Next.js server was serving non-hydrated client chunks. The server was restarted, then click, keyboard, autoplay, and cancellation behavior passed.
3. Post-fix desktop and mobile captures showed no remaining P0/P1/P2 issues.

## Implementation Checklist

- [x] Premium sequential desktop carousel
- [x] Fixed-height Measure / Explain / Act states
- [x] Side-card depth and previews
- [x] Click, hover preview, arrows, progress, and keyboard navigation
- [x] One-pass autoplay ending on Act
- [x] Autoplay cancellation after user interaction
- [x] Reduced-motion fallback
- [x] Compact mobile accordion with Act open by default
- [x] No horizontal overflow at requested mobile widths

final result: passed

## Product Showcase Correction Pass (2026-07-16)

- Desktop references: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-16 125157.png`, `125217.png`, and `125232.png`
- Mobile references: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-16 125401.png`, `125414.png`, and `125425.png`
- Desktop implementations: `C:\Claude Code\ClearSignal\.codex-qa\desktop-measure.png`, `desktop-explain.png`, and `desktop-act.png`
- Mobile implementations: `C:\Claude Code\ClearSignal\.codex-qa\mobile-measure.png`, `mobile-explain.png`, and `mobile-act.png`
- Combined comparisons: `C:\Claude Code\ClearSignal\.codex-qa\desktop-comparison.png` and `mobile-comparison.png`

### Result

- Measure and Act no longer contain bright ivory modules; all three desktop slides use one cohesive espresso/brown interface.
- Desktop type, status rows, comparison lists, and action copy are legible at normal browser scale.
- Explain uses a larger two-column comparison with a central directional divider.
- The long progress lines were replaced by compact step controls; 48px previous/next controls sit outside the active content.
- Neighbouring slides remain recognisable with no blur and approximately 180px exposed at standard desktop widths.
- Mobile open headers and bodies use visibly different brown tones, a divider, and a continuous copper edge without ivory surfaces.
- Act uses arrow-led action rows with no nested 01/02/03 sequence.
- Exactly one mobile item remains open; Act is the default state.
- Mobile widths 320px, 375px, 390px, and 430px have no horizontal overflow. Header tap targets measure 76px or more.
- Desktop was visually checked at 1440px and 1920px.

This section supersedes the previous Product Showcase and Mobile Accordion visual treatments.

final result: passed

## Dark Product Story Redesign

- Desktop source: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-15 154049.png`
- Desktop implementation: `C:\Claude Code\ClearSignal\.codex-product-dark-desktop.png`
- Desktop comparison: `C:\Claude Code\ClearSignal\.codex-product-dark-desktop-comparison.png`
- Mobile source: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-15 154410.png`
- Mobile implementation: `C:\Claude Code\ClearSignal\.codex-product-dark-mobile-act.png`
- Mobile comparison: `C:\Claude Code\ClearSignal\.codex-product-dark-mobile-comparison.png`

### Result

- The desktop showcase now uses a fixed-height dark glass carousel instead of a flat white modal.
- Measure, Explain, and Act use distinct dashboard, signal-path, and priority-roadmap compositions.
- Previous and next slides expose approximately 148px on each side at 1440px and remain recognisable without heavy blur.
- The progress rail, side-preview controls, keyboard arrows, Home/End, one-pass autoplay, and reduced-motion fallback are present.
- The mobile accordion uses one continuous espresso surface with a copper active edge; no ivory inset panels remain.
- Act opens by default, only one item can be open, and each full header is a minimum 76px tap target.
- Mobile open states stay compact and preserve the requested score, engine, comparison, and action details.
- No horizontal overflow was found at 320px, 375px, 390px, 430px, 1024px, 1440px, or 1920px.

This section supersedes the earlier mobile accordion open-state treatment documented above.

final result: passed

## Mobile Audience Selector Refinement

- Source screen: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-15 154300.png`
- Implementation capture: `C:\Claude Code\ClearSignal\.codex-audience-mobile-390.png`
- Combined comparison: `C:\Claude Code\ClearSignal\.codex-audience-comparison.png`
- Responsive checks: 320px, 375px, 390px, and 430px

### Result

- Mobile order is heading, selector, dynamic preview, dynamic explanation, and CTA.
- Selector-to-preview spacing is 24px, preview-to-explanation spacing is 16px, and explanation-to-CTA spacing is 24px.
- Service businesses remains selected by default.
- All three segments update the preview and explanation after one tap.
- Preview height remains identical across Service businesses, Agencies, and SaaS & B2B teams.
- The preview and explanation use the same 200ms opacity and 7px vertical transition.
- No horizontal overflow was found at any requested mobile width.
- Desktop retains its prior two-column layout, copy position, and CTA position.

final result: passed

## Mobile Accordion Open-State Refinement

- Reference states: `C:\Users\CAHUENGABLVD\Downloads\Screenshot 2026-07-15 154350.png`, `154500.png`, `154448.png`, and `154410.png`
- Implementation capture: `C:\Claude Code\ClearSignal\.codex-mobile-accordion-act.png`
- Open-state behavior checked at 390px and structurally verified for the existing 320px, 375px, 390px, and 430px breakpoints
- Only one native `details` item remains open at a time; Act remains the default state

### Result

- Closed headers retain the prior compact dark treatment.
- Active headers use a restrained copper edge and slightly lighter espresso surface.
- Expanded content is isolated in a warm sand inset panel with dark text, 15px radius, and 14px padding.
- Where is approximately 180px tall, Why approximately 171px, and Act approximately 146px after compaction.
- Act no longer repeats 01 / 02 / 03 inside the expanded content; the three actions use compact rows, copper arrows, and thin dividers.
- Where keeps all three requested metrics and engine rows; Why keeps both comparison groups without nested cards.
- No horizontal overflow or nested-card clutter was introduced.

final result: passed

## Carousel Depth and Mobile Inset Hierarchy (2026-07-16)

- Previous implementation captures: `C:\Claude Code\ClearSignal\.codex-qa\desktop-measure.png`, `mobile-measure.png`, `mobile-explain.png`, and `mobile-act.png`
- Updated implementation captures: `C:\Claude Code\ClearSignal\.codex-depth-qa\desktop-measure.png`, `mobile-measure.png`, `mobile-explain.png`, and `mobile-act.png`
- Combined comparison: `C:\Claude Code\ClearSignal\.codex-depth-qa\comparison.png`

### Result

- Desktop side slides use a 1600px perspective stage, 130px negative depth, 6-degree inward rotation, and 0.94 scale.
- At 1440px, approximately 218-219px of each neighbouring slide remains exposed; the same composition remains unclipped at 1920px.
- Side slides retain recognisable headings with 0.58 opacity, 0.65px blur, a warm inner edge, and a restrained outer-edge overlay.
- A single integrated two-source copper/amber ambient glow moves subtly with the active stage.
- The active slide remains front-facing at full opacity with the strongest border and shadow.
- Mobile Measure now uses three compact Engine Status-style inset rows with icons, statuses, and one-time progress lines.
- Mobile Explain uses two grouped inset modules; Mobile Act uses three inset action rows without internal numbering.
- Expanded surfaces remain lighter than the active headers and do not reintroduce ivory or white panels.
- Exactly one accordion step remains open at a time, with Act open by default.
- No horizontal overflow was found at 320px, 375px, 390px, or 430px; desktop was checked at 1440px and 1920px.

final result: passed
