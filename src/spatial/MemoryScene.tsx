import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Grid, Html, Line, RoundedBox, Sparkles } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Box3, Vector3 } from 'three';
import type { Artifact, ExhibitionVersion, Relationship, SpatialPosition } from '../schemas/archive';
import { artifactAccent, artifactDateLabel } from '../artifacts/artifact-visual';

type SceneProps = {
  artifacts: Artifact[];
  positions: SpatialPosition[];
  relationships: Relationship[];
  selectedId: string | null;
  onSelect: (artifact: Artifact) => void;
  reduced: boolean;
  lowPower: boolean;
  active: boolean;
  lightingPreset: ExhibitionVersion['lighting_preset'];
  focusIds?: string[];
  onContextLost?: () => void;
};

type SpatialArtifactProps = {
  artifact: Artifact;
  position: SpatialPosition;
  selected: boolean;
  onSelect: (artifact: Artifact) => void;
  reduced: boolean;
  lowPower: boolean;
};

const dimensionsByType: Partial<Record<Artifact['type'], [number, number, number]>> = {
  image: [1.8, 1.24, 0.09],
  video: [1.8, 1.08, 0.09],
  pdf: [1.35, 1.72, 0.08],
  markdown: [1.35, 1.62, 0.08],
  text: [1.35, 1.62, 0.08],
  audio: [1.65, 1.05, 0.09],
  note: [1.32, 1.42, 0.08],
  url: [1.55, 1.12, 0.08],
};

function SpatialArtifact({ artifact, position, selected, onSelect, reduced, lowPower }: SpatialArtifactProps) {
  const [hovered, setHovered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const accent = artifactAccent(artifact);
  const dimensions = dimensionsByType[artifact.type] ?? [1.45, 1.4, 0.08];
  const visualScale: [number, number, number] = [
    dimensions[0] * position.scale,
    dimensions[1] * position.scale,
    dimensions[2],
  ];

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, position.rotation_y, 0]}
    >
      {selected ? (
        <RoundedBox args={[visualScale[0] * 1.06, visualScale[1] * 1.06, 0.06]} radius={0.045} smoothness={3} position={[0, 0, -0.04]}>
          <meshBasicMaterial color={accent} transparent opacity={0.32} />
        </RoundedBox>
      ) : null}
      <RoundedBox
        args={visualScale}
        radius={0.04}
        smoothness={3}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(artifact);
        }}
      >
        <meshPhysicalMaterial
          color={selected ? '#3f3835' : hovered ? '#312d2c' : '#242326'}
          emissive={accent}
          emissiveIntensity={selected ? 0.22 : hovered ? 0.12 : 0.045}
          metalness={0.12}
          roughness={0.48}
          clearcoat={0.55}
          clearcoatRoughness={0.35}
        />
      </RoundedBox>

      <Html
        transform
        occlude={false}
        distanceFactor={7.5}
        position={[0, 0, 0.09]}
        className="spatial-artifact-html"
      >
        <button
          type="button"
          className={`spatial-artifact-card ${selected ? 'selected' : ''}`}
          style={{ '--artifact-accent': accent } as React.CSSProperties}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(artifact);
          }}
        >
          {artifact.thumbnail_url && !imageFailed ? (
            <img src={artifact.thumbnail_url} alt="" onError={() => setImageFailed(true)} />
          ) : (
            <span className="spatial-artifact-kind">{artifact.type}</span>
          )}
          <span className="spatial-artifact-date">{artifactDateLabel(artifact)}</span>
          <strong>{artifact.title}</strong>
          <small>{artifact.project_phase}</small>
        </button>
      </Html>

      {!reduced && !lowPower && selected ? (
        <Sparkles count={12} scale={[2.2, 2.2, 1.4]} size={1.2} speed={0.12} color={accent} opacity={0.44} />
      ) : null}
    </group>
  );
}

function SceneContents({
  artifacts,
  positions,
  relationships,
  selectedId,
  onSelect,
  reduced,
  lowPower,
  lightingPreset,
  focusIds = [],
}: Omit<SceneProps, 'active' | 'onContextLost'>) {
  const controls = useRef<any>(null);
  const positionById = useMemo(() => new Map(positions.map((position) => [position.artifact_id, position])), [positions]);
  const selectedPosition = selectedId ? positionById.get(selectedId) ?? null : null;
  const focusPositions = useMemo(() => focusIds.map((id) => positionById.get(id)).filter((position): position is SpatialPosition => Boolean(position)), [focusIds, positionById]);

  useEffect(() => {
    const boundary = new Box3(new Vector3(-8, -2.5, -13), new Vector3(8, 5.5, 6.5));
    controls.current?.setBoundary?.(boundary);
  }, []);

  useEffect(() => {
    if (!controls.current) return;
    if (focusPositions.length > 1) {
      const minX = Math.min(...focusPositions.map((position) => position.x));
      const maxX = Math.max(...focusPositions.map((position) => position.x));
      const minY = Math.min(...focusPositions.map((position) => position.y));
      const maxY = Math.max(...focusPositions.map((position) => position.y));
      const minZ = Math.min(...focusPositions.map((position) => position.z));
      const maxZ = Math.max(...focusPositions.map((position) => position.z));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const span = Math.max(2.4, maxX - minX, maxY - minY, maxZ - minZ);
      controls.current.setLookAt(centerX + span * .16, centerY + span * .12, centerZ + 4.2 + span * .7, centerX, centerY, centerZ, !reduced);
      return;
    }
    if (selectedPosition) {
      controls.current.setLookAt(
        selectedPosition.x + 0.35,
        Math.max(selectedPosition.y + 0.35, 0.3),
        selectedPosition.z + 3.35,
        selectedPosition.x,
        selectedPosition.y,
        selectedPosition.z,
        !reduced,
      );
      return;
    }
    controls.current.setLookAt(0, 1.25, 9.2, 0, 0.2, -2.2, !reduced);
  }, [focusPositions, reduced, selectedPosition]);

  const light = lightingPreset === 'dawn'
    ? { warm: '#f2cfad', cool: '#9cc6d7', ambient: 0.7 }
    : lightingPreset === 'paper'
      ? { warm: '#f1dfc8', cool: '#c7d1c8', ambient: 0.82 }
      : lightingPreset === 'quiet'
        ? { warm: '#cbbcae', cool: '#91a4b2', ambient: 0.48 }
        : { warm: '#e2bd94', cool: '#93b5c9', ambient: 0.55 };

  return (
    <>
      <color attach="background" args={['#0b0b0e']} />
      <fog attach="fog" args={['#0b0b0e', 10, 25]} />
      <ambientLight intensity={0.18 + light.ambient * 0.16} />
      <hemisphereLight intensity={light.ambient} color="#dfe7ed" groundColor="#241d1e" />
      <spotLight position={[-6, 8, 6]} intensity={42} angle={0.32} penumbra={1} color={light.warm} />
      <spotLight position={[7, 5, -2]} intensity={30} angle={0.34} penumbra={1} color={light.cool} />
      <pointLight position={[0, -1, 1]} intensity={8} color="#a99ac1" />

      <Grid
        position={[0, -2.18, -3]}
        args={[17, 20]}
        cellSize={1}
        cellThickness={0.35}
        cellColor="#48444b"
        sectionSize={4}
        sectionThickness={0.7}
        sectionColor="#6f625d"
        fadeDistance={18}
        fadeStrength={1.4}
        infiniteGrid={false}
      />

      {artifacts.map((artifact) => {
        const position = positionById.get(artifact.id);
        if (!position) return null;
        return (
          <SpatialArtifact
            key={artifact.id}
            artifact={artifact}
            position={position}
            selected={selectedId === artifact.id}
            onSelect={onSelect}
            reduced={reduced}
            lowPower={lowPower}
          />
        );
      })}

      {relationships.map((relationship) => {
        const source = positionById.get(relationship.source_artifact_id);
        const target = positionById.get(relationship.target_artifact_id);
        if (!source || !target) return null;
        const highlighted = selectedId === source.artifact_id || selectedId === target.artifact_id;
        return (
          <Line
            key={relationship.id}
            points={[[source.x, source.y, source.z], [target.x, target.y, target.z]]}
            color={highlighted ? '#ead0ae' : '#8a7e7a'}
            lineWidth={highlighted ? 1.15 : 0.45}
            transparent
            opacity={highlighted ? 0.62 : 0.24 + relationship.strength * 0.12}
          />
        );
      })}

      <Sparkles
        count={reduced || lowPower ? 22 : 90}
        scale={[18, 9, 18]}
        size={0.65}
        speed={reduced || lowPower ? 0 : 0.045}
        opacity={lowPower ? 0.08 : 0.14}
        color="#e7dfd5"
      />
      <CameraControls
        ref={controls}
        smoothTime={reduced ? 0.01 : 0.42}
        minDistance={2.65}
        maxDistance={15}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.78}
        dollySpeed={0.38}
        truckSpeed={0.48}
        makeDefault
      />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.48} luminanceSmoothing={0.88} intensity={lowPower ? 0.24 : 0.42} mipmapBlur={!lowPower} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={lowPower ? 0.05 : 0.1} />
        <Vignette eskil={false} offset={0.16} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

export function MemoryScene(props: SceneProps) {
  return (
    <Suspense fallback={<div className="scene-loading">Preparing spatial archive…</div>}>
      <Canvas
        camera={{ position: [0, 1.25, 9.2], fov: 46, near: 0.1, far: 45 }}
        dpr={props.lowPower ? [1, 1.08] : [1, 1.5]}
        frameloop={props.active ? 'always' : 'never'}
        gl={{ antialias: !props.lowPower, alpha: false, powerPreference: props.lowPower ? 'low-power' : 'high-performance' }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          const onLost = (event: Event) => {
            event.preventDefault();
            props.onContextLost?.();
          };
          canvas.addEventListener('webglcontextlost', onLost, { once: true });
        }}
      >
        <SceneContents {...props} />
      </Canvas>
    </Suspense>
  );
}

