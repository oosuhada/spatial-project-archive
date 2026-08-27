import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Copy, Download, FileQuestion, Layers3, Link2, Network, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { ArchiveSnapshot, Artifact } from '../schemas/archive';

type Props = {
  snapshot: ArchiveSnapshot;
  onOpenArtifact: (artifactId: string) => void;
  onConnectArtifacts: (sourceId: string, targetId: string, label: string) => Promise<void>;
  onUpdateArtifact: (artifactId: string, patch: Partial<Artifact>) => Promise<void>;
};

function overlap(a: string[], b: string[]) {
  const right = new Set(b.map((item) => item.toLowerCase()));
  return a.filter((item) => right.has(item.toLowerCase())).length;
}

function normalizedStem(value: string) {
  return value.toLowerCase().replace(/\.[a-z0-9]{1,8}$/i, '').replace(/\b(copy|final|v\d+|rev\d+|draft)\b/g, '').replace(/[^a-z0-9가-힣]+/g, ' ').trim();
}

function metadataSuggestion(artifact: Artifact, artifacts: Artifact[]) {
  const text = `${artifact.title} ${artifact.original_filename ?? ''} ${artifact.source} ${artifact.description}`.toLowerCase();
  const phaseRules: Array<[RegExp, string]> = [
    [/interview|research|discovery|insight|survey|리서치|인터뷰/, 'Discovery'],
    [/wireframe|prototype|mockup|design|figma|프로토타입|디자인/, 'Prototype'],
    [/decision|adr|proposal|choice|결정|의사결정/, 'Decision'],
    [/build|implementation|code|develop|개발|구현/, 'Build'],
    [/launch|release|ship|deploy|출시|배포/, 'Release'],
  ];
  const keywordPhase = phaseRules.find(([pattern]) => pattern.test(text))?.[1];
  const nearby = [...artifacts]
    .filter((candidate) => candidate.id !== artifact.id && candidate.project_phase && candidate.project_phase !== 'Unsorted')
    .sort((a, b) => Math.abs(Date.parse(a.created_at) - Date.parse(artifact.created_at)) - Math.abs(Date.parse(b.created_at) - Date.parse(artifact.created_at)))[0];
  const phase = keywordPhase ?? nearby?.project_phase ?? artifact.project_phase;
  const tokenTags = normalizedStem(`${artifact.title} ${artifact.original_filename ?? ''}`)
    .split(' ')
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token))
    .slice(0, 4);
  const tags = [...new Set([...artifact.tags, ...tokenTags])].slice(0, 10);
  const changes: Partial<Artifact> = {};
  if ((!artifact.project_phase || artifact.project_phase === 'Unsorted') && phase && phase !== 'Unsorted') changes.project_phase = phase;
  if (artifact.tags.length === 0 && tags.length) changes.tags = tags;
  if (!Object.keys(changes).length) return null;
  return {
    artifact,
    changes,
    basis: keywordPhase ? 'Title / source keywords' : nearby ? `Chronology near “${nearby.title}”` : 'Filename tokens',
  };
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

export function ArchiveIndexPanel({ snapshot, onOpenArtifact, onConnectArtifacts, onUpdateArtifact }: Props) {
  const { artifacts, relationships } = snapshot;
  const [dismissedMetadata, setDismissedMetadata] = useState<string[]>([]);
  const [dismissedRelationships, setDismissedRelationships] = useState<string[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const connectedIds = new Set(relationships.flatMap((relationship) => [relationship.source_artifact_id, relationship.target_artifact_id]));
  const missingProvenance = artifacts.filter((artifact) => !artifact.provenance.trim());
  const unlinked = artifacts.filter((artifact) => artifacts.length > 1 && !connectedIds.has(artifact.id));
  const processingProblems = artifacts.filter((artifact) => artifact.processing_status === 'failed');
  const processingNow = artifacts.filter((artifact) => artifact.processing_status === 'pending' || artifact.processing_status === 'processing');
  const phases = [...new Set(artifacts.map((artifact) => artifact.project_phase).filter(Boolean))];
  const types = [...new Set(artifacts.map((artifact) => artifact.type))];
  const phaseCounts = [...new Map(artifacts.map((artifact) => [artifact.project_phase || 'Unsorted', 0])).keys()].map((phase) => ({
    phase,
    count: artifacts.filter((artifact) => (artifact.project_phase || 'Unsorted') === phase).length,
  })).sort((a, b) => b.count - a.count);

  const recentArtifacts = [...artifacts].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 8);
  const needsMetadataReview = artifacts.filter((artifact) => !artifact.description.trim() || !artifact.tags.length || !artifact.project_phase || artifact.project_phase === 'Unsorted');
  const provenanceCleanup = artifacts.filter((artifact) => artifact.provenance.trim().length < 24 || /^Imported from local file:/i.test(artifact.provenance.trim()));
  const metadataSuggestions = artifacts
    .map((artifact) => metadataSuggestion(artifact, artifacts))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => !dismissedMetadata.includes(item.artifact.id))
    .slice(0, 12);

  const duplicatePairs = useMemo(() => {
    const pairs: Array<{ left: Artifact; right: Artifact; reason: string }> = [];
    for (let leftIndex = 0; leftIndex < artifacts.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < artifacts.length; rightIndex += 1) {
        const left = artifacts[leftIndex];
        const right = artifacts[rightIndex];
        const leftStem = normalizedStem(left.original_filename || left.title);
        const rightStem = normalizedStem(right.original_filename || right.title);
        const sameStem = Boolean(leftStem && rightStem && leftStem === rightStem);
        const similarSize = left.file_size > 0 && right.file_size > 0 && Math.abs(left.file_size - right.file_size) / Math.max(left.file_size, right.file_size) <= 0.04;
        const sameType = left.type === right.type;
        if (sameStem || (similarSize && sameType && overlap(left.tags, right.tags) > 0)) {
          pairs.push({ left, right, reason: sameStem ? 'Same normalized filename / title' : 'Similar file size, type, and tags' });
        }
      }
    }
    return pairs.slice(0, 12);
  }, [artifacts]);

  const chronologyGroups = useMemo(() => {
    const groups = new Map<string, Artifact[]>();
    for (const artifact of [...artifacts].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
      const month = artifact.created_at.slice(0, 7);
      const key = `${month} · ${artifact.project_phase || 'Unsorted'}`;
      groups.set(key, [...(groups.get(key) ?? []), artifact]);
    }
    return [...groups.entries()].map(([label, items]) => ({ label, items })).slice(-12).reverse();
  }, [artifacts]);

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
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => !dismissedRelationships.includes(`${item.artifact.id}:${item.target.id}`))
    .slice(0, 8);

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
        <article><ShieldCheck size={15} /><span>NEEDS REVIEW</span><strong>{needsMetadataReview.length}</strong><small>{provenanceCleanup.length} need provenance cleanup · {metadataSuggestions.length} metadata suggestions</small></article>
        <article><Link2 size={15} /><span>ISOLATED</span><strong>{unlinked.length}</strong><small>{relationships.length} accepted relationships · {suggestions.length} suggestions queued</small></article>
        <article><AlertTriangle size={15} /><span>PROCESSING</span><strong>{processingProblems.length}</strong><small>{processingProblems.length} failed · {processingNow.length} pending or processing</small></article>
      </section>

      <section className="archive-ops-dashboard">
        <div className="section-heading"><div><strong>Archive operations dashboard</strong><span>Designed for the daily work of keeping a large archive searchable and trustworthy.</span></div><Layers3 size={15} /></div>
        <div className="archive-ops-grid">
          <article><span>RECENTLY ADDED</span><strong>{recentArtifacts.length}</strong><p>{recentArtifacts[0] ? `Newest: ${recentArtifacts[0].title}` : 'No artifacts yet.'}</p>{recentArtifacts.slice(0, 4).map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpenArtifact(artifact.id)}>{artifact.created_at.slice(0, 10)} · {artifact.title}</button>)}</article>
          <article><span>METADATA REVIEW</span><strong>{needsMetadataReview.length}</strong><p>Missing description, tags, or a reviewed project phase.</p>{needsMetadataReview.slice(0, 4).map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpenArtifact(artifact.id)}>{artifact.project_phase || 'Unsorted'} · {artifact.title}</button>)}</article>
          <article><span>PROVENANCE CLEANUP</span><strong>{provenanceCleanup.length}</strong><p>Short or import-generated provenance should be clarified by a human.</p>{provenanceCleanup.slice(0, 4).map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpenArtifact(artifact.id)}>{artifact.title}</button>)}</article>
          <article><span>POTENTIAL DUPLICATES</span><strong>{duplicatePairs.length}</strong><p>Exact duplicates are blocked during upload; these are near-duplicate review candidates only.</p>{duplicatePairs.slice(0, 3).map((pair) => <button key={`${pair.left.id}-${pair.right.id}`} type="button" onClick={() => onOpenArtifact(pair.left.id)}>{pair.left.title} ↔ {pair.right.title}</button>)}</article>
        </div>
      </section>

      <section className="archive-index-breakdown">
        <div><span>CONTENT TYPES</span><p>{types.length ? types.join(' · ') : 'No artifacts yet'}</p></div>
        <div><span>PROJECT PHASES</span><p>{phases.length ? phases.join(' · ') : 'No phases recorded yet'}</p></div>
      </section>

      <section className="archive-project-digest">
        <div className="section-heading"><div><strong>Project digest</strong><span>A deterministic overview derived from metadata, chronology, tags, and relationships.</span></div><div><button type="button" onClick={() => void copyDigest()}><Copy size={12} /> Copy</button><button type="button" onClick={downloadDigest}><Download size={12} /> Markdown</button></div></div>
        <div className="phase-coverage">{phaseCounts.map((item) => <div key={item.phase}><span>{item.phase}</span><i><b style={{ width: `${Math.max(8, (item.count / Math.max(1, artifacts.length)) * 100)}%` }} /></i><strong>{item.count}</strong></div>)}</div>
      </section>

      <section className="archive-metadata-review">
        <div className="section-heading"><div><strong>Metadata suggestion queue</strong><span>Deterministic suggestions are derived from filenames, title keywords, and chronology. Nothing changes until you approve it.</span></div><Sparkles size={15} /></div>
        {metadataSuggestions.length ? metadataSuggestions.map((suggestion) => <article key={suggestion.artifact.id}>
          <button className="suggestion-open" type="button" onClick={() => onOpenArtifact(suggestion.artifact.id)}><span>{suggestion.artifact.type}</span><strong>{suggestion.artifact.title}</strong><small>{suggestion.basis}</small></button>
          <div className="metadata-proposal">{suggestion.changes.project_phase ? <span>Phase → <b>{suggestion.changes.project_phase}</b></span> : null}{suggestion.changes.tags ? <span>Tags → <b>{suggestion.changes.tags.join(', ')}</b></span> : null}</div>
          <div className="review-actions"><button type="button" disabled={workingId === suggestion.artifact.id} onClick={async () => { setWorkingId(suggestion.artifact.id); try { await onUpdateArtifact(suggestion.artifact.id, suggestion.changes); } finally { setWorkingId(null); } }}><Check size={12} /> Approve</button><button type="button" onClick={() => setDismissedMetadata((current) => [...current, suggestion.artifact.id])}><X size={12} /> Dismiss</button></div>
        </article>) : <div className="archive-index-clear"><ShieldCheck size={16} /><span>No pending phase or tag suggestions under the current deterministic rules.</span></div>}
      </section>

      <section className="archive-duplicate-review">
        <div className="section-heading"><div><strong>Duplicate / near-duplicate groups</strong><span>This queue never deletes or merges source material automatically. Open both artifacts and decide what should be retained.</span></div><FileQuestion size={15} /></div>
        {duplicatePairs.length ? duplicatePairs.map((pair) => <article key={`${pair.left.id}-${pair.right.id}`}><button type="button" onClick={() => onOpenArtifact(pair.left.id)}><span>A</span><strong>{pair.left.title}</strong><small>{pair.left.original_filename ?? pair.left.source}</small></button><div><span>{pair.reason}</span><small>{pair.left.file_size && pair.right.file_size ? `${Math.round(pair.left.file_size / 1024)} KB ↔ ${Math.round(pair.right.file_size / 1024)} KB` : pair.left.type}</small></div><button type="button" onClick={() => onOpenArtifact(pair.right.id)}><span>B</span><strong>{pair.right.title}</strong><small>{pair.right.original_filename ?? pair.right.source}</small></button></article>) : <div className="archive-index-clear"><ShieldCheck size={16} /><span>No near-duplicate group was detected from normalized filenames, file size, type, and tags.</span></div>}
      </section>

      <section className="archive-chronology-groups">
        <div className="section-heading"><div><strong>Chronology / event grouping</strong><span>Artifacts are grouped by recorded month and project phase without rewriting their metadata.</span></div><CalendarDays size={15} /></div>
        <div className="chronology-groups">{chronologyGroups.length ? chronologyGroups.map((group) => <article key={group.label}><span>{group.label}</span><strong>{group.items.length} artifact{group.items.length === 1 ? '' : 's'}</strong><div>{group.items.slice(0, 5).map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpenArtifact(artifact.id)}>{artifact.title}</button>)}</div></article>) : <p>No chronology groups yet.</p>}</div>
      </section>

      <section className="archive-link-suggestions">
        <div className="section-heading"><div><strong>Relationship review queue</strong><span>Local heuristic only: shared tags, people, phase, and nearby dates. Approve or dismiss each suggestion; nothing is connected automatically.</span></div><Network size={15} /></div>
        {suggestions.length ? suggestions.map(({ artifact, target, score }) => <article key={`${artifact.id}-${target.id}`}><button className="suggestion-open" type="button" onClick={() => onOpenArtifact(artifact.id)}><span>{artifact.type}</span><strong>{artifact.title}</strong></button><div><span>→</span><strong>{target.title}</strong><small>match score {score} · heuristic ranking only</small></div><div className="review-actions"><button type="button" onClick={() => void onConnectArtifacts(artifact.id, target.id, 'Suggested from shared archive metadata')}><Link2 size={12} /> Approve</button><button type="button" onClick={() => setDismissedRelationships((current) => [...current, `${artifact.id}:${target.id}`])}><X size={12} /> Dismiss</button></div></article>) : <div className="archive-index-clear"><ShieldCheck size={16} /><span>No useful relationship suggestion is pending from current tags, people, phases, or dates.</span></div>}
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
