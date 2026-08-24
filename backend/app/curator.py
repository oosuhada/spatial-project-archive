from __future__ import annotations

import json
from typing import Protocol

import httpx

from .config import settings
from .models import Artifact


class CuratorProvider(Protocol):
    name: str

    def interpret(self, artifacts: list[Artifact], question: str, selected_artifact_id: str | None) -> dict:
        ...


def _artifact_context(artifact: Artifact) -> dict:
    return {
        'id': artifact.id,
        'title': artifact.title,
        'type': artifact.type,
        'source': artifact.source,
        'created_at': artifact.created_at.isoformat(),
        'project_phase': artifact.project_phase,
        'emotion': artifact.emotion,
        'description': artifact.description,
        'transcript': artifact.transcript[:4000],
        'provenance': artifact.provenance,
        'human_edit': artifact.human_edit,
    }


class DeterministicCurator:
    name = 'deterministic-fallback'

    def interpret(self, artifacts: list[Artifact], question: str, selected_artifact_id: str | None) -> dict:
        if not artifacts:
            return {
                'interpretation': 'This archive does not yet contain enough material to support an interpretation.',
                'cited_artifacts': [],
                'pivotal_moment': 'No pivotal moment can be established yet.',
                'contradiction': 'No contradiction can be established yet.',
                'missing_context': 'Import at least two artifacts with dates, provenance, or notes.',
                'suggested_route': [],
                'provider': self.name,
            }

        ordered = sorted(artifacts, key=lambda artifact: artifact.created_at)
        selected = next((artifact for artifact in artifacts if artifact.id == selected_artifact_id), None)
        pivotal = max(artifacts, key=lambda artifact: artifact.emotion)
        first = selected or ordered[0]
        final = ordered[-1]
        cited = []
        for artifact in [first, pivotal, final]:
            if artifact.id not in {item['artifact_id'] for item in cited}:
                cited.append({'artifact_id': artifact.id, 'title': artifact.title})

        interpretation = (
            f'For “{question}”, the strongest supported arc begins with “{first.title}”, '
            f'peaks around “{pivotal.title}”, and reaches its latest recorded state in “{final.title}”. '
            'This interpretation only uses imported metadata, transcripts, provenance, and human notes; it does not rewrite the source material.'
        )
        contradiction = (
            f'Compare “{first.title}” with “{final.title}”: their project phases and emotional weights may encode a shift, '
            'but the archive does not claim causality unless a relationship or note states it explicitly.'
        )
        missing = 'Add explicit relationships or human notes where the transition between these artifacts is not documented.'
        return {
            'interpretation': interpretation,
            'cited_artifacts': cited,
            'pivotal_moment': f'“{pivotal.title}” has the highest recorded emotional weight ({round(pivotal.emotion * 100)}%).',
            'contradiction': contradiction,
            'missing_context': missing,
            'suggested_route': [artifact.id for artifact in [first, pivotal, final] if artifact.id],
            'provider': self.name,
        }


class OpenAICompatibleCurator:
    name = 'openai-compatible'

    def interpret(self, artifacts: list[Artifact], question: str, selected_artifact_id: str | None) -> dict:
        if not settings.curator_base_url or not settings.curator_api_key or not settings.curator_model:
            raise RuntimeError('Curator provider configuration is incomplete')

        payload = {
            'model': settings.curator_model,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'You are an archival curator. Never alter or invent a memory. Every factual sentence must be supported by one or more artifact IDs. '
                        'Return JSON with interpretation, cited_artifacts[{artifact_id,title}], pivotal_moment, contradiction, missing_context, suggested_route[artifact_id].'
                    ),
                },
                {
                    'role': 'user',
                    'content': json.dumps({
                        'question': question,
                        'selected_artifact_id': selected_artifact_id,
                        'artifacts': [_artifact_context(artifact) for artifact in artifacts],
                    }, ensure_ascii=False),
                },
            ],
        }
        response = httpx.post(
            f'{settings.curator_base_url.rstrip("/")}/chat/completions',
            headers={'Authorization': f'Bearer {settings.curator_api_key}'},
            json=payload,
            timeout=45,
        )
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        parsed = json.loads(content)
        parsed['provider'] = self.name
        return parsed


def get_curator() -> CuratorProvider:
    if settings.curator_provider == 'openai-compatible':
        try:
            return OpenAICompatibleCurator()
        except Exception:
            return DeterministicCurator()
    return DeterministicCurator()
