import type { Artifact, CuratorResponse } from '../schemas/archive';

export function validateCuratorResponse(response: CuratorResponse, artifacts: Artifact[]): CuratorResponse {
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  const cited = response.cited_artifacts.filter((citation) => artifactIds.has(citation.artifact_id));
  const route = response.suggested_route.filter((id) => artifactIds.has(id));
  return {
    ...response,
    cited_artifacts: cited,
    suggested_route: route,
  };
}

export function citationLabel(artifactId: string, artifacts: Artifact[]): string {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId);
  return artifact ? artifact.title : artifactId;
}

