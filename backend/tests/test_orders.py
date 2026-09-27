from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.errors import DomainError
from app.models import Order, Status
from app.schemas import OrderInput, SearchFilters
from app.service import change_status, create_order, process_pending


def test_create_and_get(client, payload):
    result = client.post("/api/orders", json=payload)
    assert result.status_code == 201
    data = result.json()
    assert data["total"] == "25.30"
    assert data["status"] == "PENDING"
    assert data["version"] == 1
    assert data["created_at"].endswith("Z")
    assert len(data["items"]) == 2
    assert client.get(result.headers["location"]).json() == data


@pytest.mark.parametrize(
    "field,value",
    [
        ("quantity", 0),
        ("quantity", -1),
        ("quantity", 10001),
        ("quantity", 1.5),
        ("quantity", True),
        ("quantity", "2"),
        ("unit_price", 0),
        ("unit_price", -1),
        ("unit_price", "1.001"),
        ("unit_price", "NaN"),
        ("unit_price", "Infinity"),
        ("unit_price", 1000001),
        ("unit_price", True),
        ("product_id", ""),
        ("product_id", " "),
        ("product_id", "x" * 101),
        ("product_id", None),
    ],
)
def test_item_validation(client, payload, field, value):
    payload["items"][0][field] = value
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    assert client.get("/api/orders").json()["total"] == 0


@pytest.mark.parametrize(
    "patch",
    [
        {"customer_id": ""},
        {"customer_id": " "},
        {"customer_id": None},
        {"customer_id": "x" * 101},
        {"items": []},
        {"items": None},
        {"items": [None]},
        {"status": "DELIVERED"},
        {"total": 0},
    ],
)
def test_order_validation(client, payload, patch):
    payload.update(patch)
    assert client.post("/api/orders", json=payload).status_code == 422


def test_duplicates_and_item_limit(client, payload):
    payload["items"].append(deepcopy(payload["items"][0]))
    assert client.post("/api/orders", json=payload).status_code == 422
    payload["items"] = [
        {"product_id": str(i), "quantity": 1, "unit_price": "1.00"} for i in range(101)
    ]
    assert client.post("/api/orders", json=payload).status_code == 422


@pytest.mark.parametrize("field", ["items", "customer_id"])
def test_missing_fields(client, payload, field):
    del payload[field]
    assert client.post("/api/orders", json=payload).status_code == 422


@pytest.mark.parametrize(
    "method,suffix,body",
    [
        ("get", "", None),
        ("post", "/cancel", None),
        ("patch", "/status", {"status": "PROCESSING"}),
    ],
)
def test_missing_order(client, missing_id, method, suffix, body):
    response = client.request(method, f"/api/orders/{missing_id}{suffix}", json=body)
    assert response.status_code == 404
    assert response.json()["type"] == "about:blank"


@pytest.mark.parametrize("current", list(Status))
@pytest.mark.parametrize("target", list(Status))
def test_every_transition(app, client, payload, current, target):
    allowed = {
        ("PENDING", "PROCESSING"),
        ("PENDING", "CANCELLED"),
        ("PROCESSING", "SHIPPED"),
        ("SHIPPED", "DELIVERED"),
    }

    with app.state.db.sessions() as session:
        entry = create_order(session, OrderInput.model_validate(payload))
        entry.status = current.value
        session.commit()
        order_id = entry.id
    response = client.patch(f"/api/orders/{order_id}/status", json={"status": target})
    assert response.status_code == (
        200 if current == target or (current.value, target.value) in allowed else 409
    )
    if response.status_code == 200:
        assert response.json()["status"] == target


def test_cancellation_and_retries(client, order):
    url = f"/api/orders/{order['id']}/cancel"
    first = client.post(url)
    second = client.post(url)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["status"] == "CANCELLED"


def test_stale_version(client, order):
    url = f"/api/orders/{order['id']}/status"
    assert (
        client.patch(url, json={"status": "PROCESSING", "expected_version": 1}).status_code == 200
    )
    response = client.patch(url, json={"status": "SHIPPED", "expected_version": 1})
    assert response.status_code == 409
    assert client.get(f"/api/orders/{order['id']}").json()["status"] == "PROCESSING"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"status": 0},
        {"status": None},
        {"status": "unknown"},
        {"status": "PROCESSING", "expected_version": 0},
    ],
)
def test_invalid_status(client, order, body):
    assert client.patch(f"/api/orders/{order['id']}/status", json=body).status_code == 422


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1", "status=nope", "status=0"])
def test_invalid_list_queries(client, query):
    assert client.get("/api/orders?" + query).status_code == 422


def test_listing_summary_and_search(client, payload, order):
    payload["customer_id"] = "bob"
    another = client.post("/api/orders", json=payload).json()
    client.post(f"/api/orders/{another['id']}/cancel")
    page = client.get("/api/orders?status=PENDING&limit=1").json()
    assert page["total"] == 1 and page["orders"][0]["id"] == order["id"]
    assert client.get("/api/orders?offset=99").json()["orders"] == []
    assert client.get("/api/orders?customer_id=bob").json()["orders"][0]["id"] == another["id"]
    result = client.post(
        "/api/orders/search", json={"query": "pending orders for alice over 20"}
    ).json()
    assert result["parser"] == "rules" and result["total"] == 1
    summary = client.get("/api/orders/summary").json()
    assert summary["active_value"] == "25.30" and summary["counts"]["CANCELLED"] == 1


def test_database_race(app, client, order):
    db = app.state.db

    def attempt(target):
        with db.sessions() as session:
            try:
                return change_status(session, order["id"], target).status
            except DomainError as error:
                return error.status

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt, [Status.CANCELLED, Status.PROCESSING]))
    assert results.count(409) == 1
    assert len([r for r in results if r != 409]) == 1


def test_concurrent_creates(app, client, payload):
    def create(_):
        with app.state.db.sessions() as session:
            return create_order(session, OrderInput.model_validate(payload)).id

    with ThreadPoolExecutor(max_workers=4) as executor:
        ids = list(executor.map(create, range(12)))
    assert len(set(ids)) == 12
    with app.state.db.sessions() as session:
        assert session.scalar(select(func.count()).select_from(Order)) == 12


def test_worker_only_updates_pending(app, client, payload):
    ids = []
    with app.state.db.sessions() as session:
        for status in Status:
            entry = create_order(session, OrderInput.model_validate(payload))
            entry.status = status.value
            session.commit()
            ids.append((entry.id, status))
        assert process_pending(session) == 1
        assert process_pending(session) == 0
        session.expire_all()
        for key, status in ids:
            entry = session.get(Order, key)
            assert entry.status == (Status.PROCESSING if status == Status.PENDING else status)


def test_health_docs_problem_shapes(client):
    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/docs").status_code == 200
    assert "/api/orders" in client.get("/openapi.json").json()["paths"]
    assert client.get("/api/config").json()["processing_interval_seconds"] == 300
    for response in [
        client.get("/missing"),
        client.get("/api/orders/invalid"),
        client.post("/api/orders", content="{", headers={"Content-Type": "application/json"}),
    ]:
        assert response.headers["content-type"] == "application/problem+json"
        assert {"type", "title", "status", "detail", "instance"} <= response.json().keys()


def test_min_max_filters(client, payload):
    from app.service import list_orders

    client.post("/api/orders", json=payload)
    with client.app.state.db.sessions() as session:
        assert list_orders(session, SearchFilters(min_total=Decimal("26")), 0, 20).total == 0
        assert list_orders(session, SearchFilters(max_total=Decimal("26")), 0, 20).total == 1
