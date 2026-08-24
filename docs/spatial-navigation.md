# Spatial Navigation Model

The archive supports multiple equivalent navigation paths so spatial movement is never mandatory.

## Navigation inventory

### Free explore

- `CameraControls` provides orbit, truck and dolly interaction.
- Camera distance is bounded and the target is constrained to the authored room `Box3`.
- The floor grid and focal lights provide depth and room-boundary cues.
- Selecting an artifact moves the camera to a deterministic viewing distance without clearing selection.

### Artifact jump

- Clicking a 3D object or 2D card selects an artifact.
- Search results and curator citations open the same artifact detail.
- Owner routes use `/archives/:archiveId?artifact=:artifactId`; refresh restores the selected artifact and opens its detail.

### Guided tour

- Timeline sequence comes from saved `spatial_positions.sequence` where present.
- A saved `camera_stop=false` removes an artifact from authored tour stops without removing it from the archive.
- Start/stop tour remains explicit; no autonomous camera movement starts on page load.

### Timeline journey

- Left/Right controls step through the story sequence.
- When no drawer is open, keyboard Left/Right performs the same action.
- The selected artifact remains visible in the timeline and spatial scene.

### Skip spatial mode

- The 2D gallery is a first-class representation of the same artifacts, relationships, search targets and curator citations.
- Mobile defaults to 2D.
- Desktop can switch between Spatial and 2D at any time when WebGL is available.
- WebGL context loss automatically switches to 2D and preserves loaded archive state.

## Collision and camera safety

The current navigation deliberately uses bounded camera targets and a minimum camera distance rather than physics. Artifacts are positioned inside a clamped room budget (`x -7.5…7.5`, `y -2.2…3.4`, `z -12…4.5`), and the camera cannot freely target outside the larger room boundary. This prevents the common prototype failure where the user disappears behind the exhibition or crosses through the floor.

For future dense room layouts, a camera collision raycast against room and artifact bounding boxes can be added without changing the archive model.

## Motion sensitivity

- `prefers-reduced-motion` reduces camera smoothing and ambient movement.
- CSS transitions/animations are effectively disabled under the media query.
- Guided tour is opt-in and remains stoppable.
- 2D is always one click away and is the default on mobile.
- No critical information requires parallax, motion, hover or depth perception.

