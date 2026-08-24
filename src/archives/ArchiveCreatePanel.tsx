import { useState } from 'react';
import { Archive, LockKeyhole } from 'lucide-react';

type Props = {
  onCreate: (title: string, description: string) => Promise<void>;
};

export function ArchiveCreatePanel({ onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(title.trim(), description.trim());
      setTitle('');
      setDescription('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Archive creation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack archive-create-panel">
      <div className="curator-principle">
        <Archive size={17} />
        <p>An archive is a private project space for source files, interpretations, relationships, and authored exhibition versions.</p>
      </div>
      <label className="field">
        <span>Archive title</span>
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Product launch 2026" />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What story should this archive preserve?" />
      </label>
      <div className="privacy-note"><LockKeyhole size={15} /><span>New archives and imported artifacts are private unless you explicitly mark an artifact shareable.</span></div>
      {error ? <div className="panel-message error" role="alert">{error}</div> : null}
      <button type="button" className="primary-action" disabled={!title.trim() || busy} onClick={() => void submit()}>{busy ? 'Creating…' : 'Create archive'}</button>
    </div>
  );
}

