import io

from fastapi.testclient import TestClient

from app.main import app


def test_failed_pdf_processing_is_recoverable() -> None:
    with TestClient(app) as client:
        archive = client.post('/api/archives', json={'title': 'Failure archive'}).json()
        response = client.post(
            f"/api/archives/{archive['id']}/artifacts/upload",
            data={'metadata': '{"title":"Broken PDF"}'},
            files={'file': ('broken.pdf', io.BytesIO(b'not a real pdf'), 'application/pdf')},
        )
        assert response.status_code == 201
        artifact_id = response.json()['id']
        snapshot = client.get(f"/api/archives/{archive['id']}/snapshot").json()
        artifact = next(item for item in snapshot['artifacts'] if item['id'] == artifact_id)
        assert artifact['processing_status'] == 'failed'
        assert artifact['processing_error']

        retry = client.post(f'/api/artifacts/{artifact_id}/retry')
        assert retry.status_code == 200
        snapshot_after_retry = client.get(f"/api/archives/{archive['id']}/snapshot").json()
        retried = next(item for item in snapshot_after_retry['artifacts'] if item['id'] == artifact_id)
        assert retried['processing_status'] == 'failed'
        assert retried['media_url']
