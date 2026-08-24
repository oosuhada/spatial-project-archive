import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  Archive as ArchiveIcon,
  Circle,
  Compass,
  GalleryHorizontal,
  Import,
  Layers3,
  MessageCircleQuestion,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { archiveApi } from '../api/client';
import { ArchiveCreatePanel } from '../archives/ArchiveCreatePanel';
import { SharePanel } from '../archives/SharePanel';
import { useArchiveWorkspace } from '../archives/useArchiveWorkspace';
import { ArtifactPanel } from '../artifacts/ArtifactPanel';
import { SearchPanel } from '../artifacts/SearchPanel';
import { ExhibitionEditor } from '../curation/ExhibitionEditor';
import { useExhibitionHistory } from '../curation/useExhibitionHistory';
import { CuratorPanel } from '../curator/CuratorPanel';
import { Gallery2D } from '../gallery-2d/Gallery2D';
import { ImportPanel } from '../imports/ImportPanel';
import type { ExhibitionVersion, SortMode } from '../schemas/archive';
import { createAutomaticPositions, mergeStoredPositions } from '../spatial/layout';
import { NavigationPanel } from '../spatial/NavigationPanel';
import { Timeline } from '../spatial/Timeline';
import { supportsWebGL } from '../lib/shared';
import { ErrorBoundary } from './ErrorBoundary';
import { PrimaryDrawer } from './PrimaryDrawer';

const MemoryScene = lazy(async () => {
  const module = await import('../spatial/MemoryScene');
  return { default: module.MemoryScene };
});

type Overlay = 'artifact' | 'import' | 'search' | 'curator' | 'editor' | 'share' | 'navigation' | 'archive' | null;

export function AppShell() {
  const reduced = Boolean(useReducedMotion());
  const workspace = useArchiveWorkspace();
  const webgl = useMemo(() => supportsWebGL(), []);
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState !== 'hidden');
  const [galleryMode, setGalleryMode] = useState(() => !webgl || window.matchMedia('(max-width: 760px)').matches);
  const [mode, setMode] = useState<SortMode>('time');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [lightingPreset, setLightingPreset] = useState<ExhibitionVersion['lighting_preset']>('nocturne');
  const [tourActive, setTourActive] = useState(false);
  const [sceneNotice, setSceneNotice] = useState<string | null>(null);

  const lowPower = useMemo(() => {
    const device = navigator as Navigator & { deviceMemory?: number };
    return (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 4)
      || Boolean(device.deviceMemory && device.deviceMemory <= 4);
  }, []);

  const snapshot = workspace.snapshot;
  const artifactSignature = snapshot?.artifacts.map((artifact) => `${artifact.id}:${artifact.created_at}:${artifact.emotion}`).join('|') ?? '';
  const positionSignature = snapshot?.positions.map((position) => `${position.artifact_id}:${position.x}:${position.y}:${position.z}:${position.rotation_y}:${position.scale}:${position.sequence}`).join('|') ?? '';
  const timePositions = useMemo(() => (
    snapshot ? mergeStoredPositions(snapshot.artifacts, snapshot.positions, 'time') : []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [artifactSignature, positionSignature, snapshot?.version?.id]);
  const history = useExhibitionHistory(timePositions);

  const displayPositions = useMemo(() => {
    if (!snapshot) return [];
    if (mode === 'time') return history.positions;
    return createAutomaticPositions(snapshot.artifacts, mode);
  }, [history.positions, mode, snapshot]);

  useEffect(() => {
    setLightingPreset(snapshot?.version?.lighting_preset ?? 'nocturne');
  }, [snapshot?.version?.id, snapshot?.version?.lighting_preset]);

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (workspace.selected && !overlay) setOverlay('artifact');
  // Only perform deep-link reveal when the selected artifact changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.selected?.id]);

  const orderedArtifacts = useMemo(() => {
    if (!snapshot) return [];
    const positionById = new Map(displayPositions.map((position) => [position.artifact_id, position]));
    return [...snapshot.artifacts].sort((a, b) => (
      (positionById.get(a.id)?.sequence ?? Number.MAX_SAFE_INTEGER)
      - (positionById.get(b.id)?.sequence ?? Number.MAX_SAFE_INTEGER)
      || Date.parse(a.created_at) - Date.parse(b.created_at)
    ));
  }, [displayPositions, snapshot]);

  const selectArtifact = (artifactId: string, openPanel = true) => {
    workspace.setSelectedId(artifactId);
    if (openPanel) setOverlay('artifact');
  };

  const stepTimeline = (direction: -1 | 1) => {
    if (orderedArtifacts.length === 0) return;
    const currentIndex = workspace.selectedId
      ? orderedArtifacts.findIndex((artifact) => artifact.id === workspace.selectedId)
      : direction > 0 ? -1 : orderedArtifacts.length;
    const nextIndex = Math.max(0, Math.min(orderedArtifacts.length - 1, currentIndex + direction));
    workspace.setSelectedId(orderedArtifacts[nextIndex].id);
  };

  useEffect(() => {
    if (!tourActive || orderedArtifacts.length === 0) return undefined;
    const cameraStops = orderedArtifacts.filter((artifact) => (
      displayPositions.find((position) => position.artifact_id === artifact.id)?.camera_stop !== false
    ));
    if (cameraStops.length === 0) return undefined;
    const timer = window.setInterval(() => {
      const current = workspace.selectedId
        ? cameraStops.findIndex((artifact) => artifact.id === workspace.selectedId)
        : -1;
      const next = cameraStops[(current + 1) % cameraStops.length];
      workspace.setSelectedId(next.id);
    }, reduced ? 3000 : 4300);
    return () => window.clearInterval(timer);
  }, [displayPositions, orderedArtifacts, reduced, tourActive, workspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (isTyping || overlay) return;
      if (event.key === 'ArrowLeft') stepTimeline(-1);
      if (event.key === 'ArrowRight') stepTimeline(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const saveLayout = async (name: string) => {
    if (!snapshot) return;
    await archiveApi.saveLayout(snapshot.archive.id, {
      name,
      lighting_preset: lightingPreset,
      positions: history.positions,
    });
    await workspace.refresh();
  };

  const closeOverlay = () => {
    if (overlay === 'artifact') workspace.setSelectedId(workspace.selectedId);
    setOverlay(null);
  };

  if (workspace.loading && !snapshot) {
    return (
      <main className="museum-shell loading-shell">
        <div className="museum-loading"><Sparkles size={22} /><span>OPENING LOCAL ARCHIVE</span><i /></div>
      </main>
    );
  }

  if (workspace.error && !snapshot) {
    return (
      <main className="service-error-shell">
        <ArchiveIcon size={30} />
        <h1>Archive service is offline</h1>
        <p>{workspace.error}</p>
        <code>cd backend && .venv/bin/uvicorn app.main:app --port 8104</code>
        <button type="button" onClick={() => void workspace.load()}>Retry connection</button>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="first-archive-shell">
        <div className="first-archive-mark"><Circle size={13} fill="currentColor" /><span>MEMORY MUSEUM</span></div>
        <section>
          <span>PRODUCTION SPATIAL ARCHIVE</span>
          <h1>Turn source material into a navigable project story.</h1>
          <p>Create a private archive, import real files, preserve provenance, arrange an exhibition, and ask a curator that cites the material it interpreted.</p>
        </section>
        <div className="first-archive-form">
          <ArchiveCreatePanel onCreate={async (title, description) => { await workspace.createArchive(title, description); }} />
        </div>
      </main>
    );
  }

  const hasPrimaryOverlay = overlay !== null;
  const overlayTitle = overlay === 'artifact' ? workspace.selected?.title ?? 'Artifact'
    : overlay === 'import' ? 'Import artifacts'
      : overlay === 'search' ? 'Search archive'
        : overlay === 'curator' ? 'Ask the curator'
          : overlay === 'editor' ? 'Exhibition editor'
            : overlay === 'share' ? 'Share & export'
              : overlay === 'navigation' ? 'Navigate the archive'
                : overlay === 'archive' ? 'Create archive'
                  : '';

  return (
    <main className={`museum-shell ${lowPower ? 'low-power' : ''} ${galleryMode ? 'gallery-mode' : 'spatial-mode'} ${hasPrimaryOverlay ? 'has-overlay' : ''}`}>
      {!galleryMode && webgl ? (
        <ErrorBoundary onError={() => setGalleryMode(true)}>
          <Suspense fallback={<div className="scene-loading">Preparing spatial archive…</div>}>
            <MemoryScene
              artifacts={snapshot.artifacts}
              positions={displayPositions}
              relationships={snapshot.relationships}
              selectedId={workspace.selectedId}
              onSelect={(artifact) => selectArtifact(artifact.id)}
              reduced={reduced}
              lowPower={lowPower}
              active={documentVisible}
              lightingPreset={lightingPreset}
              onContextLost={() => {
                setSceneNotice('WebGL context was lost. The archive switched to the 2D gallery; your data and layout are unchanged.');
                setGalleryMode(true);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <Gallery2D
          artifacts={orderedArtifacts}
          relationships={snapshot.relationships}
          selectedId={workspace.selectedId}
          onSelect={(artifact) => selectArtifact(artifact.id)}
        />
      )}

      <header className="museum-header">
        <div className="museum-brand">
          <Circle size={12} fill="currentColor" />
          <div><strong>MEMORY MUSEUM</strong><span>{workspace.readOnly ? 'READ-ONLY SPATIAL STORY' : 'PRIVATE SPATIAL ARCHIVE'}</span></div>
        </div>
        <div className="archive-switcher">
          {workspace.readOnly ? <span>{snapshot.archive.title}</span> : (
            <select value={snapshot.archive.id} onChange={(event) => void workspace.switchArchive(event.target.value)} aria-label="Current archive">
              {workspace.archives.map((archive) => <option key={archive.id} value={archive.id}>{archive.title}</option>)}
            </select>
          )}
          {!workspace.readOnly ? <button type="button" onClick={() => setOverlay('archive')} aria-label="Create another archive"><Plus size={14} /></button> : null}
        </div>
        <div className="header-actions">
          <button type="button" className={galleryMode ? 'active' : ''} onClick={() => setGalleryMode((current) => !current)} disabled={!webgl}>
            {galleryMode ? <Layers3 size={14} /> : <GalleryHorizontal size={14} />}{galleryMode ? 'Spatial' : '2D'}
          </button>
          <button type="button" onClick={() => setOverlay('navigation')}><Compass size={14} /> Help</button>
        </div>
      </header>

      <button type="button" className="navigation-hint" onClick={() => setOverlay('navigation')}>
        <Compass size={14} />
        <span>{galleryMode ? 'Swipe or scroll · select an artifact · open Search for a direct jump' : 'Drag to look · scroll to move · select an artifact · guided tour available'}</span>
      </button>

      {!workspace.readOnly ? (
        <nav className="archive-toolrail" aria-label="Archive tools">
          <button type="button" onClick={() => setOverlay('import')}><Import size={15} /><span>Import</span></button>
          <button type="button" onClick={() => setOverlay('search')}><Search size={15} /><span>Search</span></button>
          <button type="button" onClick={() => { setMode('time'); setOverlay('editor'); }}><SlidersHorizontal size={15} /><span>Arrange</span></button>
          <button type="button" onClick={() => setOverlay('curator')}><MessageCircleQuestion size={15} /><span>Curator</span></button>
          <button type="button" onClick={() => setOverlay('share')}><Share2 size={15} /><span>Share</span></button>
        </nav>
      ) : null}

      {!workspace.readOnly ? (
        <nav className="curation-modes" aria-label="Archive arrangement">
          <span>ARRANGE VIEW</span>
          <button type="button" className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}>Time</button>
          <button type="button" className={mode === 'emotion' ? 'active' : ''} onClick={() => setMode('emotion')}>Emotion</button>
          <button type="button" className={mode === 'project' ? 'active' : ''} onClick={() => setMode('project')}>Project</button>
        </nav>
      ) : null}

      {snapshot.artifacts.length === 0 && !hasPrimaryOverlay ? (
        <section className="empty-archive-cta">
          <span>EMPTY ARCHIVE</span>
          <h2>Bring the first piece of evidence into the room.</h2>
          <p>Images, PDFs, Markdown, text, audio, local video, URLs, and manual notes keep their provenance and processing state.</p>
          {!workspace.readOnly ? <button type="button" onClick={() => setOverlay('import')}><Import size={15} /> Import first artifact</button> : null}
        </section>
      ) : null}

      {sceneNotice ? <div className="scene-notice" role="status"><span>{sceneNotice}</span><button type="button" onClick={() => setSceneNotice(null)}>Dismiss</button></div> : null}
      {workspace.error ? <div className="offline-banner" role="status">Archive refresh failed: {workspace.error}. The last loaded state remains visible.</div> : null}

      <Timeline
        artifacts={snapshot.artifacts}
        positions={displayPositions}
        selectedId={workspace.selectedId}
        tourActive={tourActive}
        onSelect={(artifactId) => selectArtifact(artifactId, false)}
        onStep={stepTimeline}
        onToggleTour={() => {
          setOverlay(null);
          setTourActive((current) => !current);
        }}
      />

      {overlay ? (
        <PrimaryDrawer title={overlayTitle} eyebrow={overlay === 'artifact' ? `${workspace.selected?.type ?? 'artifact'} · ${workspace.selected?.project_phase ?? ''}` : undefined} onClose={closeOverlay} wide={overlay === 'editor'}>
          {overlay === 'artifact' && workspace.selected ? (
            <ArtifactPanel
              artifact={workspace.selected}
              artifacts={snapshot.artifacts}
              relationships={snapshot.relationships}
              readOnly={workspace.readOnly}
              onRefresh={workspace.refresh}
              onOpenArtifact={(artifactId) => selectArtifact(artifactId)}
              onDeleted={async () => {
                workspace.setSelectedId(null);
                setOverlay(null);
                await workspace.refresh();
              }}
            />
          ) : null}
          {overlay === 'import' && !workspace.readOnly ? <ImportPanel archiveId={snapshot.archive.id} onImported={async (artifact) => { await workspace.refresh(); selectArtifact(artifact.id); }} /> : null}
          {overlay === 'search' && !workspace.readOnly ? <SearchPanel archiveId={snapshot.archive.id} onOpenArtifact={(artifactId) => selectArtifact(artifactId)} /> : null}
          {overlay === 'curator' && !workspace.readOnly ? <CuratorPanel archiveId={snapshot.archive.id} artifacts={snapshot.artifacts} selectedArtifactId={workspace.selectedId} onOpenArtifact={(artifactId) => selectArtifact(artifactId)} /> : null}
          {overlay === 'editor' && !workspace.readOnly ? (
            <ExhibitionEditor
              artifacts={snapshot.artifacts}
              positions={history.positions}
              selectedId={workspace.selectedId}
              lightingPreset={lightingPreset}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onSelect={(artifactId) => workspace.setSelectedId(artifactId)}
              onPreviewPositions={history.replace}
              onCommitPositions={history.commit}
              onUndo={history.undo}
              onRedo={history.redo}
              onLightingChange={setLightingPreset}
              onSave={saveLayout}
            />
          ) : null}
          {overlay === 'share' && !workspace.readOnly ? <SharePanel archive={snapshot.archive} artifacts={snapshot.artifacts} /> : null}
          {overlay === 'navigation' ? <NavigationPanel reducedMotion={reduced} /> : null}
          {overlay === 'archive' && !workspace.readOnly ? <ArchiveCreatePanel onCreate={async (title, description) => { await workspace.createArchive(title, description); setOverlay(null); }} /> : null}
        </PrimaryDrawer>
      ) : null}
    </main>
  );
}

