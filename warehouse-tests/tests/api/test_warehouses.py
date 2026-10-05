"""Warehouse CRUD and capacity rules: /api/warehouses"""
import pytest

from conftest import unique

pytestmark = pytest.mark.api


def test_create_warehouse_returns_201_and_starts_empty(api):
    name = unique("WH")
    resp = api.post("/warehouses", json={"name": name, "location": "Butte, MT", "maxCapacity": 50})
    try:
        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] is not None
        assert body["name"] == name
        assert body["maxCapacity"] == 50
        assert body["currentCapacity"] == 0
    finally:
        api.delete(f"/warehouses/{resp.json()['id']}")


def test_client_cannot_set_id_or_current_capacity_on_create(make_warehouse):
    # The service resets id; currentCapacity can only grow by adding items.
    wh = make_warehouse(max_capacity=10, id=99999, currentCapacity=0)
    assert wh["id"] != 99999


def test_cannot_create_with_current_capacity_above_max(api):
    resp = api.post("/warehouses", json={"name": unique("WH"), "maxCapacity": 5, "currentCapacity": 6})
    assert resp.status_code == 400
    assert "cannot exceed" in resp.json()["error"]


def test_get_warehouse_by_id(api, make_warehouse):
    wh = make_warehouse()
    resp = api.get(f"/warehouses/{wh['id']}")
    assert resp.status_code == 200
    assert resp.json() == wh


def test_list_includes_created_warehouse(api, make_warehouse):
    wh = make_warehouse()
    ids = [w["id"] for w in api.get("/warehouses").json()]
    assert wh["id"] in ids


def test_get_unknown_warehouse_returns_404(api):
    resp = api.get("/warehouses/987654")
    assert resp.status_code == 404
    assert resp.json() == {"error": "Warehouse not found"}


def test_update_warehouse_fields(api, make_warehouse):
    wh = make_warehouse(max_capacity=100)
    new_name = unique("Renamed")
    resp = api.put(f"/warehouses/{wh['id']}",
                   json={"name": new_name, "location": "Helena, MT", "maxCapacity": 200})
    assert resp.status_code == 200
    assert resp.json()["name"] == new_name
    assert resp.json()["location"] == "Helena, MT"
    assert resp.json()["maxCapacity"] == 200


def test_cannot_shrink_max_capacity_below_current_stock(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=100)
    add_item(wh["id"], quantity=40)

    resp = api.put(f"/warehouses/{wh['id']}",
                   json={"name": wh["name"], "location": wh["location"], "maxCapacity": 30})

    assert resp.status_code == 400
    # The rejected update must not have been saved
    assert api.get(f"/warehouses/{wh['id']}").json()["maxCapacity"] == 100


def test_delete_empty_warehouse(api):
    created = api.post("/warehouses", json={"name": unique("WH"), "maxCapacity": 1}).json()
    assert api.delete(f"/warehouses/{created['id']}").status_code == 204
    assert api.get(f"/warehouses/{created['id']}").status_code == 404


def test_cannot_delete_warehouse_that_still_has_items(api, make_warehouse, add_item):
    wh = make_warehouse()
    add_item(wh["id"], quantity=1)
    resp = api.delete(f"/warehouses/{wh['id']}")
    assert resp.status_code == 400
    assert "still has inventory items" in resp.json()["error"]


def test_delete_unknown_warehouse_returns_404(api):
    assert api.delete("/warehouses/987654").status_code == 404
