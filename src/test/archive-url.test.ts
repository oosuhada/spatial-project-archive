import assert from 'node:assert/strict';
import test from 'node:test';
import { archivePath, parseArchiveId, parseArtifactId } from '../routes/archive-url.ts';

test('archive deep link preserves archive and artifact identifiers', () => {
  const path = archivePath('archive 01', 'artifact/02');
  const url = new URL(path, 'http://localhost:3104');
  assert.equal(parseArchiveId(url.pathname), 'archive 01');
  assert.equal(parseArtifactId(url.search), 'artifact/02');
});

test('archive path can represent the room without a selected artifact', () => {
  assert.equal(archivePath('abc'), '/archives/abc');
  assert.equal(parseArtifactId(''), null);
});

