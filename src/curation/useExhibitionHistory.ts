import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpatialPosition } from '../schemas/archive';

function clonePositions(positions: SpatialPosition[]): SpatialPosition[] {
  return positions.map((position) => ({ ...position }));
}

export function useExhibitionHistory(initial: SpatialPosition[]) {
  const [positions, setPositions] = useState(() => clonePositions(initial));
  const history = useRef<SpatialPosition[][]>([clonePositions(initial)]);
  const index = useRef(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const next = clonePositions(initial);
    setPositions(next);
    history.current = [next];
    index.current = 0;
    setVersion((current) => current + 1);
  }, [initial]);

  const commit = useCallback((next: SpatialPosition[]) => {
    const snapshot = clonePositions(next);
    history.current = history.current.slice(0, index.current + 1);
    history.current.push(snapshot);
    index.current += 1;
    setPositions(snapshot);
    setVersion((current) => current + 1);
  }, []);

  const replace = useCallback((next: SpatialPosition[]) => {
    setPositions(clonePositions(next));
  }, []);

  const undo = useCallback(() => {
    if (index.current <= 0) return;
    index.current -= 1;
    setPositions(clonePositions(history.current[index.current]));
    setVersion((current) => current + 1);
  }, []);

  const redo = useCallback(() => {
    if (index.current >= history.current.length - 1) return;
    index.current += 1;
    setPositions(clonePositions(history.current[index.current]));
    setVersion((current) => current + 1);
  }, []);

  return {
    positions,
    commit,
    replace,
    undo,
    redo,
    canUndo: index.current > 0,
    canRedo: index.current < history.current.length - 1,
    historyVersion: version,
  };
}

