# Reference Adoption

## Adopted in Code

| Reference | License | Files/feature used | Changes made | Credit location |
|---|---|---|---|---|
| React Three Fiber | MIT | `src/App.tsx` `MemoryScene` | Full-screen spatial exhibition with visibility-aware render loop | `CREDITS.md` |
| Drei | MIT | `src/App.tsx` scene/navigation | CameraControls, Html spatial labels, RoundedBox artifacts, Line memory threads and Sparkles | `CREDITS.md` |
| react-postprocessing | MIT | `src/App.tsx` atmosphere | Bloom, Noise and Vignette for depth and memory atmosphere, reduced in low-power mode | `CREDITS.md` |
| Motion | MIT | `src/App.tsx` curator/reveal/timeline | Curator captions, material reveal and timeline state transitions | `CREDITS.md` |

## Visual Principles Adopted

| Reference | Observed principle | Our interpretation | Where visible |
|---|---|---|---|
| Bruno Simon Folio | Navigation can be the primary content experience rather than chrome around content | The archive is a navigable 3D world with almost no fixed app shell | full viewport scene |
| react-gallery-3d | Gallery items benefit from spatial ordering and approach-based context | Custom artifacts expose labels only when hovered/selected and recompose by curation mode | artifact field |
| r3f-scroll-rig | DOM and WebGL should feel like one continuous information layer | HTML exhibit labels and curator panels are visually anchored to the spatial experience | Html labels + DOM reveal |
| Theatre.js | Guided camera motion can carry narrative meaning | Ask the Archive and exhibit selection drive deterministic CameraControls movement | curator navigation |
| HTML in Canvas | Document materials can reveal information rather than appearing as flat cards | Selected artifacts brighten and open into a material/page-style exhibit reveal | artifact + reveal panel |

## Prototype / Comparison Log

1. **Custom R3F + Drei + postprocessing gallery live prototype** — retained because curation modes need bespoke artifact coordinates and narrative light threads.
2. **react-gallery-3d API/package comparison** — MIT; about 183 KB unpacked. Good scaffolding, but its generic gallery ownership would replace the custom time/emotion/project spatial model.
3. **r3f-scroll-rig API/package comparison** — ISC in current npm metadata; about 991 KB unpacked. Powerful for scroll-linked DOM scenes, but this museum is direct-navigation rather than long-scroll storytelling.
4. **React Three Rapier comparison** — MIT repository verified; physics would add cost without expressing memory provenance or curation state.

## Investigated but Rejected

| Reference | Reason rejected |
|---|---|
| react-gallery-3d | MIT verified; generic scene scaffolding would erase the custom curation geometry. Principles only. |
| gltfjsx | MIT verified; there are no GLTF assets in the current artifact language, so adding it would be unused. |
| r3f-scroll-rig | MIT repository LICENSE verified; current npm metadata reports ISC. Scroll synchronization is unnecessary for direct spatial navigation. |
| Theatre.js | Apache-2.0 verified; CameraControls already handles the small deterministic curator choreography without an extra timeline runtime. |
| React Three Rapier | MIT verified; no physics interaction is needed for archival meaning. |
| Lume | MIT verified; introducing a second 3D rendering abstraction would duplicate R3F. |
| HTML in Canvas | MIT verified; page-curl/material ideas were studied, but the current reveal remains independent DOM/Three implementation. |

## Investigated Candidate Set

README, current LICENSE file and demo/homepage were checked on 2026-08-23 for: `brunosimon/folio-2019`, `isoteriksoftware/react-gallery-3d`, `pmndrs/react-three-fiber`, `pmndrs/drei`, `pmndrs/gltfjsx`, `14islands/r3f-scroll-rig`, `theatre-js/theatre`, `pmndrs/react-postprocessing`, `pmndrs/react-three-rapier`, `lume/lume`, and `en-dash-consulting/html-in-canvas-dot-dev`.

## License Verification

- [x] LICENSE opened and read
- [x] Attribution requirements preserved
- [x] No unknown-license code copied
- [x] No incompatible copyleft dependency introduced
- [x] CREDITS.md updated

