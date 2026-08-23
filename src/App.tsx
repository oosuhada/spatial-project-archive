import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, RoundedBox, Sparkles as ThreeSparkles } from '@react-three/drei';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BookOpen, Boxes, CalendarDays, ChevronRight, Film, GalleryHorizontal, Heart, MessageCircleQuestion, Move3d, X } from 'lucide-react';
import type { Group } from 'three';
import { Vector3 } from 'three';
import { AmbientBackdrop, Eyebrow, GlassCard, GlowButton, PointerLight, StatusPill } from './lib/design-system';
import { museumArtifacts, streamDeterministicText } from './lib/mock-ai';
import { supportsWebGL } from './lib/shared';

type SortMode = 'time' | 'emotion' | 'project';

const projectOrder = { Origin: 0, Shape: 1, Break: 2, Release: 3 } as const;

function arrangeArtifacts(mode: SortMode) {
  const list = [...museumArtifacts];
  if (mode === 'emotion') list.sort((a, b) => b.emotion - a.emotion);
  if (mode === 'project') list.sort((a, b) => projectOrder[a.project as keyof typeof projectOrder] - projectOrder[b.project as keyof typeof projectOrder] || a.id - b.id);
  return list.map((artifact, index) => {
    const angle = (index / list.length) * Math.PI * 1.7 - Math.PI * .85;
    const radius = mode === 'emotion' ? 4.6 + (1 - artifact.emotion) * 2.1 : 5.2;
    return {
      ...artifact,
      position: [Math.sin(angle) * radius, (index % 2) * .65 - .2, Math.cos(angle) * radius - .8] as [number, number, number],
    };
  });
}

function CameraGuide({ selectedPosition }: { selectedPosition: [number, number, number] | null }) {
  const { camera } = useThree();
  const target = useRef(new Vector3(0, 1.4, 10));

  useEffect(() => {
    if (selectedPosition) target.current.set(selectedPosition[0] * .42, 1.65, selectedPosition[2] + 4.4);
    else target.current.set(0, 1.5, 10.5);
  }, [selectedPosition]);

  useFrame(() => {
    camera.position.lerp(target.current, .035);
    camera.lookAt(0, .55, -1.2);
  });
  return null;
}

function Exhibit({ artifact, position, selected, onSelect }: { artifact: (typeof museumArtifacts)[number]; position: [number, number, number]; selected: boolean; onSelect: () => void }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * .5 + artifact.id) * .05;
  });

  return (
    <group ref={group} position={position}>
      <RoundedBox args={[2.25, 1.45, .12]} radius={.08} smoothness={4} onClick={onSelect}>
        <meshPhysicalMaterial color={selected ? '#ffb7cf' : '#b9a6c3'} roughness={.22} metalness={.08} transparent opacity={selected ? .34 : .17} transmission={.48} thickness={.3} />
      </RoundedBox>
      <mesh position={[0, 0, -.11]}>
        <planeGeometry args={[2.05, 1.25]} />
        <meshBasicMaterial color={artifact.kind === 'experiment' ? '#3e1f2f' : artifact.kind === 'screen' ? '#293e46' : '#312d36'} transparent opacity={.82} />
      </mesh>
      <Html transform position={[0, 0, .11]} distanceFactor={6.5} style={{ pointerEvents: 'none' }}>
        <div className={`spatial-card ${selected ? 'selected' : ''}`}>
          <span>{artifact.year} · {artifact.kind}</span>
          <strong>{artifact.title}</strong>
          <p>{artifact.body.slice(0, 94)}…</p>
        </div>
      </Html>
      <pointLight intensity={selected ? 6 : 2} distance={3.2} color={artifact.emotion > .7 ? '#ffc0d7' : '#9fd7ff'} position={[0, .2, .7]} />
    </group>
  );
}

function MuseumScene({ mode, selectedId, onSelect }: { mode: SortMode; selectedId: number | null; onSelect: (id: number) => void }) {
  const arranged = useMemo(() => arrangeArtifacts(mode), [mode]);
  const selected = arranged.find((item) => item.id === selectedId);
  const points = arranged.map((item) => item.position);

  return (
    <>
      <color attach="background" args={['#080609']} />
      <fog attach="fog" args={['#080609', 9, 24]} />
      <ambientLight intensity={.6} />
      <pointLight position={[0, 7, 4]} intensity={12} color="#f3d8ff" />
      <CameraGuide selectedPosition={selected?.position ?? null} />
      <group>
        {arranged.map((artifact) => <Exhibit key={artifact.id} artifact={artifact} position={artifact.position} selected={artifact.id === selectedId} onSelect={() => onSelect(artifact.id)} />)}
        <Line points={points} color="#eab7ff" transparent opacity={.17} lineWidth={1} />
        <Line points={arranged.filter((item) => item.project === 'Break' || item.project === 'Release').map((item) => item.position)} color="#8ceaff" transparent opacity={.23} lineWidth={1.2} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#0d0a0e" roughness={.9} metalness={.1} />
      </mesh>
      <ThreeSparkles count={85} scale={[16, 6, 16]} size={1} speed={.12} opacity={.18} />
      <OrbitControls enablePan={false} minDistance={7} maxDistance={15} minPolarAngle={.65} maxPolarAngle={1.7} autoRotate={!selectedId} autoRotateSpeed={.16} />
    </>
  );
}

export function App() {
  const [mode, setMode] = useState<SortMode>('time');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [galleryMode, setGalleryMode] = useState(() => !supportsWebGL());
  const [archiveAnswer, setArchiveAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const selectedArtifact = museumArtifacts.find((item) => item.id === selectedId) ?? null;
  const sorted = useMemo(() => arrangeArtifacts(mode), [mode]);

  const askArchive = async () => {
    setAsking(true);
    setArchiveAnswer('');
    const target = mode === 'emotion' ? museumArtifacts[5] : museumArtifacts[3];
    setSelectedId(target.id);
    const answer = `I brought you to “${target.title}.” This artifact is a hinge in the collection: the product stopped behaving like search and started behaving like a story. Notice how it connects the failed retrieval test to the final launch surface.`;
    await streamDeterministicText(answer, { delay: 17, chunkSize: 4, onChunk: (chunk) => setArchiveAnswer((current) => current + chunk) });
    setAsking(false);
  };

  return (
    <main className="museum-shell">
      <AmbientBackdrop accent="255 154 200" />
      <PointerLight />
      <header className="museum-header">
        <div className="museum-brand"><a href="http://localhost:3100" aria-label="Back to launcher"><ArrowLeft size={16} /></a><div><strong>AI Memory Museum</strong><span>A spatial archive curated by AI</span></div></div>
        <div className="museum-header-actions"><StatusPill status="ready">Curated sample collection · 6 artifacts</StatusPill><button onClick={() => setGalleryMode((value) => !value)}><GalleryHorizontal size={13} />{galleryMode ? 'Enter 3D' : '2D Gallery'}</button></div>
      </header>

      <section className="museum-intro">
        <div><Eyebrow>Walk through what changed you</Eyebrow><h1>Your documents become <em>a place with memory.</em></h1></div>
        <p>AI interprets notes, failed experiments, feedback, and launch artifacts as a spatial narrative—linked by time, emotion, and meaning.</p>
      </section>

      <section className="museum-controls">
        <div className="sort-group">
          <span>Curate by</span>
          <button className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}><CalendarDays size={12} /> Time</button>
          <button className={mode === 'emotion' ? 'active' : ''} onClick={() => setMode('emotion')}><Heart size={12} /> Emotion</button>
          <button className={mode === 'project' ? 'active' : ''} onClick={() => setMode('project')}><Boxes size={12} /> Project</button>
        </div>
        <GlowButton onClick={askArchive} disabled={asking}>Ask the Archive</GlowButton>
      </section>

      <GlassCard className="museum-stage" intensity="clear">
        {!galleryMode ? (
          <div className="canvas-wrap">
            <Canvas camera={{ position: [0, 1.6, 10.5], fov: 46 }} dpr={[1, 1.5]}>
              <Suspense fallback={null}><MuseumScene mode={mode} selectedId={selectedId} onSelect={setSelectedId} /></Suspense>
            </Canvas>
            <div className="spatial-hint"><Move3d size={13} /><span>Drag to orbit · scroll to move closer · click an exhibit</span></div>
            <div className="museum-depth-label"><span>Collection 01</span><strong>From retrieval to narrative</strong></div>
          </div>
        ) : (
          <div className="gallery-fallback">
            {sorted.map((artifact, index) => (
              <motion.button layout key={artifact.id} onClick={() => setSelectedId(artifact.id)} className={selectedId === artifact.id ? 'selected' : ''}>
                <span>0{index + 1} · {artifact.year}</span><strong>{artifact.title}</strong><p>{artifact.body}</p><i style={{ '--emotion': artifact.emotion } as React.CSSProperties} />
              </motion.button>
            ))}
          </div>
        )}

        <div className="timeline-scrubber">
          <div><Film size={12} /><span>Project timeline</span></div>
          <input aria-label="Project timeline" type="range" min="0" max={museumArtifacts.length - 1} step="1" value={selectedId ? museumArtifacts.findIndex((item) => item.id === selectedId) : 0} onChange={(event) => setSelectedId(museumArtifacts[Number(event.target.value)].id)} />
          <div className="timeline-labels"><span>First sketch</span><span>Launch</span><span>Reflection</span></div>
        </div>
      </GlassCard>

      <AnimatePresence>
        {selectedArtifact ? (
          <motion.aside className="artifact-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="artifact-sheet" initial={{ rotateY: -82, x: 100, opacity: 0 }} animate={{ rotateY: 0, x: 0, opacity: 1 }} exit={{ rotateY: 78, x: 80, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 190 }}>
              <GlassCard className="artifact-glass" intensity="clear">
                <button className="artifact-close" onClick={() => setSelectedId(null)} aria-label="Close artifact"><X size={16} /></button>
                <span className="artifact-index">Archive object · 0{selectedArtifact.id}</span>
                <div className="artifact-visual"><BookOpen size={32} /><motion.i animate={{ x: ['-120%', '180%'] }} transition={{ duration: 4.6, repeat: Infinity, ease: 'linear' }} /></div>
                <span className="artifact-meta">{selectedArtifact.year} · {selectedArtifact.project} · {selectedArtifact.kind}</span>
                <h2>{selectedArtifact.title}</h2>
                <p>{selectedArtifact.body}</p>
                <div className="emotion-meter"><span>Emotional intensity</span><div><motion.i initial={{ width: 0 }} animate={{ width: `${selectedArtifact.emotion * 100}%` }} /></div><strong>{Math.round(selectedArtifact.emotion * 100)}</strong></div>
                {archiveAnswer ? <div className="curator-note"><span><MessageCircleQuestion size={12} /> Curator</span><p>{archiveAnswer}<i className={asking ? 'typing' : ''} /></p></div> : null}
                <button className="next-artifact" onClick={() => setSelectedId(selectedArtifact.id === museumArtifacts.length ? 1 : selectedArtifact.id + 1)}>Follow the light thread <ChevronRight size={14} /></button>
              </GlassCard>
            </motion.div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
