import { ChevronLeft, ChevronRight, Play, Square } from 'lucide-react';
import type { Artifact, SpatialPosition } from '../schemas/archive';

type Props = {
  artifacts: Artifact[];
  positions: SpatialPosition[];
  selectedId: string | null;
  tourActive: boolean;
  onSelect: (artifactId: string) => void;
  onStep: (direction: -1 | 1) => void;
  onToggleTour: () => void;
};

export function Timeline({ artifacts, positions, selectedId, tourActive, onSelect, onStep, onToggleTour }: Props) {
  const ordered = [...artifacts].sort((a, b) => {
    const positionA = positions.find((position) => position.artifact_id === a.id)?.sequence ?? Number.MAX_SAFE_INTEGER;
    const positionB = positions.find((position) => position.artifact_id === b.id)?.sequence ?? Number.MAX_SAFE_INTEGER;
    return positionA - positionB || Date.parse(a.created_at) - Date.parse(b.created_at);
  });
  const index = Math.max(0, ordered.findIndex((artifact) => artifact.id === selectedId));

  if (artifacts.length === 0) return null;

  return (
    <footer className="archive-timeline" aria-label="Archive story timeline">
      <button type="button" onClick={() => onStep(-1)} disabled={index <= 0} aria-label="Previous artifact"><ChevronLeft size={17} /></button>
      <div className="timeline-core">
        <div className="timeline-caption"><span>STORY SEQUENCE</span><strong>{selectedId ? ordered[index]?.title : `${ordered.length} artifacts`}</strong></div>
        <div className="timeline-track">
          {ordered.map((artifact) => (
            <button type="button" key={artifact.id} className={artifact.id === selectedId ? 'active' : ''} onClick={() => onSelect(artifact.id)} aria-label={`Open ${artifact.title}`}>
              <i /><span>{artifact.project_phase}</span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => onStep(1)} disabled={index >= ordered.length - 1} aria-label="Next artifact"><ChevronRight size={17} /></button>
      <button type="button" className={`tour-button ${tourActive ? 'active' : ''}`} onClick={onToggleTour} aria-label={tourActive ? 'Stop guided tour' : 'Start guided tour'}>
        {tourActive ? <Square size={13} /> : <Play size={13} />}
      </button>
    </footer>
  );
}

