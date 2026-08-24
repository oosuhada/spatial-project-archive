import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { archiveApi } from '../api/client';
import { ArtifactPreview } from '../media/ArtifactPreview';
import type { Artifact, SearchFilters } from '../schemas/archive';

type Props = {
  archiveId: string;
  onOpenArtifact: (artifactId: string) => void;
};

export function SearchPanel({ archiveId, onOpenArtifact }: Props) {
  const [filters, setFilters] = useState<SearchFilters>({ q: '' });
  const [results, setResults] = useState<Artifact[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusy(true);
      void archiveApi.search(archiveId, filters)
        .then(setResults)
        .finally(() => setBusy(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [archiveId, filters]);

  return (
    <div className="panel-stack search-panel">
      <label className="search-field">
        <Search size={16} />
        <input
          autoFocus
          value={filters.q ?? ''}
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          placeholder="Search title, description, transcript, provenance…"
        />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Type</span>
          <select value={filters.type ?? ''} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as SearchFilters['type'] }))}>
            <option value="">All types</option>
            <option value="image">Image</option><option value="pdf">PDF</option><option value="audio">Audio</option>
            <option value="video">Video</option><option value="markdown">Markdown</option><option value="text">Text</option>
            <option value="url">URL</option><option value="note">Note</option>
          </select>
        </label>
        <label className="field">
          <span>Minimum emotion</span>
          <select value={filters.emotion_min ?? ''} onChange={(event) => setFilters((current) => ({ ...current, emotion_min: event.target.value ? Number(event.target.value) : undefined }))}>
            <option value="">Any</option><option value="0.5">50%</option><option value="0.7">70%</option><option value="0.9">90%</option>
          </select>
        </label>
      </div>
      <div className="search-result-meta">{busy ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}</div>
      <div className="search-results">
        {results.map((artifact) => (
          <button type="button" key={artifact.id} onClick={() => onOpenArtifact(artifact.id)}>
            <ArtifactPreview artifact={artifact} compact />
            <div><span>{artifact.type} · {artifact.project_phase}</span><strong>{artifact.title}</strong><small>{artifact.description || artifact.provenance}</small></div>
          </button>
        ))}
      </div>
    </div>
  );
}

