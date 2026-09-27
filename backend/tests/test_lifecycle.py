import time

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_restart_persistence(tmp_path, payload):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'restart.db'}", scheduler_enabled=False
    )
    with TestClient(create_app(settings)) as first:
        created = first.post("/api/orders", json=payload).json()
    with TestClient(create_app(settings)) as second:
        assert second.get(f"/api/orders/{created['id']}").json() == created


def test_real_scheduler_lifecycle(tmp_path, payload):
    application = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'scheduler.db'}", processing_interval_seconds=1
        )
    )
    with TestClient(application) as client:
        created = client.post("/api/orders", json=payload).json()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            current = client.get(f"/api/orders/{created['id']}").json()
            if current["status"] == "PROCESSING":
                break
            time.sleep(0.1)
        assert current["status"] == "PROCESSING"
        assert application.state.scheduler.running
    assert not application.state.scheduler.running
