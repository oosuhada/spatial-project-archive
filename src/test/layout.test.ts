import assert from 'node:assert/strict';
import test from 'node:test';
import { clampSpatialPosition, createAutomaticPositions, mergeStoredPositions } from '../spatial/layout.ts';
import type { Artifact, SpatialPosition } from '../schemas/archive.ts';

const artifacts: Artifact[] = [
  {
    id: 'a', archive_id: 'archive', title: 'Origin', type: 'note', source: '', created_at: '2026-01-01T00:00:00Z',
    project_phase: 'Origin', emotion: 0.2, people: [], tags: [], description: '', transcript: '', provenance: '',
    privacy: 'private', file_hash: null, thumbnail_url: null, media_url: null, mime_type: null, original_filename: null,
    file_size: 0, processing_status: 'ready', processing_error: null, curator_interpretation: '', human_edit: '',
  },
  {
    id: 'b', archive_id: 'archive', title: 'Release', type: 'image', source: '', created_at: '2026-02-01T00:00:00Z',
    project_phase: 'Release', emotion: 0.9, people: [], tags: [], description: '', transcript: '', provenance: '',
    privacy: 'shared', file_hash: null, thumbnail_url: null, media_url: null, mime_type: null, original_filename: null,
    file_size: 0, processing_status: 'ready', processing_error: null, curator_interpretation: '', human_edit: '',
  },
];

test('time arrangement follows chronology', () => {
  const positions = createAutomaticPositions([...artifacts].reverse(), 'time');
  assert.equal(positions[0].artifact_id, 'a');
  assert.equal(positions[1].artifact_id, 'b');
});

test('emotion arrangement places the strongest artifact first in sequence', () => {
  const positions = createAutomaticPositions(artifacts, 'emotion');
  assert.equal(positions[0].artifact_id, 'b');
  assert.equal(positions[0].sequence, 0);
});

test('stored authored positions win in time mode', () => {
  const stored: SpatialPosition[] = [{
    artifact_id: 'a', x: 7, y: 1, z: -9, rotation_y: 0.5, scale: 1.4, zone: 'Custom', sequence: 2, camera_stop: false,
  }];
  const positions = mergeStoredPositions(artifacts, stored, 'time');
  const authored = positions.find((position) => position.artifact_id === 'a');
  assert.equal(authored?.x, 7);
  assert.equal(authored?.zone, 'Custom');
  assert.equal(authored?.camera_stop, false);
});

test('spatial clamp keeps objects inside the authored room budget', () => {
  const clamped = clampSpatialPosition({
    artifact_id: 'a', x: 99, y: -99, z: 99, rotation_y: 0, scale: 99, zone: 'Room', sequence: 0, camera_stop: true,
  });
  assert.equal(clamped.x, 7.5);
  assert.equal(clamped.y, -2.2);
  assert.equal(clamped.z, 4.5);
  assert.equal(clamped.scale, 2.1);
});

