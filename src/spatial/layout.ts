import type { Artifact, SortMode, SpatialPosition } from '../schemas/archive';

const phaseIndex = (phase: string): number => {
  const normalized = phase.trim().toLowerCase();
  const known = ['origin', 'discover', 'shape', 'build', 'break', 'validate', 'release', 'reflect'];
  const index = known.indexOf(normalized);
  return index === -1 ? known.length : index;
};

const dateValue = (artifact: Artifact): number => {
  const parsed = Date.parse(artifact.created_at);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function createAutomaticPositions(artifacts: Artifact[], mode: SortMode): SpatialPosition[] {
  const sorted = [...artifacts].sort((a, b) => {
    if (mode === 'emotion') return b.emotion - a.emotion || dateValue(a) - dateValue(b);
    if (mode === 'project') return phaseIndex(a.project_phase) - phaseIndex(b.project_phase) || dateValue(a) - dateValue(b);
    return dateValue(a) - dateValue(b);
  });

  return sorted.map((artifact, index) => {
    if (mode === 'emotion') {
      const angle = (index / Math.max(sorted.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 3.2 + artifact.emotion * 2.1;
      return {
        artifact_id: artifact.id,
        x: Math.cos(angle) * radius,
        y: (artifact.emotion - 0.5) * 2.6,
        z: Math.sin(angle) * radius - 1.2,
        rotation_y: -angle + Math.PI / 2,
        scale: 1,
        zone: 'Emotion orbit',
        sequence: index,
        camera_stop: true,
      };
    }

    if (mode === 'project') {
      const phase = phaseIndex(artifact.project_phase);
      const row = index % 2;
      return {
        artifact_id: artifact.id,
        x: -5 + phase * 1.8,
        y: row === 0 ? 0.75 : -0.72,
        z: -phase * 1.15 + row * 0.55,
        rotation_y: 0,
        scale: 1,
        zone: artifact.project_phase || 'Unsorted',
        sequence: index,
        camera_stop: true,
      };
    }

    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      artifact_id: artifact.id,
      x: -4.8 + column * 3.2,
      y: index % 2 === 0 ? 0.8 : -0.65,
      z: -row * 3.1 - column * 0.55,
      rotation_y: 0,
      scale: 1,
      zone: 'Timeline hall',
      sequence: index,
      camera_stop: true,
    };
  });
}

export function mergeStoredPositions(
  artifacts: Artifact[],
  stored: SpatialPosition[],
  mode: SortMode,
): SpatialPosition[] {
  const automatic = createAutomaticPositions(artifacts, mode);
  if (mode !== 'time') return automatic;
  const byId = new Map(stored.map((position) => [position.artifact_id, position]));
  return automatic.map((position) => byId.get(position.artifact_id) ?? position);
}

export function normalizeSequence(positions: SpatialPosition[]): SpatialPosition[] {
  return [...positions]
    .sort((a, b) => a.sequence - b.sequence)
    .map((position, sequence) => ({ ...position, sequence }));
}

export function clampSpatialPosition(position: SpatialPosition): SpatialPosition {
  return {
    ...position,
    x: Math.max(-7.5, Math.min(7.5, position.x)),
    y: Math.max(-2.2, Math.min(3.4, position.y)),
    z: Math.max(-12, Math.min(4.5, position.z)),
    scale: Math.max(0.55, Math.min(2.1, position.scale)),
  };
}

