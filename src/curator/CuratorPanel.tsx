import { useState } from 'react';
import { ArrowRight, Quote, Sparkles } from 'lucide-react';
import { archiveApi } from '../api/client';
import { validateCuratorResponse } from '../curation/curator-citations';
import type { Artifact, CuratorResponse } from '../schemas/archive';

type Props = {
  archiveId: string;
  artifacts: Artifact[];
  selectedArtifactId: string | null;
  onOpenArtifact: (artifactId: string) => void;
};

export function CuratorPanel({ archiveId, artifacts, selectedArtifactId, onOpenArtifact }: Props) {
  const [question, setQuestion] = useState('What changed the direction of this project, and what evidence supports that interpretation?');
  const [response, setResponse] = useState<CuratorResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await archiveApi.askCurator(archiveId, question, selectedArtifactId);
      setResponse(validateCuratorResponse(result, artifacts));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Curator request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack curator-panel">
      <div className="curator-principle">
        <Sparkles size={16} />
        <p>The curator interprets imported evidence. It cannot rewrite source files, provenance, transcripts, or your human edits.</p>
      </div>
      <label className="field">
        <span>Question</span>
        <textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} />
      </label>
      <button type="button" className="primary-action" onClick={() => void ask()} disabled={busy || !question.trim()}>
        {busy ? 'Following evidence…' : 'Ask curator'}
      </button>
      {error ? <div className="panel-message error" role="alert">{error}</div> : null}

      {response ? (
        <div className="curator-response">
          <section className="curator-main-interpretation">
            <div><Quote size={14} /><span>Interpretation · {response.provider}</span></div>
            <p>{response.interpretation}</p>
          </section>

          <div className="curator-citations">
            <span>Cited artifacts</span>
            {response.cited_artifacts.map((citation) => (
              <button type="button" key={citation.artifact_id} onClick={() => onOpenArtifact(citation.artifact_id)}>
                <strong>{citation.title}</strong><ArrowRight size={13} />
              </button>
            ))}
          </div>

          <section className="curator-finding"><span>Pivotal moment</span><p>{response.pivotal_moment}</p></section>
          <section className="curator-finding"><span>Contradiction / tension</span><p>{response.contradiction}</p></section>
          <section className="curator-finding"><span>Missing context</span><p>{response.missing_context}</p></section>

          {response.suggested_route.length > 0 ? (
            <section className="curator-route">
              <span>Suggested route</span>
              <div>
                {response.suggested_route.map((artifactId, index) => {
                  const artifact = artifacts.find((candidate) => candidate.id === artifactId);
                  return (
                    <button type="button" key={artifactId} onClick={() => onOpenArtifact(artifactId)}>
                      <b>{String(index + 1).padStart(2, '0')}</b>{artifact?.title ?? artifactId}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

