"""Inventory items and how they affect warehouse capacity: /api/warehouses/{id}/items"""
import pytest

from conftest import unique

pytestmark = pytest.mark.api


def current_capacity(api, warehouse_id):
    return api.get(f"/warehouses/{warehouse_id}").json()["currentCapacity"]


def test_adding_item_increases_warehouse_capacity(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=100)
    item = add_item(wh["id"], quantity=25)
    assert item["quantity"] == 25
    assert current_capacity(api, wh["id"]) == 25


def test_adding_existing_sku_merges_quantity(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=100)
    first = add_item(wh["id"], quantity=10, sku="MERGE-1")
    second = add_item(wh["id"], quantity=5, sku="MERGE-1")

    assert second["id"] == first["id"]
    assert second["quantity"] == 15
    items = api.get(f"/warehouses/{wh['id']}/items").json()
    assert len(items) == 1
    assert current_capacity(api, wh["id"]) == 15


@pytest.mark.parametrize("quantity", [
    0,
    # -5 trips the @Min(0) annotation before the service check runs
    pytest.param(-5, marks=pytest.mark.bug),
])
def test_rejects_non_positive_quantity(api, make_warehouse, quantity):
    wh = make_warehouse()
    resp = api.post(f"/warehouses/{wh['id']}/items",
                    json={"name": "Widget", "sku": unique("SKU"), "quantity": quantity})
    assert resp.status_code == 400
    assert current_capacity(api, wh["id"]) == 0


def test_rejects_item_that_exceeds_available_capacity(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=10)
    add_item(wh["id"], quantity=8)
    resp = api.post(f"/warehouses/{wh['id']}/items",
                    json={"name": "Widget", "sku": unique("SKU"), "quantity": 3})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Not enough capacity. Available: 2"


def test_filling_warehouse_exactly_to_capacity_is_allowed(api, make_warehouse, add_item):
    # Boundary value: quantity == available capacity
    wh = make_warehouse(max_capacity=10)
    add_item(wh["id"], quantity=10)
    assert current_capacity(api, wh["id"]) == 10


def test_add_item_to_unknown_warehouse_returns_404(api):
    resp = api.post("/warehouses/987654/items", json={"name": "W", "sku": "X", "quantity": 1})
    assert resp.status_code == 404


def test_update_quantity_adjusts_capacity_both_ways(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=100)
    item = add_item(wh["id"], quantity=10)
    url = f"/warehouses/{wh['id']}/items/{item['id']}"

    assert api.put(url, json={**item, "quantity": 30}).status_code == 200
    assert current_capacity(api, wh["id"]) == 30

    assert api.put(url, json={**item, "quantity": 5}).status_code == 200
    assert current_capacity(api, wh["id"]) == 5


def test_update_cannot_exceed_capacity(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=20)
    item = add_item(wh["id"], quantity=10)
    resp = api.put(f"/warehouses/{wh['id']}/items/{item['id']}", json={**item, "quantity": 21})
    assert resp.status_code == 400
    assert current_capacity(api, wh["id"]) == 10


def test_cannot_update_item_through_another_warehouse(api, make_warehouse, add_item):
    wh_a, wh_b = make_warehouse(), make_warehouse()
    item = add_item(wh_a["id"], quantity=5)
    resp = api.put(f"/warehouses/{wh_b['id']}/items/{item['id']}", json={**item, "quantity": 6})
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["error"]


def test_delete_item_frees_capacity(api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=50)
    item = add_item(wh["id"], quantity=20)
    assert api.delete(f"/warehouses/{wh['id']}/items/{item['id']}").status_code == 204
    assert current_capacity(api, wh["id"]) == 0
    assert api.get(f"/warehouses/{wh['id']}/items").json() == []


@pytest.mark.bug
def test_update_cannot_create_duplicate_sku(api, make_warehouse, add_item):
    wh = make_warehouse()
    add_item(wh["id"], quantity=5, sku="DUP-A")
    item_b = add_item(wh["id"], quantity=5, sku="DUP-B")

    resp = api.put(f"/warehouses/{wh['id']}/items/{item_b['id']}", json={**item_b, "sku": "DUP-A"})

    assert resp.status_code == 409
    assert resp.json()["error"] == "Another item in this warehouse already uses SKU DUP-A."
    skus = sorted(i["sku"] for i in api.get(f"/warehouses/{wh['id']}/items").json())
    assert skus == ["DUP-A", "DUP-B"]  # nothing changed


def test_same_sku_is_allowed_in_different_warehouses(api, make_warehouse, add_item):
    wh_a, wh_b = make_warehouse(), make_warehouse()
    add_item(wh_a["id"], quantity=1, sku="SHARED")
    item_b = add_item(wh_b["id"], quantity=1, sku="OTHER")
    resp = api.put(f"/warehouses/{wh_b['id']}/items/{item_b['id']}", json={**item_b, "sku": "SHARED"})
    assert resp.status_code == 200


@pytest.mark.bug
def test_list_items_for_unknown_warehouse_returns_404(api):
    assert api.get("/warehouses/987654/items").status_code == 404


@pytest.mark.bug
def test_update_changes_expiration_date(api, make_warehouse, add_item):
    wh = make_warehouse()
    item = add_item(wh["id"], quantity=1, expirationDate="2026-12-01")
    resp = api.put(f"/warehouses/{wh['id']}/items/{item['id']}",
                   json={**item, "expirationDate": "2027-01-15"})
    assert resp.status_code == 200
    assert resp.json()["expirationDate"] == "2027-01-15"
