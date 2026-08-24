export type ArtifactType =
  | 'image'
  | 'pdf'
  | 'markdown'
  | 'text'
  | 'audio'
  | 'video'
  | 'url'
  | 'note';

export type PrivacyState = 'private' | 'shared';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type SortMode = 'time' | 'emotion' | 'project';

export type Archive = {
  id: string;
  title: string;
  description: string;
  privacy: PrivacyState;
  created_at: string;
  updated_at: string;
};

export type Artifact = {
  id: string;
  archive_id: string;
  title: string;
  type: ArtifactType;
  source: string;
  created_at: string;
  project_phase: string;
  emotion: number;
  people: string[];
  tags: string[];
  description: string;
  transcript: string;
  provenance: string;
  privacy: PrivacyState;
  file_hash: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  mime_type: string | null;
  original_filename: string | null;
  file_size: number;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  curator_interpretation: string;
  human_edit: string;
};

export type Relationship = {
  id: string;
  archive_id: string;
  source_artifact_id: string;
  target_artifact_id: string;
  kind: string;
  label: string;
  strength: number;
};

export type SpatialPosition = {
  artifact_id: string;
  x: number;
  y: number;
  z: number;
  rotation_y: number;
  scale: number;
  zone: string;
  sequence: number;
  camera_stop: boolean;
};

export type ExhibitionVersion = {
  id: string;
  archive_id: string;
  name: string;
  lighting_preset: 'nocturne' | 'dawn' | 'paper' | 'quiet';
  positions: SpatialPosition[];
  created_at: string;
};

export type CuratorCitation = {
  artifact_id: string;
  title: string;
};

export type CuratorResponse = {
  interpretation: string;
  cited_artifacts: CuratorCitation[];
  pivotal_moment: string;
  contradiction: string;
  missing_context: string;
  suggested_route: string[];
  provider: string;
};

export type SearchFilters = {
  q?: string;
  project_phase?: string;
  emotion_min?: number;
  type?: ArtifactType | '';
  person?: string;
  tag?: string;
};

export type ShareLink = {
  id: string;
  archive_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  url: string;
};

export type ArchiveSnapshot = {
  archive: Archive;
  artifacts: Artifact[];
  relationships: Relationship[];
  positions: SpatialPosition[];
  version: ExhibitionVersion | null;
};

