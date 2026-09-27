import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.models import Base


@pytest.fixture
def app(tmp_path):
    url = os.getenv("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    application = create_app(Settings(database_url=url, scheduler_enabled=False))
    # TEST_DATABASE_URL must point to a disposable database, never a production database.
    if os.getenv("TEST_DATABASE_URL"):
        Base.metadata.drop_all(application.state.db.engine)
    return application


@pytest.fixture
def client(app):
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def payload():
    return {
        "customer_id": "alice",
        "items": [
            {"product_id": "book", "quantity": 2, "unit_price": "12.50"},
            {"product_id": "pen", "quantity": 3, "unit_price": "0.10"},
        ],
    }


@pytest.fixture
def order(client, payload):
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def missing_id():
    return str(uuid4())
