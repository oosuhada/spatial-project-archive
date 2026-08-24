import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCuratorResponse } from '../curation/curator-citations.ts';
import type { Artifact, CuratorResponse } from '../schemas/archive.ts';

const artifact = {
  id: 'known', archive_id: 'archive', title: 'Known source', type: 'note', source: '', created_at: '2026-01-01T00:00:00Z',
  project_phase: 'Origin', emotion: 0.5, people: [], tags: [], description: '', transcript: '', provenance: '', privacy: 'private',
  file_hash: null, thumbnail_url: null, media_url: null, mime_type: null, original_filename: null, file_size: 0,
  processing_status: 'ready', processing_error: null, curator_interpretation: '', human_edit: '',
} satisfies Artifact;

test('curator validation drops citations and route stops that do not exist', () => {
  const response: CuratorResponse = {
    interpretation: 'Interpretation',
    cited_artifacts: [{ artifact_id: 'known', title: 'Known source' }, { artifact_id: 'invented', title: 'Invented' }],
    pivotal_moment: 'Known', contradiction: 'None', missing_context: 'More context', suggested_route: ['known', 'invented'], provider: 'test',
  };
  const validated = validateCuratorResponse(response, [artifact]);
  assert.deepEqual(validated.cited_artifacts.map((citation) => citation.artifact_id), ['known']);
  assert.deepEqual(validated.suggested_route, ['known']);
});

