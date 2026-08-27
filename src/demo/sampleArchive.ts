import { archiveApi } from '../api/client';
import type { Archive } from '../schemas/archive';

export const SAMPLE_ARCHIVE_TITLE = 'Example · Product evolution archive';

const artifacts = [
  ['Problem framing', '2026-01-12T09:00:00Z', 'Discovery', 'Project journal', 'The team starts with a narrow question: how can an AI-assisted workspace remain understandable when its outputs are generated, revised, and challenged over time?', 'I wanted the archive to preserve the question before preserving the solution.', 'Synthetic curator interpretation: the project begins by treating trust and comprehension as product constraints rather than polish.'],
  ['Research interview · analyst', '2026-01-24T10:30:00Z', 'Research', 'Synthetic interview', 'An analyst says an empty intelligent workspace feels intimidating because there is no example of what good work looks like.', 'This became the strongest argument for saved examples instead of an empty first-run screen.', 'Synthetic curator interpretation: the interview shifts onboarding from instruction toward inspectable examples.'],
  ['Research interview · product lead', '2026-02-02T14:00:00Z', 'Research', 'Synthetic interview', 'A product lead wants every consequential AI conclusion to retain a path back to the source and the human review state.', 'The key was not more AI; it was making the AI boundary visible.', 'Synthetic curator interpretation: provenance becomes a core domain property rather than an audit feature.'],
  ['Spatial navigation sketch', '2026-02-18T11:00:00Z', 'Concept', 'Design notebook', 'Early sketch exploring whether chronology, project phase, and relationships can be navigated as a spatial field instead of only a folder tree.', '', 'Synthetic curator interpretation: spatial layout is framed as a representation layer, not the archive database itself.'],
  ['First 3D prototype', '2026-03-06T16:00:00Z', 'Prototype', 'Prototype build', 'A cinematic room made the archive memorable, but artifacts were visually impressive before their relationships were understandable.', 'I liked the atmosphere, but it was too easy to confuse spectacle with navigation.', 'Synthetic curator interpretation: the prototype succeeds emotionally and fails informationally.'],
  ['Prototype failure retrospective', '2026-03-19T13:00:00Z', 'Prototype', 'Retrospective', 'Testing showed that users could not tell why two objects were connected or what changed between one project phase and the next.', 'This is where relationship lines and conventional 2D fallback became non-negotiable.', 'Synthetic curator interpretation: the failure directly creates the constellation and timeline interactions.'],
  ['Archive architecture decision', '2026-04-04T09:30:00Z', 'Architecture', 'Decision record', 'Keep source objects in object storage, metadata and relationships in the database, and all spatial coordinates as versioned presentation state.', 'Separating source truth from presentation made later experiments much safer.', 'Synthetic curator interpretation: the system deliberately prevents a spatial layout from becoming the source of truth.'],
  ['Import pipeline milestone', '2026-04-26T15:15:00Z', 'Build', 'Engineering log', 'Batch import, duplicate detection, processing state, derivative generation, and provenance editing turn the prototype into an archive workflow.', '', 'Synthetic curator interpretation: ingestion operations are the point where the project stops being merely a 3D demo.'],
  ['Interpretation boundary', '2026-05-11T12:00:00Z', 'Decision', 'Design decision', 'Human memory and curator interpretation are stored in separate fields and never overwrite the imported source record.', 'SOURCE ≠ HUMAN MEMORY ≠ AI INTERPRETATION became the simplest rule in the project.', 'Synthetic curator interpretation: a small data-model decision carries most of the archive’s trust philosophy.'],
  ['Onboarding redesign', '2026-05-29T10:00:00Z', 'UX', 'Product iteration', 'The first-run experience moves from a blank museum to a saved example archive with real relationships, chronology, source/human/AI layers, and an optional guided tour.', 'The product should explain itself by being populated, not by adding more explanatory copy.', 'Synthetic curator interpretation: onboarding becomes exploration of a functioning archive rather than a tutorial before the archive.'],
  ['Spatial lenses', '2026-06-14T17:00:00Z', 'UX', 'Interaction iteration', 'Constellation focus isolates the selected artifact neighborhood. Temporal excavation progressively reveals the project history and only the relationships that existed by that point.', '', 'Synthetic curator interpretation: the 3D view gains analytical purpose by exposing relationship and time structures.'],
  ['Production reflection', '2026-07-02T18:30:00Z', 'Release', 'Release note', 'The archive now supports real files, conventional search and 2D browsing, spatial curation, versioned exhibitions, human notes, curator output, privacy, sharing, and export.', 'The spatial mode is valuable because it is optional and because the underlying archive works without it.', 'Synthetic curator interpretation: the finished product treats cinematic spatial UI as one lens over a durable information system.'],
] as const;

export async function ensureSampleArchive(existing: Archive[]) {
  const found = existing.find((archive) => archive.title === SAMPLE_ARCHIVE_TITLE);
  if (found) return found;

  const archive = await archiveApi.createArchive({
    title: SAMPLE_ARCHIVE_TITLE,
    description: 'A saved synthetic project history for exploring chronology, relationships, source provenance, human memory, curator interpretation, and spatial curation before importing personal material.',
  });
  const created = [];
  for (const [title, createdAt, phase, source, description, humanEdit, curatorInterpretation] of artifacts) {
    const artifact = await archiveApi.createManualArtifact(archive.id, {
      title,
      type: 'note',
      source,
      created_at: createdAt,
      project_phase: phase,
      emotion: phase === 'Prototype' ? 0.42 : phase === 'Release' ? 0.9 : 0.68,
      tags: ['synthetic-example', phase.toLowerCase()],
      people: [],
      description,
      provenance: 'Synthetic example artifact created by the built-in sample archive bootstrap. It is not a record of a real customer or project event.',
      privacy: 'private',
    });
    if (humanEdit || curatorInterpretation) {
      await archiveApi.updateArtifact(artifact.id, {
        human_edit: humanEdit,
        curator_interpretation: curatorInterpretation,
      });
    }
    created.push(artifact);
  }

  for (let index = 0; index < created.length - 1; index += 1) {
    await archiveApi.createRelationship(archive.id, {
      source_artifact_id: created[index].id,
      target_artifact_id: created[index + 1].id,
      kind: 'informed',
      label: 'project progression',
      strength: 0.78,
    });
  }
  const crossLinks = [
    [1, 9, 'onboarding evidence'],
    [2, 8, 'trust principle'],
    [4, 5, 'prototype failure'],
    [5, 10, 'interaction response'],
    [6, 11, 'architecture carried forward'],
  ] as const;
  for (const [sourceIndex, targetIndex, label] of crossLinks) {
    await archiveApi.createRelationship(archive.id, {
      source_artifact_id: created[sourceIndex].id,
      target_artifact_id: created[targetIndex].id,
      kind: 'related',
      label,
      strength: 0.9,
    });
  }

  await archiveApi.saveLayout(archive.id, {
    name: 'Example evolution path',
    lighting_preset: 'nocturne',
    positions: created.map((artifact, index) => ({
      artifact_id: artifact.id,
      x: -5.4 + (index % 4) * 3.6,
      y: Math.floor(index / 4) * 1.7 - 1.5,
      z: -Math.floor(index / 4) * 3.2 + (index % 2) * -0.7,
      rotation_y: (index % 4 - 1.5) * 0.08,
      scale: index === 5 || index === 8 || index === 10 ? 1.12 : 0.96,
      zone: artifacts[index][2],
      sequence: index + 1,
      camera_stop: true,
    })),
  });
  return archive;
}
