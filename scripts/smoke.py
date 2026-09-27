"""Exercise the real API through nginx after Docker Compose is healthy."""

import json
import sys
import urllib.error
import urllib.request
from uuid import uuid4

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"


def request(path, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        base + path,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.status, json.load(response)


assert request("/health")[0] == 200
with urllib.request.urlopen(base, timeout=15) as response:
    assert b'<div id="root">' in response.read()
payload = {
    "customer_id": "smoke-" + uuid4().hex[:8],
    "items": [
        {"product_id": "book", "quantity": 2, "unit_price": "12.50"},
        {"product_id": "pen", "quantity": 3, "unit_price": "0.10"},
    ],
}
code, order = request("/api/orders", payload)
assert code == 201 and order["total"] == "25.30"
path = "/api/orders/" + order["id"]
assert request(path)[1]["status"] == "PENDING"
assert request("/api/orders?status=PENDING")[1]["total"] >= 1
for status in ["PROCESSING", "SHIPPED", "DELIVERED"]:
    order = request(
        path + "/status",
        {"status": status, "expected_version": order["version"]},
        "PATCH",
    )[1]
    assert order["status"] == status
try:
    request(path + "/cancel", {}, "POST")
    raise AssertionError("Delivered order was cancelled")
except urllib.error.HTTPError as error:
    assert error.code == 409
    assert error.headers["Content-Type"].startswith("application/problem+json")
second = request("/api/orders", payload)[1]
assert (
    request("/api/orders/" + second["id"] + "/cancel", {}, "POST")[1]["status"]
    == "CANCELLED"
)
print(
    "Compose smoke passed: UI, health, multi-item order, filtering, lifecycle and cancellation."
)
