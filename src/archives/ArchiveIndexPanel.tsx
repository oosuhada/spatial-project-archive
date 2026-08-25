import { AlertTriangle, FileQuestion, Link2, ShieldCheck } from 'lucide-react';
import type { ArchiveSnapshot } from '../schemas/archive';

type Props = {
  snapshot: ArchiveSnapshot;
  onOpenArtifact: (artifactId: string) => void;
};

export function ArchiveIndexPanel({ snapshot, onOpenArtifact }: Props) {
  const { artifacts, relationships } = snapshot;
  const connectedIds = new Set(relationships.flatMap((relationship) => [relationship.source_artifact_id, relationship.target_artifact_id]));
  const missingProvenance = artifacts.filter((artifact) => !artifact.provenance.trim());
  const unlinked = artifacts.filter((artifact) => artifacts.length > 1 && !connectedIds.has(artifact.id));
  const processingProblems = artifacts.filter((artifact) => artifact.processing_status === 'failed');
  const processingNow = artifacts.filter((artifact) => artifact.processing_status === 'pending' || artifact.processing_status === 'processing');
  const sourceBacked = artifacts.filter((artifact) => Boolean(artifact.file_hash || artifact.source.trim() || artifact.original_filename));
  const phases = [...new Set(artifacts.map((artifact) => artifact.project_phase).filter(Boolean))];
  const types = [...new Set(artifacts.map((artifact) => artifact.type))];

  const attention = [
    ...processingProblems.map((artifact) => ({ artifact, reason: 'Processing failed' })),
    ...missingProvenance.map((artifact) => ({ artifact, reason: 'Missing provenance note' })),
    ...unlinked.map((artifact) => ({ artifact, reason: 'No relationship links' })),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.artifact.id === item.artifact.id && candidate.reason === item.reason) === index);

  return (
    <div className="panel-stack archive-index-panel">
      <section className="archive-index-intro">
        <span>ARCHIVE INDEX / SOURCE QUALITY</span>
        <h3>{snapshot.archive.title}</h3>
        <p>This view summarizes what is actually stored and where the archive still has gaps. It does not score the meaning or quality of your memories.</p>
      </section>

      <section className="archive-index-metrics">
        <article><FileQuestion size={15} /><span>ARTIFACTS</span><strong>{artifacts.length}</strong><small>{types.length} file / note types · {phases.length} project phases</small></article>
        <article><ShieldCheck size={15} /><span>SOURCE-BACKED</span><strong>{sourceBacked.length}/{artifacts.length}</strong><small>{missingProvenance.length} missing provenance description</small></article>
        <article><Link2 size={15} /><span>RELATIONSHIPS</span><strong>{relationships.length}</strong><small>{unlinked.length} artifact{unlinked.length === 1 ? '' : 's'} currently isolated</small></article>
        <article><AlertTriangle size={15} /><span>PROCESSING</span><strong>{processingProblems.length}</strong><small>{processingProblems.length} failed · {processingNow.length} pending or processing</small></article>
      </section>

      <section className="archive-index-breakdown">
        <div><span>CONTENT TYPES</span><p>{types.length ? types.join(' · ') : 'No artifacts yet'}</p></div>
        <div><span>PROJECT PHASES</span><p>{phases.length ? phases.join(' · ') : 'No phases recorded yet'}</p></div>
      </section>

      <section className="archive-attention-list">
        <div className="section-heading"><strong>Needs attention</strong><span>{attention.length ? 'Open an artifact to fix its metadata or processing state.' : 'No obvious structural gaps detected.'}</span></div>
        {attention.length ? attention.slice(0, 12).map(({ artifact, reason }) => (
          <button type="button" key={`${artifact.id}-${reason}`} onClick={() => onOpenArtifact(artifact.id)}>
            <span>{artifact.type}</span><div><strong>{artifact.title}</strong><small>{reason} · {artifact.project_phase || 'No phase'}</small></div><b>OPEN</b>
          </button>
        )) : <div className="archive-index-clear"><ShieldCheck size={16} /><span>Every artifact has a source trail, processing is healthy, and the archive has no isolated item under the current checks.</span></div>}
      </section>
    </div>
  );
}
