import type {
  Archive,
  ArchiveSnapshot,
  Artifact,
  CuratorResponse,
  ExhibitionVersion,
  Relationship,
  SearchFilters,
  ShareLink,
  SpatialPosition,
} from '../schemas/archive';

const API_ROOT = import.meta.env.VITE_API_ROOT ?? '/api';

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Request failed with status ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, init);
  if (!response.ok) {
    let detail: unknown = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? body;
    } catch {
      detail = response.statusText;
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export const archiveApi = {
  listArchives: () => request<Archive[]>('/archives'),
  createArchive: (payload: { title: string; description?: string }) =>
    request<Archive>('/archives', jsonInit('POST', payload)),
  getSnapshot: (archiveId: string) => request<ArchiveSnapshot>(`/archives/${archiveId}/snapshot`),
  updateArchive: (archiveId: string, payload: Partial<Pick<Archive, 'title' | 'description' | 'privacy'>>) =>
    request<Archive>(`/archives/${archiveId}`, jsonInit('PATCH', payload)),
  deleteArchive: (archiveId: string) => request<void>(`/archives/${archiveId}`, { method: 'DELETE' }),
  exportArchive: (archiveId: string) => request<Record<string, unknown>>(`/archives/${archiveId}/export`),

  importFile: async (
    archiveId: string,
    file: File,
    metadata: Record<string, string | number | string[]>,
    onProgress?: (percent: number) => void,
  ): Promise<Artifact> => {
    const form = new FormData();
    form.append('file', file);
    form.append('metadata', JSON.stringify(metadata));

    return new Promise<Artifact>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_ROOT}/archives/${archiveId}/artifacts/upload`);
      xhr.responseType = 'json';
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable || !onProgress) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as Artifact);
          return;
        }
        reject(new ApiError(xhr.status, xhr.response?.detail ?? xhr.statusText));
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'Network error during upload')));
      xhr.send(form);
    });
  },

  createManualArtifact: (archiveId: string, payload: Record<string, unknown>) =>
    request<Artifact>(`/archives/${archiveId}/artifacts`, jsonInit('POST', payload)),
  updateArtifact: (artifactId: string, payload: Partial<Artifact>) =>
    request<Artifact>(`/artifacts/${artifactId}`, jsonInit('PATCH', payload)),
  retryArtifact: (artifactId: string) => request<Artifact>(`/artifacts/${artifactId}/retry`, { method: 'POST' }),
  deleteArtifact: (artifactId: string) => request<void>(`/artifacts/${artifactId}`, { method: 'DELETE' }),

  createRelationship: (archiveId: string, payload: Omit<Relationship, 'id' | 'archive_id'>) =>
    request<Relationship>(`/archives/${archiveId}/relationships`, jsonInit('POST', payload)),
  deleteRelationship: (relationshipId: string) => request<void>(`/relationships/${relationshipId}`, { method: 'DELETE' }),

  saveLayout: (
    archiveId: string,
    payload: { name: string; lighting_preset: ExhibitionVersion['lighting_preset']; positions: SpatialPosition[] },
  ) => request<ExhibitionVersion>(`/archives/${archiveId}/exhibitions`, jsonInit('POST', payload)),

  askCurator: (archiveId: string, question: string, selectedArtifactId?: string | null) =>
    request<CuratorResponse>(`/archives/${archiveId}/curator`, jsonInit('POST', {
      question,
      selected_artifact_id: selectedArtifactId ?? null,
    })),

  search: (archiveId: string, filters: SearchFilters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === '' || value === undefined || value === null) return;
      params.set(key, String(value));
    });
    return request<Artifact[]>(`/archives/${archiveId}/search?${params.toString()}`);
  },

  createShare: (archiveId: string) => request<ShareLink>(`/archives/${archiveId}/shares`, { method: 'POST' }),
  revokeShare: (shareId: string) => request<ShareLink>(`/shares/${shareId}/revoke`, { method: 'POST' }),
  getSharedSnapshot: (token: string) => request<ArchiveSnapshot>(`/shared/${encodeURIComponent(token)}/snapshot`),
};

