"""Shared fixtures for the Warehouse Inventory Manager test suite.

Every test creates its own data with unique names and cleans it up afterwards,
so tests are independent and can run in any order against a shared database.
"""
import os
import uuid

import pytest
import requests

API_URL = os.getenv("API_URL", "http://localhost:8080/api")
UI_URL = os.getenv("UI_URL", "http://localhost:5173")


def unique(prefix: str) -> str:
    """Return a name that won't collide with data from other tests."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class ApiClient:
    """Thin wrapper around requests so tests read like the API they exercise."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers["Content-Type"] = "application/json"

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        return self.session.request(method, f"{self.base_url}{path}", timeout=10, **kwargs)

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, **kw):
        return self.request("POST", path, **kw)

    def put(self, path, **kw):
        return self.request("PUT", path, **kw)

    def delete(self, path, **kw):
        return self.request("DELETE", path, **kw)


@pytest.fixture(scope="session")
def api() -> ApiClient:
    client = ApiClient(API_URL)
    try:
        client.get("/test")
    except requests.ConnectionError:
        pytest.exit(f"Backend is not reachable at {API_URL}. Start it first (see README).")
    return client


@pytest.fixture
def make_warehouse(api):
    """Factory: create warehouses for a test and delete them (and their items) afterwards."""
    created = []

    def _make(max_capacity=100, **overrides):
        body = {"name": unique("WH"), "location": "Missoula, MT", "maxCapacity": max_capacity}
        body.update(overrides)
        resp = api.post("/warehouses", json=body)
        assert resp.status_code == 201, resp.text
        warehouse = resp.json()
        created.append(warehouse["id"])
        return warehouse

    yield _make

    for wh_id in created:
        resp = api.get(f"/warehouses/{wh_id}/items")
        if resp.status_code != 200:  # warehouse already deleted by the test
            continue
        for item in resp.json():
            api.delete(f"/warehouses/{wh_id}/items/{item['id']}")
        api.delete(f"/warehouses/{wh_id}")


@pytest.fixture
def add_item(api):
    """Factory: add an inventory item to a warehouse (cleaned up with its warehouse)."""

    def _add(warehouse_id, quantity=10, sku=None, **overrides):
        body = {"name": "Widget", "sku": sku or unique("SKU"), "quantity": quantity}
        body.update(overrides)
        resp = api.post(f"/warehouses/{warehouse_id}/items", json=body)
        assert resp.status_code == 201, resp.text
        return resp.json()

    return _add
