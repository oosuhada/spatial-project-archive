import { useMemo, useRef, useState } from 'react';
import { Camera, Lightbulb, Redo2, RotateCw, Save, Undo2 } from 'lucide-react';
import { clampSpatialPosition } from '../spatial/layout';
import type { Artifact, ExhibitionVersion, SpatialPosition } from '../schemas/archive';

type Props = {
  artifacts: Artifact[];
  positions: SpatialPosition[];
  selectedId: string | null;
  lightingPreset: ExhibitionVersion['lighting_preset'];
  canUndo: boolean;
  canRedo: boolean;
  onSelect: (artifactId: string) => void;
  onPreviewPositions: (positions: SpatialPosition[]) => void;
  onCommitPositions: (positions: SpatialPosition[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLightingChange: (preset: ExhibitionVersion['lighting_preset']) => void;
  onSave: (name: string) => Promise<void>;
};

const floorX = (x: number) => ((x + 8) / 16) * 100;
const floorY = (z: number) => ((z + 12) / 17) * 100;
const worldX = (percent: number) => percent * 16 - 8;
const worldZ = (percent: number) => percent * 17 - 12;

export function ExhibitionEditor({
  artifacts,
  positions,
  selectedId,
  lightingPreset,
  canUndo,
  canRedo,
  onSelect,
  onPreviewPositions,
  onCommitPositions,
  onUndo,
  onRedo,
  onLightingChange,
  onSave,
}: Props) {
  const floorRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [versionName, setVersionName] = useState(() => `Exhibition ${new Date().toLocaleString()}`);
  const [message, setMessage] = useState<string | null>(null);
  const selected = positions.find((position) => position.artifact_id === selectedId) ?? null;
  const artifactById = useMemo(() => new Map(artifacts.map((artifact) => [artifact.id, artifact])), [artifacts]);

  const updateOne = (transform: (position: SpatialPosition) => SpatialPosition) => {
    if (!selectedId) return;
    const next = positions.map((position) => (
      position.artifact_id === selectedId ? clampSpatialPosition(transform(position)) : position
    ));
    onCommitPositions(next);
  };

  const updateFromPointer = (clientX: number, clientY: number, commit: boolean) => {
    if (!draggingId || !floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    const xPercent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yPercent = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const next = positions.map((position) => (
      position.artifact_id === draggingId
        ? clampSpatialPosition({ ...position, x: worldX(xPercent), z: worldZ(yPercent) })
        : position
    ));
    if (commit) onCommitPositions(next);
    else onPreviewPositions(next);
  };

  const save = async () => {
    setMessage(null);
    try {
      await onSave(versionName.trim() || 'Exhibition version');
      setMessage('Version saved. This exact arrangement will restore after refresh.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Version save failed');
    }
  };

  return (
    <div className="panel-stack exhibition-editor">
      <div className="editor-toolbar">
        <button type="button" onClick={onUndo} disabled={!canUndo}><Undo2 size={14} /> Undo</button>
        <button type="button" onClick={onRedo} disabled={!canRedo}><Redo2 size={14} /> Redo</button>
        <span>{positions.length} placed</span>
      </div>

      <section className="floor-plan-section">
        <div className="section-heading"><strong>2D floor-plan editor</strong><span>Drag artifacts to place them without navigating 3D.</span></div>
        <div
          ref={floorRef}
          className="floor-plan"
          onPointerMove={(event) => updateFromPointer(event.clientX, event.clientY, false)}
          onPointerUp={(event) => {
            updateFromPointer(event.clientX, event.clientY, true);
            setDraggingId(null);
          }}
          onPointerCancel={() => setDraggingId(null)}
        >
          <div className="floor-zone zone-a">ORIGIN</div>
          <div className="floor-zone zone-b">MIDDLE</div>
          <div className="floor-zone zone-c">RELEASE</div>
          {positions.map((position, index) => {
            const artifact = artifactById.get(position.artifact_id);
            if (!artifact) return null;
            return (
              <button
                type="button"
                key={position.artifact_id}
                className={selectedId === position.artifact_id ? 'active' : ''}
                style={{ left: `${floorX(position.x)}%`, top: `${floorY(position.z)}%` }}
                title={artifact.title}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingId(position.artifact_id);
                  onSelect(position.artifact_id);
                }}
                onClick={() => onSelect(position.artifact_id)}
              >
                {String(index + 1).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </section>

      {selected ? (
        <section className="transform-editor">
          <div className="section-heading"><strong>{artifactById.get(selected.artifact_id)?.title ?? 'Selected artifact'}</strong><span>{selected.zone}</span></div>
          <div className="transform-grid">
            <button type="button" onClick={() => updateOne((position) => ({ ...position, x: position.x - 0.45 }))}>← X</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, z: position.z - 0.45 }))}>↑ Z</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, x: position.x + 0.45 }))}>X →</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, z: position.z + 0.45 }))}>↓ Z</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, y: position.y + 0.3 }))}>Y +</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, y: position.y - 0.3 }))}>Y −</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, rotation_y: position.rotation_y - Math.PI / 12 }))}><RotateCw size={13} /> −15°</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, rotation_y: position.rotation_y + Math.PI / 12 }))}><RotateCw size={13} /> +15°</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, scale: position.scale - 0.1 }))}>Scale −</button>
            <button type="button" onClick={() => updateOne((position) => ({ ...position, scale: position.scale + 0.1 }))}>Scale +</button>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Room / zone</span>
              <input value={selected.zone} onChange={(event) => updateOne((position) => ({ ...position, zone: event.target.value }))} />
            </label>
            <label className="field">
              <span>Story sequence</span>
              <input type="number" min="0" value={selected.sequence} onChange={(event) => updateOne((position) => ({ ...position, sequence: Number(event.target.value) }))} />
            </label>
          </div>
          <label className="toggle-field">
            <input type="checkbox" checked={selected.camera_stop} onChange={(event) => updateOne((position) => ({ ...position, camera_stop: event.target.checked }))} />
            <Camera size={14} /><span>Include as a guided-tour camera stop</span>
          </label>
        </section>
      ) : <p className="muted-copy">Select an artifact on the floor plan to edit transform, zone, sequence, and camera stop.</p>}

      <section className="lighting-editor">
        <div className="section-heading"><Lightbulb size={14} /><strong>Lighting preset</strong></div>
        <div className="segmented-control">
          {(['nocturne', 'dawn', 'paper', 'quiet'] as const).map((preset) => (
            <button type="button" key={preset} className={lightingPreset === preset ? 'active' : ''} onClick={() => onLightingChange(preset)}>{preset}</button>
          ))}
        </div>
      </section>

      <label className="field">
        <span>Version name</span>
        <input value={versionName} onChange={(event) => setVersionName(event.target.value)} />
      </label>
      {message ? <div className="panel-message" role="status">{message}</div> : null}
      <button type="button" className="primary-action" onClick={() => void save()}><Save size={14} /> Save exhibition version</button>
    </div>
  );
}

