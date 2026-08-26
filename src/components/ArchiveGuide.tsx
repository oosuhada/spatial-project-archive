import { ArrowRight, Check, X } from 'lucide-react';

const steps = [
  { action: 'index', title: 'Check archive quality first', body: 'Archive Index shows missing provenance, failed processing, isolated artifacts, and source-backed coverage before you spend time arranging anything.' },
  { action: 'artifact', title: 'Open one artifact deeply', body: 'Source, provenance, metadata, AI interpretation, and your own interpretation remain separate. Relationships link records without rewriting the source.' },
  { action: 'search', title: 'Use normal retrieval before 3D', body: 'Search and the 2D gallery are the practical baseline. Spatial mode is optional and should help storytelling, not replace direct retrieval.' },
  { action: 'arrange', title: 'Arrange a story only when useful', body: 'The editor saves position, sequence, zone, camera stops, and lighting as a versioned exhibition without changing the underlying archive.' },
] as const;

type Action = typeof steps[number]['action'];
type Props = { step: number; onStep: (step: number) => void; onClose: () => void; onAction: (action: Action) => void };

export function ArchiveGuide({ step, onStep, onClose, onAction }: Props) {
  const complete = step >= steps.length;
  const current = steps[Math.min(step, steps.length - 1)];
  const go = (next: number) => {
    onStep(next);
    const action = steps[next]?.action;
    if (action) onAction(action);
  };
  return <aside className="archive-guide">
    <div className="archive-guide-head"><span>GUIDED SAMPLE ARCHIVE</span><button onClick={onClose} aria-label="Close guide"><X size={14} /></button></div>
    {complete ? <div className="archive-guide-done"><Check size={18} /><div><strong>You have seen the archive workflow.</strong><p>Create a private archive and import your own screenshots, PDFs, notes, audio, and links. Spatial curation can come later.</p></div></div> : <>
      <div className="archive-guide-step"><b>{step + 1}</b><span>/ {steps.length}</span></div>
      <h3>{current.title}</h3><p>{current.body}</p>
      <div className="archive-guide-actions">{step > 0 ? <button onClick={() => go(step - 1)}>Back</button> : <span />}<button className="primary" onClick={() => go(step + 1)}>{step === steps.length - 1 ? 'Finish' : 'Next'}<ArrowRight size={13} /></button></div>
    </>}
  </aside>;
}
