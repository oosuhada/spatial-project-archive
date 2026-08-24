# Accessibility and Motion Model

The atmospheric identity is preserved without making spatial navigation a prerequisite.

## Phase 0 audit findings

The prototype had four accessibility risks: overlapping desktop panels, simultaneous mobile overlays/timeline, low object contrast, and small/discoverability-poor navigation instructions. Motion-heavy camera travel was also the only obvious way to understand the archive.

## Implemented interaction rules

### One primary overlay

The application has one `Overlay` state. Artifact, Import, Search, Curator, Exhibition Editor, Share, Navigation help and Create Archive are mutually exclusive. This prevents exhibit and curator panels from occupying the same desktop region.

On screens up to 760 px, that primary overlay becomes a full-screen sheet. The timeline is hidden while the sheet is open, body overscroll is contained, safe-area padding is applied, and primary controls use a minimum 44 px hit area.

### Focus management

`PrimaryDrawer` uses `useFocusTrap` to:

- move focus into the opened dialog;
- keep Tab/Shift+Tab inside it;
- close with Escape;
- restore focus to the element that opened the drawer.

All keyboard-focusable controls receive a visible warm outline.

### Non-spatial parity

The 2D gallery exposes the same evidence objects. Search, metadata editing, relationships, curator citations and source downloads do not depend on WebGL. Mobile starts in 2D and WebGL context loss falls back to it.

### Motion

The browser's `prefers-reduced-motion` setting is read by Motion and CSS. Reduced mode minimizes `CameraControls` smoothing, disables ambient Sparkles movement, and removes CSS animation/transition duration. Guided tour never auto-starts.

### Visual readability

- 3D artifact surfaces use higher base luminance and type-specific accent color.
- Each artifact receives a readable HTML title/type/date label rather than relying on geometry alone.
- Selected objects receive a larger emissive backing outline.
- Floor grid, hemisphere light, warm/cool focal lights and reduced fog ambiguity improve depth cues.
- Text remains neutral/warm with contrast differences expressed through luminance as well as hue.

## Keyboard inventory

| Key | Context | Behavior |
| --- | --- | --- |
| Tab / Shift+Tab | Drawer/sheet | Cycles within the primary overlay |
| Escape | Drawer/sheet | Closes the current primary overlay |
| Left Arrow | Scene/gallery without overlay | Previous story artifact |
| Right Arrow | Scene/gallery without overlay | Next story artifact |

## Remaining pre-public-deployment audit

The local production workspace is not being externally deployed in this milestone. Before an internet-facing release, run screen-reader passes in VoiceOver/NVDA, automated WCAG contrast scanning against final calibrated displays, and switch/keyboard-only testing across the complete owner authentication flow.

