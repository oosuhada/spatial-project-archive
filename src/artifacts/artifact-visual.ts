import type { Artifact } from '../schemas/archive';

const accents: Record<Artifact['type'], string> = {
  image: '#d9b27e',
  pdf: '#c8a18d',
  markdown: '#9fb9c7',
  text: '#a8b7b1',
  audio: '#b99fc7',
  video: '#d2a7a0',
  url: '#8fb6be',
  note: '#c8bd8f',
};

export function artifactAccent(artifact: Artifact): string {
  return accents[artifact.type] ?? '#cbbda8';
}

export function artifactDateLabel(artifact: Artifact): string {
  const date = new Date(artifact.created_at);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

