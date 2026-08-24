export function parseArchiveId(pathname: string): string | null {
  const match = pathname.match(/^\/archives\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function parseArtifactId(search: string): string | null {
  return new URLSearchParams(search).get('artifact');
}

export function archivePath(archiveId: string, artifactId?: string | null): string {
  const base = `/archives/${encodeURIComponent(archiveId)}`;
  if (!artifactId) return base;
  return `${base}?artifact=${encodeURIComponent(artifactId)}`;
}

export function updateArchiveUrl(archiveId: string, artifactId?: string | null): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', archivePath(archiveId, artifactId));
}

