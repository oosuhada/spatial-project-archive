import { ArrowRight, CircleDashed } from 'lucide-react';
import { artifactAccent, artifactDateLabel } from '../artifacts/artifact-visual';
import { ArtifactPreview } from '../media/ArtifactPreview';
import type { Artifact, Relationship } from '../schemas/archive';

type Props = {
  artifacts: Artifact[];
  relationships: Relationship[];
  selectedId: string | null;
  onSelect: (artifact: Artifact) => void;
};

export function Gallery2D({ artifacts, relationships, selectedId, onSelect }: Props) {
  if (artifacts.length === 0) {
    return (
      <section className="gallery-empty" aria-label="Empty archive">
        <CircleDashed size={28} />
        <h2>No artifacts in this archive yet.</h2>
        <p>Import an image, PDF, note, or audio file to begin the story.</p>
      </section>
    );
  }

  return (
    <section className="gallery-2d" aria-label="2D archive gallery">
      <div className="gallery-2d-track">
        {artifacts.map((artifact, index) => {
          const accent = artifactAccent(artifact);
          const outgoing = relationships.filter((relationship) => relationship.source_artifact_id === artifact.id).length;
          return (
            <button
              type="button"
              key={artifact.id}
              className={`gallery-2d-card ${selectedId === artifact.id ? 'active' : ''}`}
              style={{ '--artifact-accent': accent } as React.CSSProperties}
              onClick={() => onSelect(artifact)}
            >
              <div className="gallery-card-index">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{artifactDateLabel(artifact)}</span>
              </div>
              <ArtifactPreview artifact={artifact} />
              <div className="gallery-card-copy">
                <span>{artifact.type} · {artifact.project_phase}</span>
                <h3>{artifact.title}</h3>
                <p>{artifact.description || artifact.provenance || 'No interpretation has been added yet.'}</p>
              </div>
              <div className="gallery-card-foot">
                <span>{outgoing} relationship{outgoing === 1 ? '' : 's'}</span>
                <ArrowRight size={14} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

