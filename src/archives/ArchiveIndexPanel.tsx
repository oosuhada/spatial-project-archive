import { AlertTriangle, Copy, Download, FileQuestion, Link2, Network, ShieldCheck } from 'lucide-react';
import type { ArchiveSnapshot } from '../schemas/archive';

type Props = {
  snapshot: ArchiveSnapshot;
  onOpenArtifact: (artifactId: string) => void;
  onConnectArtifacts: (sourceId: string, targetId: string, label: string) => Promise<void>;
};

function overlap(a: string[], b: string[]) {
  const right = new Set(b.map((item) => item.toLowerCase()));
  return a.filter((item) => right.has(item.toLowerCase())).length;
}

function digestMarkdown(snapshot: ArchiveSnapshot) {
  const { artifacts, relationships } = snapshot;
  const phaseCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const artifact of artifacts) {
    phaseCounts.set(artifact.project_phase || 'Unsorted', (phaseCounts.get(artifact.project_phase || 'Unsorted') ?? 0) + 1);
    for (const tag of artifact.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const connectedIds = new Set(relationships.flatMap((item) => [item.source_artifact_id, item.target_artifact_id]));
  const chronology = [...artifacts].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return [
    `# ${snapshot.archive.title} — Project Archive Digest`,
    '',
    snapshot.archive.description || 'No archive description recorded.',
    '',
    `- Artifacts: ${artifacts.length}`,
    `- Relationships: ${relationships.length}`,
    `- Project phases: ${phaseCounts.size}`,
    `- Isolated artifacts: ${artifacts.filter((item) => artifacts.length > 1 && !connectedIds.has(item.id)).length}`,
    '',
    '## Project phases',
    ...[...phaseCounts.entries()].map(([phase, count]) => `- **${phase}** — ${count} artifact${count === 1 ? '' : 's'}`),
    '',
    '## Recurring tags',
    ...(topTags.length ? topTags.map(([tag, count]) => `- ${tag} — ${count}`) : ['- No tags recorded.']),
    '',
    '## Chronology',
    ...(chronology.length ? chronology.slice(0, 16).map((artifact) => `- ${artifact.created_at.slice(0, 10)} — **${artifact.title}** (${artifact.project_phase || 'Unsorted'})`) : ['- No artifacts yet.']),
    '',
    '> Generated deterministically from archive metadata. Source material and human notes are not rewritten.',
  ].join('\n');
}

export function ArchiveIndexPanel({ snapshot, onOpenArtifact, onConnectArtifacts }: Props) {
  const { artifacts, relationships } = snapshot;
  const connectedIds = new Set(relationships.flatMap((relationship) => [relationship.source_artifact_id, relationship.target_artifact_id]));
  const missingProvenance = artifacts.filter((artifact) => !artifact.provenance.trim());
  const unlinked = artifacts.filter((artifact) => artifacts.length > 1 && !connectedIds.has(artifact.id));
  const processingProblems = artifacts.filter((artifact) => artifact.processing_status === 'failed');
  const processingNow = artifacts.filter((artifact) => artifact.processing_status === 'pending' || artifact.processing_status === 'processing');
  const sourceBacked = artifacts.filter((artifact) => Boolean(artifact.file_hash || artifact.source.trim() || artifact.original_filename));
  const phases = [...new Set(artifacts.map((artifact) => artifact.project_phase).filter(Boolean))];
  const types = [...new Set(artifacts.map((artifact) => artifact.type))];
  const phaseCounts = [...new Map(artifacts.map((artifact) => [artifact.project_phase || 'Unsorted', 0])).keys()].map((phase) => ({
    phase,
    count: artifacts.filter((artifact) => (artifact.project_phase || 'Unsorted') === phase).length,
  })).sort((a, b) => b.count - a.count);

  const existingPairs = new Set(relationships.flatMap((relationship) => [
    `${relationship.source_artifact_id}:${relationship.target_artifact_id}`,
    `${relationship.target_artifact_id}:${relationship.source_artifact_id}`,
  ]));
  const suggestions = unlinked.map((artifact) => {
    const candidates = artifacts.filter((candidate) => candidate.id !== artifact.id && !existingPairs.has(`${artifact.id}:${candidate.id}`)).map((candidate) => {
      const tagScore = overlap(artifact.tags, candidate.tags) * 3;
      const peopleScore = overlap(artifact.people, candidate.people) * 2;
      const phaseScore = artifact.project_phase && artifact.project_phase === candidate.project_phase ? 2 : 0;
      const timeDays = Math.abs(Date.parse(artifact.created_at) - Date.parse(candidate.created_at)) / 86_400_000;
      const timeScore = Number.isFinite(timeDays) && timeDays <= 30 ? 1 : 0;
      return { candidate, score: tagScore + peopleScore + phaseScore + timeScore };
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return best && best.score > 0 ? { artifact, target: best.candidate, score: best.score } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 8);

  const digest = digestMarkdown(snapshot);
  const copyDigest = async () => navigator.clipboard.writeText(digest);
  const downloadDigest = () => {
    const blob = new Blob([digest], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${snapshot.archive.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'archive'}-digest.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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

      <section className="archive-project-digest">
        <div className="section-heading"><div><strong>Project digest</strong><span>A deterministic overview derived from metadata, chronology, tags, and relationships.</span></div><div><button type="button" onClick={() => void copyDigest()}><Copy size={12} /> Copy</button><button type="button" onClick={downloadDigest}><Download size={12} /> Markdown</button></div></div>
        <div className="phase-coverage">{phaseCounts.map((item) => <div key={item.phase}><span>{item.phase}</span><i><b style={{ width: `${Math.max(8, (item.count / Math.max(1, artifacts.length)) * 100)}%` }} /></i><strong>{item.count}</strong></div>)}</div>
      </section>

      <section className="archive-link-suggestions">
        <div className="section-heading"><div><strong>Suggested relationships</strong><span>Local heuristic only: shared tags, people, phase, and nearby dates. Nothing is connected automatically.</span></div><Network size={15} /></div>
        {suggestions.length ? suggestions.map(({ artifact, target, score }) => <article key={`${artifact.id}-${target.id}`}><button className="suggestion-open" type="button" onClick={() => onOpenArtifact(artifact.id)}><span>{artifact.type}</span><strong>{artifact.title}</strong></button><div><span>→</span><strong>{target.title}</strong><small>match score {score}</small></div><button type="button" onClick={() => void onConnectArtifacts(artifact.id, target.id, 'Suggested from shared archive metadata')}><Link2 size={12} /> Connect</button></article>) : <div className="archive-index-clear"><ShieldCheck size={16} /><span>No useful relationship suggestion was found from current tags, people, phases, or dates.</span></div>}
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
