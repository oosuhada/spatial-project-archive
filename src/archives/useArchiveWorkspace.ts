import { useCallback, useEffect, useMemo, useState } from 'react';
import { archiveApi } from '../api/client';
import { archivePath, parseArchiveId, parseArtifactId } from '../routes/archive-url';
import type { Archive, ArchiveSnapshot, Artifact, SpatialPosition } from '../schemas/archive';
import { ensureSampleArchive, SAMPLE_ARCHIVE_TITLE } from '../demo/sampleArchive';

type WorkspaceState = {
  archives: Archive[];
  snapshot: ArchiveSnapshot | null;
  loading: boolean;
  error: string | null;
  readOnly: boolean;
  shareToken: string | null;
};

const initialState: WorkspaceState = {
  archives: [],
  snapshot: null,
  loading: true,
  error: null,
  readOnly: false,
  shareToken: null,
};

function currentShareToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/share\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function useArchiveWorkspace() {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => (
    typeof window === 'undefined' ? null : parseArtifactId(window.location.search)
  ));

  const load = useCallback(async (archiveId?: string | null) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const shareToken = currentShareToken();
      if (shareToken) {
        const snapshot = await archiveApi.getSharedSnapshot(shareToken);
        setState({ archives: [], snapshot, loading: false, error: null, readOnly: true, shareToken });
        return;
      }

      let archives = await archiveApi.listArchives();
      if (!archives.some((archive) => archive.title === SAMPLE_ARCHIVE_TITLE)) {
        try {
          await ensureSampleArchive(archives);
          archives = await archiveApi.listArchives();
        } catch {
          // A sample is helpful but must never prevent access to a user's real archive.
        }
      }
      const routeArchiveId = archiveId ?? (typeof window === 'undefined' ? null : parseArchiveId(window.location.pathname));
      const targetId = routeArchiveId && archives.some((archive) => archive.id === routeArchiveId)
        ? routeArchiveId
        : archives.find((archive) => archive.title === SAMPLE_ARCHIVE_TITLE)?.id ?? archives[0]?.id ?? null;
      const snapshot = targetId ? await archiveApi.getSnapshot(targetId) : null;
      if (targetId && typeof window !== 'undefined' && parseArchiveId(window.location.pathname) !== targetId) {
        window.history.replaceState(null, '', archivePath(targetId, parseArtifactId(window.location.search)));
      }
      setState({ archives, snapshot, loading: false, error: null, readOnly: false, shareToken: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Archive service is unavailable',
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onPopState = () => {
      setSelectedIdState(parseArtifactId(window.location.search));
      void load(parseArchiveId(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [load]);

  useEffect(() => {
    if (!state.snapshot || state.readOnly) return undefined;
    const hasProcessing = state.snapshot.artifacts.some((artifact) => (
      artifact.processing_status === 'pending' || artifact.processing_status === 'processing'
    ));
    if (!hasProcessing) return undefined;
    const timer = window.setInterval(() => {
      void archiveApi.getSnapshot(state.snapshot!.archive.id).then((snapshot) => {
        setState((current) => ({ ...current, snapshot }));
      }).catch(() => undefined);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [state.readOnly, state.snapshot]);

  const refresh = useCallback(async () => {
    if (state.readOnly && state.shareToken) {
      const snapshot = await archiveApi.getSharedSnapshot(state.shareToken);
      setState((current) => ({ ...current, snapshot, error: null }));
      return snapshot;
    }
    if (!state.snapshot) return null;
    const snapshot = await archiveApi.getSnapshot(state.snapshot.archive.id);
    setState((current) => ({ ...current, snapshot, error: null }));
    return snapshot;
  }, [state.readOnly, state.shareToken, state.snapshot]);

  const createArchive = useCallback(async (title: string, description: string) => {
    const archive = await archiveApi.createArchive({ title, description });
    window.history.pushState(null, '', archivePath(archive.id));
    setSelectedIdState(null);
    await load(archive.id);
    return archive;
  }, [load]);

  const switchArchive = useCallback(async (archiveId: string) => {
    window.history.pushState(null, '', archivePath(archiveId));
    setSelectedIdState(null);
    await load(archiveId);
  }, [load]);

  const setSelectedId = useCallback((artifactId: string | null, push = false) => {
    setSelectedIdState(artifactId);
    const archiveId = state.snapshot?.archive.id;
    if (!archiveId || state.readOnly) return;
    const next = archivePath(archiveId, artifactId);
    if (push) window.history.pushState(null, '', next);
    else window.history.replaceState(null, '', next);
  }, [state.readOnly, state.snapshot?.archive.id]);

  const selected = useMemo<Artifact | null>(() => (
    state.snapshot?.artifacts.find((artifact) => artifact.id === selectedId) ?? null
  ), [selectedId, state.snapshot?.artifacts]);

  const setPositionsLocally = useCallback((positions: SpatialPosition[]) => {
    setState((current) => current.snapshot ? {
      ...current,
      snapshot: { ...current.snapshot, positions },
    } : current);
  }, []);

  return {
    ...state,
    selectedId,
    selected,
    load,
    refresh,
    createArchive,
    switchArchive,
    setSelectedId,
    setPositionsLocally,
  };
}

