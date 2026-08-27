import { useState } from 'react';
import { BrainCircuit, FileArchive, PenLine } from 'lucide-react';

const layers = {
  source: { label: 'SOURCE RECORD', icon: FileArchive, title: 'failed-navigation-prototype.pdf', body: 'Imported 2026-07-18 · SHA-256 duplicate checked · original file remains unchanged.', note: 'Source truth is preserved independently from later interpretation.' },
  human: { label: 'HUMAN MEMORY', icon: PenLine, title: 'Owner note', body: '“The spatial prototype looked strong, but people could not tell why artifacts were connected.”', note: 'Human-authored interpretation remains distinguishable from generated interpretation.' },
  ai: { label: 'AI INTERPRETATION', icon: BrainCircuit, title: 'Suggested relationship', body: 'Possible link: this prototype failure may have informed the later decision to keep search and 2D browsing first-class.', note: 'Suggestion is reviewable and does not rewrite metadata or relationships until approval.' },
} as const;

const story = [
  ['BEFORE', 'Project history was scattered across screenshots, PDFs, notes, recordings, and folders.'],
  ['PROBLEM', 'Files survived, but why they mattered—and whether a later story was human memory or AI inference—did not.'],
  ['INSIGHT', 'Preserve source truth first; treat interpretation and spatial storytelling as separate, reversible layers.'],
  ['ARCHITECTURE', 'Object storage preserves files while PostgreSQL tracks metadata, provenance, relationships, review state, and layouts.'],
  ['INTERACTION', 'Review imports and cleanup queues, connect evidence, then move between search, 2D, timeline, and optional spatial curation.'],
  ['RESULT', 'A project becomes an inspectable evidence archive rather than a decorative 3D museum or opaque AI memory.'],
];

export function PortfolioNarrative() {
  const [layer, setLayer] = useState<keyof typeof layers>('source');
  const active = layers[layer];
  const Icon = active.icon;

  return (
    <section className="archive-case" aria-labelledby="archive-case-title">
      <div className="archive-case-thesis"><span>INSPECTABLE AI SYSTEMS / 04</span><p>AI may interpret project history. It should never become indistinguishable from the source material or the owner’s own memory.</p></div>
      <div className="archive-killer">
        <div className="archive-killer-copy"><span>KILLER INTERACTION / SEPARATE THE MEMORY LAYERS</span><h2 id="archive-case-title">The same artifact can have a source record, a human memory, and an AI interpretation—without collapsing them into one truth.</h2><p>Switch layers in this synthetic artifact. The production archive stores and reviews these concerns separately.</p></div>
        <div className="memory-layer-demo">
          <nav aria-label="Artifact interpretation layer">{(Object.keys(layers) as Array<keyof typeof layers>).map((key) => <button type="button" key={key} className={layer === key ? 'active' : ''} onClick={() => setLayer(key)}>{key === 'source' ? 'SOURCE' : key === 'human' ? 'HUMAN' : 'AI'}</button>)}</nav>
          <article><Icon size={20} /><span>{active.label}</span><strong>{active.title}</strong><p>{active.body}</p><small>{active.note}</small></article>
          <footer>SYNTHETIC DEMONSTRATOR · SOURCE / HUMAN / AI STATES ARE VISUALLY AND DATA-MODEL DISTINCT</footer>
        </div>
      </div>
      <div className="archive-compare"><article><span>COMMON “AI MEMORY”</span><strong>Files → embeddings → generated story</strong><p>The generated narrative can gradually become difficult to distinguish from the underlying record.</p></article><i>VS</i><article><span>THIS ARCHIVE</span><strong>Source → provenance → human note / AI suggestion → explicit approval</strong><p>Original material remains intact while interpretation, relationships, and exhibition layout stay reversible.</p></article></div>
      <div className="archive-architecture"><div><span>ARCHITECTURE / SOURCE PRESERVATION</span><h3>Spatial presentation is a view over the archive, never the archive’s source of truth.</h3></div><div className="archive-flow">{['REAL FILE', 'OBJECT STORAGE', 'METADATA + PROVENANCE', 'HUMAN NOTE', 'AI SUGGESTION', 'REVIEW / APPROVAL', 'SEARCH · 2D · SPATIAL'].map((node, index) => <span key={node} className={index === 4 ? 'ai' : index === 5 ? 'human' : ''}>{node}</span>)}</div></div>
      <div className="archive-story">{story.map(([label, body], index) => <article key={label}><span>{String(index + 1).padStart(2, '0')} / {label}</span><p>{body}</p></article>)}</div>
    </section>
  );
}
