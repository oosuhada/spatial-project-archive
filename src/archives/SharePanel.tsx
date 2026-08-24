import { useState } from 'react';
import { Copy, Download, ExternalLink, Link2Off, ShieldCheck } from 'lucide-react';
import { archiveApi } from '../api/client';
import type { Archive, Artifact, ShareLink } from '../schemas/archive';

type Props = {
  archive: Archive;
  artifacts: Artifact[];
};

export function SharePanel({ archive, artifacts }: Props) {
  const [share, setShare] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const shareable = artifacts.filter((artifact) => artifact.privacy === 'shared');

  const createShare = async () => {
    setBusy(true);
    try {
      const result = await archiveApi.createShare(archive.id);
      setShare(result);
      setMessage('Read-only link created. Private artifacts remain excluded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create share link');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!share) return;
    setBusy(true);
    try {
      const result = await archiveApi.revokeShare(share.id);
      setShare(result);
      setMessage('Share access revoked.');
    } finally {
      setBusy(false);
    }
  };

  const exportManifest = async () => {
    setBusy(true);
    try {
      const manifest = await archiveApi.exportArchive(archive.id);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${archive.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'archive'}-manifest.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Archive manifest exported. Original binaries remain available from each artifact.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack share-panel">
      <section className="share-summary">
        <ShieldCheck size={18} />
        <div>
          <strong>Private by default</strong>
          <p>{shareable.length} of {artifacts.length} artifacts are currently eligible for a read-only share. Private notes are never included.</p>
        </div>
      </section>

      {share && !share.revoked_at ? (
        <section className="share-link-card">
          <span>Read-only preview</span>
          <strong>{share.url}</strong>
          <div>
            <button type="button" onClick={() => void navigator.clipboard.writeText(share.url).then(() => setMessage('Share URL copied.'))}><Copy size={14} /> Copy</button>
            <a href={share.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Preview</a>
          </div>
        </section>
      ) : (
        <button type="button" className="primary-action" onClick={() => void createShare()} disabled={busy || shareable.length === 0}>
          Create read-only share
        </button>
      )}

      {share?.revoked_at ? <div className="panel-message">This link was revoked and no longer resolves.</div> : null}
      {share && !share.revoked_at ? (
        <button type="button" className="danger-action" onClick={() => void revoke()} disabled={busy}><Link2Off size={14} /> Revoke share</button>
      ) : null}

      <div className="divider" />
      <button type="button" className="secondary-action" onClick={() => void exportManifest()} disabled={busy}><Download size={14} /> Export archive manifest</button>
      <p className="muted-copy">The manifest contains metadata, relationships, spatial layout, and provenance. It intentionally excludes private human notes and does not embed original binaries.</p>
      {message ? <div className="panel-message" role="status">{message}</div> : null}
    </div>
  );
}

