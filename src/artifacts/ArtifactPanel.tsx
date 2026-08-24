import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Link2, RotateCcw, Save, Shield, Trash2 } from 'lucide-react';
import { archiveApi } from '../api/client';
import { ArtifactPreview } from '../media/ArtifactPreview';
import type { Artifact, PrivacyState, Relationship } from '../schemas/archive';

type Props = {
  artifact: Artifact;
  artifacts: Artifact[];
  relationships: Relationship[];
  readOnly: boolean;
  onRefresh: () => Promise<unknown>;
  onOpenArtifact: (artifactId: string) => void;
  onDeleted: () => Promise<void> | void;
};

export function ArtifactPanel({ artifact, artifacts, relationships, readOnly, onRefresh, onOpenArtifact, onDeleted }: Props) {
  const [title, setTitle] = useState(artifact.title);
  const [phase, setPhase] = useState(artifact.project_phase);
  const [emotion, setEmotion] = useState(artifact.emotion);
  const [people, setPeople] = useState(artifact.people.join(', '));
  const [tags, setTags] = useState(artifact.tags.join(', '));
  const [description, setDescription] = useState(artifact.description);
  const [transcript, setTranscript] = useState(artifact.transcript);
  const [provenance, setProvenance] = useState(artifact.provenance);
  const [humanEdit, setHumanEdit] = useState(artifact.human_edit);
  const [privacy, setPrivacy] = useState<PrivacyState>(artifact.privacy);
  const [targetId, setTargetId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('influenced');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(artifact.title);
    setPhase(artifact.project_phase);
    setEmotion(artifact.emotion);
    setPeople(artifact.people.join(', '));
    setTags(artifact.tags.join(', '));
    setDescription(artifact.description);
    setTranscript(artifact.transcript);
    setProvenance(artifact.provenance);
    setHumanEdit(artifact.human_edit);
    setPrivacy(artifact.privacy);
    setMessage(null);
  }, [artifact]);

  const linked = useMemo(() => relationships.filter((relationship) => (
    relationship.source_artifact_id === artifact.id || relationship.target_artifact_id === artifact.id
  )), [artifact.id, relationships]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await archiveApi.updateArtifact(artifact.id, {
        title,
        project_phase: phase,
        emotion,
        people: people.split(',').map((item) => item.trim()).filter(Boolean),
        tags: tags.split(',').map((item) => item.trim()).filter(Boolean),
        description,
        transcript,
        provenance,
        human_edit: humanEdit,
        privacy,
      });
      await onRefresh();
      setMessage('Metadata saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const addRelationship = async () => {
    if (!targetId) return;
    setBusy(true);
    try {
      await archiveApi.createRelationship(artifact.archive_id, {
        source_artifact_id: artifact.id,
        target_artifact_id: targetId,
        kind: 'narrative',
        label: relationshipLabel || 'related',
        strength: 0.72,
      });
      setTargetId('');
      await onRefresh();
      setMessage('Relationship added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Relationship failed');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      await archiveApi.retryArtifact(artifact.id);
      await onRefresh();
      setMessage('Processing retry queued.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Retry failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${artifact.title}” and its stored source file?`)) return;
    setBusy(true);
    try {
      await archiveApi.deleteArtifact(artifact.id);
      await onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack artifact-panel">
      <ArtifactPreview artifact={artifact} />
      <div className="artifact-status-row">
        <span>{artifact.type}</span>
        <span>{artifact.processing_status}</span>
        <span>{artifact.file_size ? `${(artifact.file_size / 1024 / 1024).toFixed(2)} MB` : 'No binary'}</span>
      </div>

      {artifact.processing_status === 'failed' ? (
        <div className="failure-card">
          <strong>Media processing failed</strong>
          <p>{artifact.processing_error ?? 'The source is retained and can be retried.'}</p>
          {!readOnly ? <button type="button" onClick={() => void retry()}><RotateCcw size={14} /> Retry</button> : null}
        </div>
      ) : null}

      {artifact.media_url ? (
        <a className="secondary-action" href={artifact.media_url} target="_blank" rel="noreferrer">
          <Download size={14} /> Open / download original
        </a>
      ) : null}

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={readOnly} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Project phase</span>
          <input value={phase} onChange={(event) => setPhase(event.target.value)} disabled={readOnly} />
        </label>
        <label className="field">
          <span>Privacy</span>
          <select value={privacy} onChange={(event) => setPrivacy(event.target.value as PrivacyState)} disabled={readOnly}>
            <option value="private">Private</option>
            <option value="shared">Shareable</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Emotional weight · {Math.round(emotion * 100)}%</span>
        <input type="range" min="0" max="1" step="0.01" value={emotion} onChange={(event) => setEmotion(Number(event.target.value))} disabled={readOnly} />
      </label>
      <label className="field">
        <span>People</span>
        <input value={people} onChange={(event) => setPeople(event.target.value)} disabled={readOnly} placeholder="Names separated by commas" />
      </label>
      <label className="field">
        <span>Tags</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} disabled={readOnly} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={readOnly} rows={4} />
      </label>
      <label className="field">
        <span>Transcript</span>
        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} disabled={readOnly} rows={5} placeholder="Paste or edit a transcript without altering the original media." />
      </label>
      <label className="field">
        <span>Provenance / source trail</span>
        <textarea value={provenance} onChange={(event) => setProvenance(event.target.value)} disabled={readOnly} rows={3} />
      </label>

      <section className="interpretation-split">
        <div>
          <span>AI interpretation</span>
          <p>{artifact.curator_interpretation || 'No curator interpretation has been attached to this artifact.'}</p>
        </div>
        <label className="field">
          <span>Human interpretation</span>
          <textarea value={humanEdit} onChange={(event) => setHumanEdit(event.target.value)} disabled={readOnly} rows={4} placeholder="Your interpretation stays separate from AI output." />
        </label>
      </section>

      <section className="relationship-section">
        <div className="section-heading"><Link2 size={14} /><strong>Relationships</strong></div>
        {linked.length === 0 ? <p className="muted-copy">No explicit relationship has been saved yet.</p> : (
          <div className="relationship-list">
            {linked.map((relationship) => {
              const otherId = relationship.source_artifact_id === artifact.id
                ? relationship.target_artifact_id
                : relationship.source_artifact_id;
              const other = artifacts.find((candidate) => candidate.id === otherId);
              return (
                <button type="button" key={relationship.id} onClick={() => onOpenArtifact(otherId)}>
                  <span>{relationship.label || relationship.kind}</span>
                  <strong>{other?.title ?? otherId}</strong>
                  <ExternalLink size={12} />
                </button>
              );
            })}
          </div>
        )}

        {!readOnly && artifacts.length > 1 ? (
          <div className="relationship-create">
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Choose connected artifact…</option>
              {artifacts.filter((candidate) => candidate.id !== artifact.id).map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.title}</option>
              ))}
            </select>
            <input value={relationshipLabel} onChange={(event) => setRelationshipLabel(event.target.value)} aria-label="Relationship label" />
            <button type="button" onClick={() => void addRelationship()} disabled={!targetId || busy}>Connect</button>
          </div>
        ) : null}
      </section>

      <div className="privacy-note"><Shield size={15} /><span>Original source and provenance remain separate from interpretations and cannot be overwritten by the curator.</span></div>
      {message ? <div className="panel-message" role="status">{message}</div> : null}
      {!readOnly ? (
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => void save()} disabled={busy}><Save size={14} /> Save artifact</button>
          <button type="button" className="danger-action" onClick={() => void remove()} disabled={busy}><Trash2 size={14} /> Delete</button>
        </div>
      ) : null}
    </div>
  );
}

