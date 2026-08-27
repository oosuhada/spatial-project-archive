import { useMemo, useState } from 'react';
import { BrainCircuit, Database, FileArchive, HardDrive, PenLine, Search, UserCheck } from 'lucide-react';
import type { Artifact } from '../schemas/archive';

const story = [
  ['BEFORE', 'Project history was scattered across screenshots, PDFs, notes, recordings, and folders.'],
  ['PROBLEM', 'Files survived, but why they mattered—and whether a later story was human memory or AI inference—did not.'],
  ['INSIGHT', 'Preserve source truth first; treat interpretation and spatial storytelling as separate, reversible layers.'],
  ['ARCHITECTURE', 'Object storage preserves files while PostgreSQL tracks metadata, provenance, relationships, review state, and layouts.'],
  ['INTERACTION', 'Review imports and cleanup queues, connect evidence, then move between search, 2D, timeline, and optional spatial curation.'],
  ['RESULT', 'A project becomes an inspectable evidence archive rather than a decorative 3D museum or opaque AI memory.'],
];

const series = [
  ['01', 'Research', 'https://signals.oosu.dev/'],
  ['02', 'Decisions', 'https://scenario.oosu.dev/'],
  ['03', 'Generative UI', 'https://decision.oosu.dev/'],
  ['04', 'Memory', 'https://memory.oosu.dev/'],
] as const;

type LayerKey = 'source' | 'human' | 'ai';

export function PortfolioNarrative({ artifact }: { artifact?: Artifact | null }) {
  const [layer, setLayer] = useState<LayerKey>('source');
  const layers = useMemo(() => ({
    source: {
      label: 'SOURCE RECORD', icon: FileArchive,
      title: artifact?.original_filename || artifact?.title || 'No persisted artifact selected',
      body: artifact ? `${artifact.source || 'Unknown source'} · ${artifact.provenance || 'Provenance needs cleanup.'}` : 'Create the guided archive or import a file to inspect a real persisted source record here.',
      note: artifact ? `${artifact.file_hash ? `SHA-256 ${artifact.file_hash.slice(0, 16)}…` : 'Manual / URL artifact'} · ${artifact.processing_status} · original material remains separately addressable.` : 'Fallback explanation only.',
    },
    human: {
      label: 'HUMAN MEMORY', icon: PenLine,
      title: artifact?.title ? `${artifact.title} · owner layer` : 'Human-authored layer',
      body: artifact?.human_edit || artifact?.description || 'No human interpretation has been recorded for this artifact yet.',
      note: artifact ? 'Read from the persisted artifact human_edit/description fields; this is not generated curator text.' : 'Human-authored interpretation is stored separately from source and curator output.',
    },
    ai: {
      label: 'AI INTERPRETATION', icon: BrainCircuit,
      title: artifact?.title ? `${artifact.title} · curator layer` : 'Curator interpretation',
      body: artifact?.curator_interpretation || 'No curator interpretation is persisted for this artifact. The absence stays visible instead of being filled with invented history.',
      note: artifact ? 'Read from the persisted curator_interpretation field; generated interpretation cannot overwrite the source or human note.' : 'AI interpretation requires valid artifact citations before display.',
    },
  }), [artifact]);
  const active = layers[layer];
  const Icon = active.icon;

  return (
    <section className="archive-case" aria-labelledby="archive-case-title">
      <div className="archive-case-thesis"><span>INSPECTABLE AI SYSTEMS / 04</span><p>AI may interpret project history. It should never become indistinguishable from the source material or the owner’s own memory.</p></div>
      <div className="archive-killer">
        <div className="archive-killer-copy"><span>KILLER INTERACTION / INSPECT THE REAL MEMORY LAYERS</span><h2 id="archive-case-title">One persisted artifact. Three explicitly different truths.</h2><p>{artifact ? `This interaction is bound to “${artifact.title}” from the currently loaded archive.` : 'No archive artifact is loaded yet; this state explains the same separation enforced by the data model.'}</p></div>
        <div className="memory-layer-demo" data-proof={artifact ? 'persisted-artifact' : 'fallback'}>
          <nav aria-label="Artifact interpretation layer">{(Object.keys(layers) as LayerKey[]).map((key) => <button type="button" key={key} className={layer === key ? 'active' : ''} onClick={() => setLayer(key)}>{key === 'source' ? 'SOURCE' : key === 'human' ? 'HUMAN' : 'AI'}</button>)}</nav>
          <article><Icon size={20} /><span>{active.label}</span><strong>{active.title}</strong><p>{active.body}</p><small>{active.note}</small></article>
          <footer>{artifact ? `PERSISTED ARTIFACT · ${artifact.id.slice(0, 8)} · SOURCE / HUMAN / AI FIELDS ARE DISTINCT` : 'NO PERSISTED ARTIFACT YET'}</footer>
        </div>
      </div>

      <details className="archive-engineering-case">
        <summary><span>ENGINEERING CASE STUDY</span><b>Source preservation → interpretation → spatial view</b></summary>
        <div>
          <div className="archive-compare"><article><span>COMMON “AI MEMORY”</span><strong>Files → embeddings → generated story</strong><p>The generated narrative can gradually become difficult to distinguish from the underlying record.</p></article><i>VS</i><article><span>THIS ARCHIVE</span><strong>Source → provenance → human note / AI suggestion → explicit approval</strong><p>Original material remains intact while interpretation, relationships, and exhibition layout stay reversible.</p></article></div>
          <div className="archive-system-map"><header><span>ARCHITECTURE / REAL SOURCE-OF-TRUTH FLOW</span><h3>3D is the last representation layer—not the database and not the memory.</h3></header><div>
            <article><HardDrive size={15} /><span>INGESTION</span><b>Real files + URLs</b><small>hashing · duplicate handling · preview processing</small></article><i>→</i>
            <article><FileArchive size={15} /><span>BINARY SOURCE</span><b>MinIO object storage</b><small>original media and derivatives stay independently addressable</small></article><i>→</i>
            <article><Database size={15} /><span>ARCHIVE DOMAIN</span><b>PostgreSQL metadata</b><small>provenance · notes · relationships · privacy · layouts</small></article>
            <article className="wide"><BrainCircuit size={15} /><span>INTERPRETATION BOUNDARY</span><b>Curator + suggestions</b><small>citation validation · no automatic source rewrite · approve/dismiss queues</small></article>
            <article className="wide human"><UserCheck size={15} /><span>HUMAN CONTROL</span><b>Review + cleanup</b><small>metadata · provenance · relationship approval remains explicit</small></article>
            <article className="wide view"><Search size={15} /><span>REPRESENTATIONS</span><b>Search · 2D · timeline · spatial</b><small>multiple views over one persisted archive; 3D is optional</small></article>
          </div></div>
          <div className="archive-story">{story.map(([label, body], index) => <article key={label}><span>{String(index + 1).padStart(2, '0')} / {label}</span><p>{body}</p></article>)}</div>
          <nav className="archive-series-nav" aria-label="Inspectable AI Systems series">{series.map(([index, label, href]) => <a key={index} className={index === '04' ? 'active' : ''} href={href}><span>{index}</span><b>{label}</b></a>)}</nav>
        </div>
      </details>
    </section>
  );
}
