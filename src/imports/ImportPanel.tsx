import { useMemo, useState } from 'react';
import { FilePlus2, Link2, ShieldCheck, StickyNote, UploadCloud } from 'lucide-react';
import { ApiError, archiveApi } from '../api/client';
import type { Artifact, PrivacyState } from '../schemas/archive';

type Props = {
  archiveId: string;
  onImported: (artifact: Artifact) => Promise<void> | void;
};

type ImportMode = 'file' | 'note' | 'url';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportPanel({ archiveId, onImported }: Props) {
  const [mode, setMode] = useState<ImportMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [phase, setPhase] = useState('Unsorted');
  const [emotion, setEmotion] = useState(0.5);
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [provenance, setProvenance] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyState>('private');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fileSummary = useMemo(() => {
    if (!file) return null;
    return `${file.type || 'unknown type'} · ${formatBytes(file.size)}`;
  }, [file]);

  const reset = () => {
    setFile(null);
    setTitle('');
    setSource('');
    setPhase('Unsorted');
    setEmotion(0.5);
    setTags('');
    setDescription('');
    setProvenance('');
    setProgress(0);
    setMessage(null);
  };

  const switchMode = (next: ImportMode) => {
    setMode(next);
    reset();
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'file') {
        if (!file) {
          setMessage('Choose a file first.');
          return;
        }
        const artifact = await archiveApi.importFile(archiveId, file, {
          title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
          source: source.trim() || file.name,
          project_phase: phase.trim() || 'Unsorted',
          emotion,
          tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          people: [],
          description,
          provenance: provenance.trim() || `Imported from local file: ${file.name}`,
          privacy,
        }, setProgress);
        await onImported(artifact);
        setMessage('Artifact imported. Media derivatives will appear when processing finishes.');
        setFile(null);
        setTitle('');
        return;
      }

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setMessage('Add a title before saving.');
        return;
      }
      if (mode === 'url' && !source.trim()) {
        setMessage('Add the source URL before saving.');
        return;
      }
      const artifact = await archiveApi.createManualArtifact(archiveId, {
        title: trimmedTitle,
        type: mode,
        source: source.trim(),
        project_phase: phase.trim() || 'Unsorted',
        emotion,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        people: [],
        description,
        provenance: provenance.trim() || (mode === 'note' ? 'Entered manually' : source.trim()),
        privacy,
      });
      await onImported(artifact);
      setMessage(mode === 'note' ? 'Note added to the archive.' : 'URL reference added to the archive.');
      setTitle('');
      setSource('');
      setDescription('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && typeof error.detail === 'object' && error.detail) {
        const detail = error.detail as { message?: string; title?: string };
        setMessage(`${detail.message ?? 'Duplicate file'}${detail.title ? `: ${detail.title}` : ''}`);
      } else {
        setMessage(error instanceof Error ? error.message : 'Import failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack">
      <div className="segmented-control" role="tablist" aria-label="Artifact source type">
        <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => switchMode('file')}>
          <UploadCloud size={14} /> File
        </button>
        <button type="button" className={mode === 'note' ? 'active' : ''} onClick={() => switchMode('note')}>
          <StickyNote size={14} /> Note
        </button>
        <button type="button" className={mode === 'url' ? 'active' : ''} onClick={() => switchMode('url')}>
          <Link2 size={14} /> URL
        </button>
      </div>

      {mode === 'file' ? (
        <label className={`drop-field ${file ? 'has-file' : ''}`}>
          <input
            type="file"
            accept="image/*,.pdf,.md,.markdown,.txt,audio/*,.mp4,.mov,.m4v,.webm"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, ''));
              setProgress(0);
            }}
          />
          <FilePlus2 size={22} />
          <strong>{file?.name ?? 'Choose an artifact file'}</strong>
          <span>{fileSummary ?? 'Image, PDF, Markdown, TXT, audio, or allowed local video'}</span>
        </label>
      ) : null}

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should this memory be called?" />
      </label>

      {(mode === 'url' || mode === 'file') ? (
        <label className="field">
          <span>{mode === 'url' ? 'Source URL' : 'Source label'}</span>
          <input
            value={source}
            type={mode === 'url' ? 'url' : 'text'}
            onChange={(event) => setSource(event.target.value)}
            placeholder={mode === 'url' ? 'https://…' : 'Original folder, device, or source'}
          />
        </label>
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>Project phase</span>
          <input value={phase} onChange={(event) => setPhase(event.target.value)} placeholder="Origin / Build / Release" />
        </label>
        <label className="field">
          <span>Privacy</span>
          <select value={privacy} onChange={(event) => setPrivacy(event.target.value as PrivacyState)}>
            <option value="private">Private</option>
            <option value="shared">Eligible for read-only share</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Emotional weight · {Math.round(emotion * 100)}%</span>
        <input type="range" min="0" max="1" step="0.01" value={emotion} onChange={(event) => setEmotion(Number(event.target.value))} />
      </label>

      <label className="field">
        <span>Tags</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="research, launch, customer" />
      </label>

      <label className="field">
        <span>{mode === 'note' ? 'Memory / note' : 'Description'}</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What does this artifact contain?" />
      </label>

      <label className="field">
        <span>Provenance</span>
        <textarea value={provenance} onChange={(event) => setProvenance(event.target.value)} rows={2} placeholder="Where did this come from, and who captured it?" />
      </label>

      {mode === 'file' && (busy || progress > 0) ? (
        <div className="upload-progress" aria-live="polite">
          <div><span>Upload</span><strong>{progress}%</strong></div>
          <i><b style={{ width: `${progress}%` }} /></i>
          <small>{busy ? 'The source is being hashed and stored. Processing continues after upload.' : 'Upload complete.'}</small>
        </div>
      ) : null}

      <div className="privacy-note"><ShieldCheck size={15} /><span>Archives are private by default. Sharing only includes artifacts explicitly marked as shareable.</span></div>
      {message ? <div className="panel-message" role="status">{message}</div> : null}
      <button type="button" className="primary-action" onClick={() => void submit()} disabled={busy}>
        {busy ? 'Importing…' : mode === 'file' ? 'Import artifact' : 'Add to archive'}
      </button>
    </div>
  );
}

