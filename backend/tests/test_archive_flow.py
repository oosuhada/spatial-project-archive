import io
import os
import tempfile
import wave
from pathlib import Path

os.environ['DATABASE_URL'] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test.db'}"
os.environ['OBJECT_STORAGE_MODE'] = 'local'
os.environ['OBJECT_STORAGE_ROOT'] = str(Path(tempfile.mkdtemp()) / 'objects')
os.environ['CURATOR_PROVIDER'] = 'deterministic'
os.environ['PUBLIC_APP_ORIGIN'] = 'http://localhost:3104'

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


def make_image_bytes(image_format: str = 'PNG') -> bytes:
    buffer = io.BytesIO()
    Image.new('RGB', (240, 160), (110, 80, 70)).save(buffer, format=image_format)
    return buffer.getvalue()


def make_audio_bytes() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8000)
        output.writeframes(b'\x00\x00' * 8000)
    return buffer.getvalue()


def test_complete_archive_flow() -> None:
    with TestClient(app) as client:
        health = client.get('/api/health')
        assert health.status_code == 200

        archive = client.post('/api/archives', json={'title': 'Launch archive', 'description': 'Real project evidence'}).json()
        archive_id = archive['id']
        assert archive['privacy'] == 'private'

        image_bytes = make_image_bytes()
        upload = client.post(
            f'/api/archives/{archive_id}/artifacts/upload',
            data={'metadata': '{"title":"Launch frame","project_phase":"Release","emotion":0.9,"privacy":"shared","tags":["launch"]}'},
            files={'file': ('launch.png', image_bytes, 'image/png')},
        )
        assert upload.status_code == 201
        image_artifact = upload.json()

        duplicate = client.post(
            f'/api/archives/{archive_id}/artifacts/upload',
            data={'metadata': '{"title":"Duplicate"}'},
            files={'file': ('launch-copy.png', image_bytes, 'image/png')},
        )
        assert duplicate.status_code == 409
        assert duplicate.json()['detail']['artifact_id'] == image_artifact['id']

        pdf_bytes = make_image_bytes('PDF')
        pdf_upload = client.post(
            f'/api/archives/{archive_id}/artifacts/upload',
            data={'metadata': '{"title":"Research PDF","project_phase":"Discover","privacy":"private"}'},
            files={'file': ('research.pdf', pdf_bytes, 'application/pdf')},
        )
        assert pdf_upload.status_code == 201

        audio_upload = client.post(
            f'/api/archives/{archive_id}/artifacts/upload',
            data={'metadata': '{"title":"Voice memo","project_phase":"Break","emotion":0.8,"privacy":"shared"}'},
            files={'file': ('memo.wav', make_audio_bytes(), 'audio/wav')},
        )
        assert audio_upload.status_code == 201

        note = client.post(f'/api/archives/{archive_id}/artifacts', json={
            'title': 'Human note', 'type': 'note', 'description': 'The team changed direction here.',
            'project_phase': 'Break', 'emotion': 0.7, 'privacy': 'private', 'provenance': 'Entered by archive owner',
        })
        assert note.status_code == 201
        note_artifact = note.json()

        updated = client.patch(f"/api/artifacts/{note_artifact['id']}", json={
            'tags': ['decision', 'research'], 'people': ['Ari'], 'human_edit': 'This is my interpretation.',
        })
        assert updated.status_code == 200
        assert updated.json()['human_edit'] == 'This is my interpretation.'

        relationship = client.post(f'/api/archives/{archive_id}/relationships', json={
            'source_artifact_id': note_artifact['id'],
            'target_artifact_id': image_artifact['id'],
            'kind': 'narrative',
            'label': 'changed the release',
            'strength': 0.8,
        })
        assert relationship.status_code == 201

        layout = client.post(f'/api/archives/{archive_id}/exhibitions', json={
            'name': 'Version 1', 'lighting_preset': 'nocturne', 'positions': [
                {'artifact_id': note_artifact['id'], 'x': -2, 'y': 0.4, 'z': -1, 'rotation_y': 0, 'scale': 1, 'zone': 'Break', 'sequence': 0, 'camera_stop': True},
                {'artifact_id': image_artifact['id'], 'x': 2, 'y': 0.4, 'z': -3, 'rotation_y': 0.2, 'scale': 1.2, 'zone': 'Release', 'sequence': 1, 'camera_stop': True},
            ],
        })
        assert layout.status_code == 201

        snapshot = client.get(f'/api/archives/{archive_id}/snapshot')
        assert snapshot.status_code == 200
        snapshot_body = snapshot.json()
        assert len(snapshot_body['artifacts']) == 4
        assert len(snapshot_body['relationships']) == 1
        assert snapshot_body['version']['name'] == 'Version 1'
        assert snapshot_body['positions'][1]['x'] == 2
        ready_by_title = {item['title']: item for item in snapshot_body['artifacts']}
        assert ready_by_title['Launch frame']['processing_status'] == 'ready'
        assert ready_by_title['Launch frame']['thumbnail_url']
        assert ready_by_title['Research PDF']['processing_status'] == 'ready'
        assert ready_by_title['Voice memo']['processing_status'] == 'ready'

        search = client.get(f'/api/archives/{archive_id}/search', params={'q': 'direction'})
        assert search.status_code == 200
        assert [item['title'] for item in search.json()] == ['Human note']

        curator = client.post(f'/api/archives/{archive_id}/curator', json={'question': 'What changed?', 'selected_artifact_id': note_artifact['id']})
        assert curator.status_code == 200
        curator_body = curator.json()
        valid_ids = {item['id'] for item in snapshot_body['artifacts']}
        assert curator_body['cited_artifacts']
        assert all(item['artifact_id'] in valid_ids for item in curator_body['cited_artifacts'])
        assert all(item in valid_ids for item in curator_body['suggested_route'])

        share = client.post(f'/api/archives/{archive_id}/shares')
        assert share.status_code == 201
        token = share.json()['token']
        shared = client.get(f'/api/shared/{token}/snapshot')
        assert shared.status_code == 200
        assert {item['title'] for item in shared.json()['artifacts']} == {'Launch frame', 'Voice memo'}

        export = client.get(f'/api/archives/{archive_id}/export')
        assert export.status_code == 200
        assert export.json()['schema_version'] == '1.0'
        assert 'private human notes' in export.json()['privacy_notice'].lower()

        revoke = client.post(f"/api/shares/{share.json()['id']}/revoke")
        assert revoke.status_code == 200
        assert client.get(f'/api/shared/{token}/snapshot').status_code == 404

        deleted = client.delete(f"/api/artifacts/{note_artifact['id']}")
        assert deleted.status_code == 204

