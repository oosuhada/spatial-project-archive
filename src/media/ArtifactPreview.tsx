import { useState } from 'react';
import { FileAudio, FileImage, FileText, Film, Link2, StickyNote } from 'lucide-react';
import type { Artifact } from '../schemas/archive';

function FallbackIcon({ type }: { type: Artifact['type'] }) {
  const size = 24;
  if (type === 'image') return <FileImage size={size} />;
  if (type === 'audio') return <FileAudio size={size} />;
  if (type === 'video') return <Film size={size} />;
  if (type === 'url') return <Link2 size={size} />;
  if (type === 'note') return <StickyNote size={size} />;
  return <FileText size={size} />;
}

export function ArtifactPreview({ artifact, compact = false }: { artifact: Artifact; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const canShowThumbnail = Boolean(artifact.thumbnail_url) && !failed;

  return (
    <div className={`artifact-preview ${compact ? 'compact' : ''}`}>
      {canShowThumbnail ? (
        <img
          src={artifact.thumbnail_url ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="artifact-preview-fallback" aria-hidden="true">
          <FallbackIcon type={artifact.type} />
          <span>{artifact.type}</span>
        </div>
      )}
      {artifact.processing_status !== 'ready' ? (
        <span className={`processing-badge ${artifact.processing_status}`}>{artifact.processing_status}</span>
      ) : null}
    </div>
  );
}

