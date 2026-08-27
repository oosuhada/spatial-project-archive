import { useMemo, useState } from 'react';
import { CheckCircle2, FilePlus2, Files, Link2, ShieldCheck, StickyNote, Trash2, UploadCloud, XCircle } from 'lucide-react';
import { ApiError, archiveApi } from '../api/client';
import type { Artifact, PrivacyState } from '../schemas/archive';

type Props = {
  archiveId: string;
  onImported: (artifact: Artifact) => Promise<void> | void;
};

type ImportMode = 'file' | 'note' | 'url';
type QueueStatus = 'queued' | 'uploading' | 'imported' | 'duplicate' | 'failed';
type QueueItem = { id: string; file: File; status: QueueStatus; progress: number; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportPanel({ archiveId, onImported }: Props) {
  const [mode, setMode] = useState<ImportMode>('file');
  const [queue, setQueue] = useState<QueueItem[]>([]);
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
    if (!queue.length) return null;
    const bytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    return `${queue.length} file${queue.length === 1 ? '' : 's'} · ${formatBytes(bytes)}`;
  }, [queue]);

  const reset = () => {
    setQueue([]);
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
        const pending = queue.filter((item) => item.status === 'queued' || item.status === 'failed');
        if (!pending.length) {
          setMessage(queue.length ? 'There are no queued files left to import.' : 'Choose one or more files first.');
          return;
        }
        let imported = 0;
        let duplicates = 0;
        let failed = 0;
        for (const pendingItem of pending) {
          const file = pendingItem.file;
          setQueue((current) => current.map((item) => item.id === pendingItem.id ? { ...item, status: 'uploading', progress: 0, message: 'Hashing and uploading…' } : item));
          try {
            const artifact = await archiveApi.importFile(archiveId, file, {
              title: queue.length === 1 && title.trim() ? title.trim() : file.name.replace(/\.[^.]+$/, ''),
              source: source.trim() || file.name,
              project_phase: phase.trim() || 'Unsorted',
              emotion,
              tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
              people: [],
              description,
              provenance: provenance.trim() || `Imported from local file: ${file.name}`,
              privacy,
            }, (percent) => {
              setProgress(percent);
              setQueue((current) => current.map((item) => item.id === pendingItem.id ? { ...item, progress: percent } : item));
            });
            imported += 1;
            setQueue((current) => current.map((item) => item.id === pendingItem.id ? { ...item, status: 'imported', progress: 100, message: artifact.processing_status === 'ready' ? 'Imported' : `Imported · ${artifact.processing_status}` } : item));
            await onImported(artifact);
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              duplicates += 1;
              const detail = typeof error.detail === 'object' && error.detail ? error.detail as { message?: string; title?: string } : {};
              setQueue((current) => current.map((item) => item.id === pendingItem.id ? { ...item, status: 'duplicate', message: `${detail.message ?? 'Exact duplicate'}${detail.title ? ` · ${detail.title}` : ''}` } : item));
            } else {
              failed += 1;
              const detail = error instanceof Error ? error.message : 'Import failed';
              setQueue((current) => current.map((item) => item.id === pendingItem.id ? { ...item, status: 'failed', message: detail } : item));
            }
          }
        }
        setMessage(`${imported} imported · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped · ${failed} failed. Imported files stay in this inbox so you can review the batch.`);
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
        <label className={`drop-field ${queue.length ? 'has-file' : ''}`}>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.md,.markdown,.txt,audio/*,.mp4,.mov,.m4v,.webm"
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files ?? []);
              setQueue((current) => [
                ...current.filter((item) => item.status === 'imported' || item.status === 'duplicate'),
                ...nextFiles.map((next) => ({ id: crypto.randomUUID(), file: next, status: 'queued' as const, progress: 0, message: 'Ready to import' })),
              ]);
              if (nextFiles.length === 1 && !title) setTitle(nextFiles[0].name.replace(/\.[^.]+$/, ''));
              setProgress(0);
              event.currentTarget.value = '';
            }}
          />
          <Files size={22} />
          <strong>{queue.length ? 'Add more files to the import inbox' : 'Choose one or many artifact files'}</strong>
          <span>{fileSummary ?? 'Batch import images, PDF, Markdown, TXT, audio, or allowed local video'}</span>
        </label>
      ) : null}

      {mode === 'file' && queue.length ? <div className="import-inbox">
        <div className="section-heading"><div><strong>Import inbox</strong><span>Files are uploaded individually so duplicates or failures do not block the rest of the batch.</span></div><b>{queue.filter((item) => item.status === 'queued' || item.status === 'failed').length} pending</b></div>
        <div className="import-inbox-list">{queue.map((item) => <article key={item.id} className={`import-inbox-item ${item.status}`}>
          <div className="import-inbox-state">{item.status === 'imported' ? <CheckCircle2 size={14} /> : item.status === 'failed' || item.status === 'duplicate' ? <XCircle size={14} /> : <FilePlus2 size={14} />}</div>
          <div><strong>{item.file.name}</strong><span>{formatBytes(item.file.size)} · {item.status}</span><small>{item.message}</small>{item.status === 'uploading' ? <i><b style={{ width: `${item.progress}%` }} /></i> : null}</div>
          {item.status !== 'uploading' ? <button type="button" onClick={() => setQueue((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remove ${item.file.name} from import inbox`}><Trash2 size={12} /></button> : null}
        </article>)}</div>
      </div> : null}

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
        {busy ? 'Importing batch…' : mode === 'file' ? `Import ${queue.filter((item) => item.status === 'queued' || item.status === 'failed').length || ''} file${queue.filter((item) => item.status === 'queued' || item.status === 'failed').length === 1 ? '' : 's'}`.trim() : 'Add to archive'}
      </button>
    </div>
  );
}

