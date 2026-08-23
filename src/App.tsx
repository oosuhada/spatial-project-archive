import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Html, Line, RoundedBox, Sparkles } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BlendFunction } from 'postprocessing';
import {
  Aperture,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Circle,
  Film,
  GalleryHorizontal,
  Heart,
  Image as ImageIcon,
  Layers3,
  MessageCircleQuestion,
  MousePointer2,
  Move3d,
  Quote,
  ScanLine,
  Sparkles as SparklesIcon,
  X,
} from 'lucide-react';
import type { Vector3Tuple } from 'three';
import { museumArtifacts, streamDeterministicText } from './lib/mock-ai';
import { supportsWebGL } from './lib/shared';

type SortMode = 'time' | 'emotion' | 'project';
type Artifact = (typeof museumArtifacts)[number];
type PositionedArtifact = Artifact & { position: Vector3Tuple; accent: string };

const projectIndex: Record<string, number> = { Origin: 0, Shape: 1, Break: 2, Release: 3 };
const accents = ['#f1d9b7', '#adc9d8', '#b69aa8', '#d3b98e', '#aac3a5', '#c6b5d3'];

function arrangeArtifacts(mode: SortMode): PositionedArtifact[] {
  const list = [...museumArtifacts];
  if (mode === 'emotion') list.sort((a, b) => b.emotion - a.emotion);
  if (mode === 'project') list.sort((a, b) => projectIndex[a.project] - projectIndex[b.project]);

  return list.map((artifact, index) => {
    if (mode === 'emotion') {
      const angle = (index / list.length) * Math.PI * 2 - Math.PI / 2;
      const radius = 3 + artifact.emotion * 2.2;
      return { ...artifact, position: [Math.cos(angle) * radius, (artifact.emotion - .5) * 3, Math.sin(angle) * radius - 1], accent: accents[(artifact.id - 1) % accents.length] };
    }
    if (mode === 'project') {
      const project = projectIndex[artifact.project] ?? 0;
      return { ...artifact, position: [-4.6 + project * 3.1, (index % 2) * 2.1 - .8, -project * 1.55 + (index % 2) * .6], accent: accents[(artifact.id - 1) % accents.length] };
    }
    return { ...artifact, position: [-5.1 + index * 2.05, index % 2 === 0 ? .75 : -.75, -index * .82], accent: accents[(artifact.id - 1) % accents.length] };
  });
}

function ArtifactObject({ artifact, selected, onSelect, reduced }: { artifact: PositionedArtifact; selected: boolean; onSelect: (artifact: Artifact) => void; reduced: boolean }) {
  const [hovered, setHovered] = useState(false);
  const scale = artifact.kind === 'screen' ? [1.65, 1.05, .08] as Vector3Tuple : artifact.kind === 'wireframe' ? [1.35, 1.75, .08] as Vector3Tuple : [1.28, 1.55, .07] as Vector3Tuple;

  return (
    <group position={artifact.position}>
      <RoundedBox
        args={scale}
        radius={.035}
        smoothness={3}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={(event) => { event.stopPropagation(); onSelect(artifact); }}
      >
        <meshPhysicalMaterial
          color={selected ? artifact.accent : '#171719'}
          emissive={artifact.accent}
          emissiveIntensity={selected ? .22 : hovered ? .12 : .035}
          metalness={.18}
          roughness={.42}
          clearcoat={.7}
          clearcoatRoughness={.3}
        />
      </RoundedBox>
      <mesh position={[0, 0, .08]} scale={[scale[0] * .88, scale[1] * .88, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={artifact.accent} transparent opacity={selected ? .38 : hovered ? .22 : .1} />
      </mesh>
      <mesh position={[-scale[0] * .34, scale[1] * .33, .095]} scale={[.12, .12, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color={artifact.accent} />
      </mesh>
      {(hovered || selected) ? (
        <Html transform distanceFactor={7.2} position={[0, -scale[1] * .64, .12]} center className="spatial-label-wrap">
          <div className={`spatial-label ${selected ? 'selected' : ''}`}>
            <span>{artifact.year} / {artifact.kind}</span>
            <strong>{artifact.title}</strong>
            <small>{selected ? 'OPEN IN ARCHIVE' : 'APPROACH TO REVEAL'}</small>
          </div>
        </Html>
      ) : null}
      {!reduced && selected ? <Sparkles count={14} scale={[2.2, 2.2, 1.5]} size={1.4} speed={.18} color={artifact.accent} opacity={.5} /> : null}
    </group>
  );
}

function MemoryScene({ artifacts, selectedId, onSelect, reduced }: { artifacts: PositionedArtifact[]; selectedId: number | null; onSelect: (artifact: Artifact) => void; reduced: boolean }) {
  const controls = useRef<any>(null);
  const selected = artifacts.find((artifact) => artifact.id === selectedId) ?? null;

  useEffect(() => {
    if (!controls.current) return;
    if (selected) {
      const [x, y, z] = selected.position;
      controls.current.setLookAt(x + 1.8, y + .55, z + 3.6, x, y, z, !reduced);
    } else {
      controls.current.setLookAt(0, 1.15, 9.2, 0, 0, -1.7, !reduced);
    }
  }, [selected, reduced]);

  const threadPoints = useMemo(() => artifacts.map((artifact) => artifact.position), [artifacts]);

  return (
    <Canvas camera={{ position: [0, 1.15, 9.2], fov: 46 }} dpr={[1, 1.45]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#090a0d']} />
      <fog attach="fog" args={['#090a0d', 7, 20]} />
      <ambientLight intensity={.14} />
      <hemisphereLight intensity={.45} color="#dbe4ef" groundColor="#2a211e" />
      <spotLight position={[-6, 7, 5]} intensity={32} angle={.28} penumbra={1} color="#f1d5b7" />
      <spotLight position={[7, 3, -1]} intensity={22} angle={.32} penumbra={1} color="#accae2" />
      <pointLight position={[0, -3, 2]} intensity={7} color="#bda2d7" />

      <group>
        {artifacts.map((artifact) => <ArtifactObject key={artifact.id} artifact={artifact} selected={selectedId === artifact.id} onSelect={onSelect} reduced={reduced} />)}
        {threadPoints.slice(0, -1).map((point, index) => (
          <Line key={`${index}-${artifacts[index + 1].id}`} points={[point, artifacts[index + 1].position]} color={artifacts[index].accent} lineWidth={.45} transparent opacity={.25} dashed={false} />
        ))}
      </group>

      <Sparkles count={reduced ? 45 : 150} scale={[18, 9, 18]} size={.75} speed={reduced ? 0 : .08} opacity={.2} color="#e8e0d7" />
      <CameraControls ref={controls} smoothTime={reduced ? .01 : .55} minDistance={3.6} maxDistance={15} dollySpeed={.45} truckSpeed={.6} />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={.42} luminanceSmoothing={.9} intensity={.55} mipmapBlur />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={.17} />
        <Vignette eskil={false} offset={.12} darkness={.92} />
      </EffectComposer>
    </Canvas>
  );
}

function ArtifactGlyph({ kind }: { kind: string }) {
  if (kind === 'screen') return <ImageIcon size={15} />;
  if (kind === 'wireframe') return <Layers3 size={15} />;
  if (kind === 'feedback') return <Quote size={15} />;
  if (kind === 'experiment') return <Aperture size={15} />;
  if (kind === 'reflection') return <BookOpen size={15} />;
  return <Film size={15} />;
}

function GalleryFallback({ artifacts, selectedId, onSelect }: { artifacts: PositionedArtifact[]; selectedId: number | null; onSelect: (artifact: Artifact) => void }) {
  return (
    <div className="gallery-fallback">
      <div className="gallery-track">
        {artifacts.map((artifact, index) => (
          <button key={artifact.id} className={selectedId === artifact.id ? 'active' : ''} onClick={() => onSelect(artifact)}>
            <span>0{index + 1} / {artifact.year}</span>
            <div className="gallery-art" style={{ '--artifact-accent': artifact.accent } as React.CSSProperties}><ArtifactGlyph kind={artifact.kind} /></div>
            <strong>{artifact.title}</strong>
            <small>{artifact.project} · {Math.round(artifact.emotion * 100)}% emotional weight</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const reduced = Boolean(useReducedMotion());
  const webgl = useMemo(() => supportsWebGL(), []);
  const [mode, setMode] = useState<SortMode>('time');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [galleryMode, setGalleryMode] = useState(() => !webgl || (typeof window !== 'undefined' && window.innerWidth < 560));
  const [archiveText, setArchiveText] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const artifacts = useMemo(() => arrangeArtifacts(mode), [mode]);
  const selected = museumArtifacts.find((artifact) => artifact.id === selectedId) ?? null;
  const timelineIndex = selected ? museumArtifacts.findIndex((artifact) => artifact.id === selected.id) : 0;

  const selectArtifact = (artifact: Artifact) => setSelectedId(artifact.id);

  const askArchive = async () => {
    const response = 'The turning point is not the launch screen. It is the Week 06 voice memo: “I want to follow the story of the project, not query a database about it.” The failed retrieval test directly precedes it, and the final light-thread interaction is its visible consequence.';
    setArchiveText('');
    setArchiveLoading(true);
    setSelectedId(4);
    await streamDeterministicText(response, {
      delay: reduced ? 0 : 17,
      chunkSize: reduced ? response.length : 5,
      onChunk: (chunk) => setArchiveText((current) => current + chunk),
    });
    setArchiveLoading(false);
  };

  const stepTimeline = (direction: -1 | 1) => {
    const current = selected ? museumArtifacts.findIndex((artifact) => artifact.id === selected.id) : 0;
    const next = Math.max(0, Math.min(museumArtifacts.length - 1, current + direction));
    setSelectedId(museumArtifacts[next].id);
  };

  return (
    <main className="museum-shell">
      {!galleryMode && webgl ? (
        <Suspense fallback={<div className="museum-loading"><SparklesIcon size={20} /><span>OPENING THE ARCHIVE</span><i /></div>}>
          <MemoryScene artifacts={artifacts} selectedId={selectedId} onSelect={selectArtifact} reduced={reduced} />
        </Suspense>
      ) : <GalleryFallback artifacts={artifacts} selectedId={selectedId} onSelect={selectArtifact} />}

      <header className="museum-header">
        <div className="museum-brand"><Circle size={12} fill="currentColor" /><div><strong>MEMORY MUSEUM</strong><span>A SPATIAL ARCHIVE CURATED BY AI</span></div></div>
        <div className="museum-room">ROOM 01 · PROJECT ORIGIN / RELEASE</div>
        <button className="view-toggle" onClick={() => setGalleryMode((current) => !current)} disabled={!webgl}>{galleryMode ? <Move3d size={14} /> : <GalleryHorizontal size={14} />}{galleryMode ? 'ENTER SPACE' : '2D GALLERY'}</button>
      </header>

      <div className="museum-instruction"><MousePointer2 size={11} /><span>{galleryMode ? 'SWIPE THE ARCHIVE' : 'DRAG TO LOOK · SCROLL TO MOVE · SELECT AN EXHIBIT'}</span></div>

      <nav className="curation-modes" aria-label="Archive arrangement">
        <span>ARRANGE BY</span>
        <button className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}><CalendarDays size={12} />Time</button>
        <button className={mode === 'emotion' ? 'active' : ''} onClick={() => setMode('emotion')}><Heart size={12} />Emotion</button>
        <button className={mode === 'project' ? 'active' : ''} onClick={() => setMode('project')}><Layers3 size={12} />Project</button>
      </nav>

      <div className="archive-actions">
        <button onClick={askArchive}><MessageCircleQuestion size={15} />Ask the Archive</button>
      </div>

      <AnimatePresence>
        {archiveText || archiveLoading ? (
          <motion.aside className="curator-caption" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <div><SparklesIcon size={13} /><span>CURATOR / THREAD FOUND</span><button onClick={() => { setArchiveText(''); setArchiveLoading(false); }} aria-label="Close curator response"><X size={13} /></button></div>
            <p>{archiveText || 'Following the strongest narrative thread through the archive…'}{archiveLoading ? <i /> : null}</p>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selected ? (
          <motion.aside className="artifact-reveal" initial={{ opacity: 0, x: 42, rotateY: -8 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} exit={{ opacity: 0, x: 42 }} transition={{ duration: reduced ? 0 : .45, ease: [0.22, 1, 0.36, 1] }}>
            <button className="reveal-close" onClick={() => setSelectedId(null)} aria-label="Close exhibit"><X size={16} /></button>
            <div className="reveal-index">EXHIBIT 0{selected.id} / {selected.year}</div>
            <div className="reveal-symbol"><ArtifactGlyph kind={selected.kind} /></div>
            <span className="reveal-kind">{selected.kind.toUpperCase()} · {selected.project.toUpperCase()}</span>
            <h2>{selected.title}</h2>
            <p>{selected.body}</p>
            <div className="emotion-readout"><Heart size={12} /><span>EMOTIONAL WEIGHT</span><i><b style={{ width: `${selected.emotion * 100}%` }} /></i><strong>{Math.round(selected.emotion * 100)}</strong></div>
            <div className="reveal-foot"><ScanLine size={12} /><span>RELATED MEMORY THREADS VISIBLE IN SPACE</span></div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <footer className="museum-timeline">
        <button onClick={() => stepTimeline(-1)} disabled={timelineIndex === 0} aria-label="Previous memory"><ChevronLeft size={16} /></button>
        <div className="timeline-center">
          <div className="timeline-meta"><span>PROJECT TIMELINE</span><b>{selected ? selected.year : 'Week 01 — Week 12'}</b></div>
          <div className="timeline-line">
            {museumArtifacts.map((artifact, index) => <button key={artifact.id} className={selected?.id === artifact.id ? 'active' : ''} onClick={() => setSelectedId(artifact.id)} aria-label={`Open ${artifact.title}`}><i /><span>{index === 0 || index === museumArtifacts.length - 1 ? artifact.year : ''}</span></button>)}
            <motion.div className="timeline-progress" animate={{ width: `${((selected ? timelineIndex : 0) / (museumArtifacts.length - 1)) * 100}%` }} transition={{ duration: reduced ? 0 : .5 }} />
          </div>
        </div>
        <button onClick={() => stepTimeline(1)} disabled={timelineIndex === museumArtifacts.length - 1} aria-label="Next memory"><ChevronRight size={16} /></button>
      </footer>
    </main>
  );
}
