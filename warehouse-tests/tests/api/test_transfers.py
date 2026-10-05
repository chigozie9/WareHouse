"""Moving stock between warehouses: POST /api/transfers"""
import pytest

pytestmark = pytest.mark.api


def transfer(api, source, dest, sku, quantity):
    return api.post("/transfers", json={
        "sourceWarehouseId": source, "destinationWarehouseId": dest, "sku": sku, "quantity": quantity,
    })


def items_by_sku(api, warehouse_id):
    return {i["sku"]: i for i in api.get(f"/warehouses/{warehouse_id}/items").json()}


def capacity(api, warehouse_id):
    return api.get(f"/warehouses/{warehouse_id}").json()["currentCapacity"]


def test_partial_transfer_moves_stock_and_capacity(api, make_warehouse, add_item):
    src, dst = make_warehouse(max_capacity=100), make_warehouse(max_capacity=100)
    add_item(src["id"], quantity=30, sku="T-1", name="Bolt", category="Hardware")

    resp = transfer(api, src["id"], dst["id"], "T-1", 12)

    assert resp.status_code == 200
    assert resp.json() == {"message": "Transfer completed successfully."}
    assert items_by_sku(api, src["id"])["T-1"]["quantity"] == 18
    moved = items_by_sku(api, dst["id"])["T-1"]
    assert moved["quantity"] == 12
    assert moved["name"] == "Bolt"
    assert moved["category"] == "Hardware"
    assert capacity(api, src["id"]) == 18
    assert capacity(api, dst["id"]) == 12


def test_transferring_all_stock_removes_item_from_source(api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=7, sku="T-ALL")

    assert transfer(api, src["id"], dst["id"], "T-ALL", 7).status_code == 200

    assert "T-ALL" not in items_by_sku(api, src["id"])
    assert items_by_sku(api, dst["id"])["T-ALL"]["quantity"] == 7


def test_transfer_merges_into_existing_destination_item(api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=10, sku="T-MERGE")
    add_item(dst["id"], quantity=4, sku="T-MERGE")

    assert transfer(api, src["id"], dst["id"], "T-MERGE", 6).status_code == 200

    dst_items = api.get(f"/warehouses/{dst['id']}/items").json()
    assert len(dst_items) == 1
    assert dst_items[0]["quantity"] == 10


def test_cannot_transfer_more_than_source_has(api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=5, sku="T-LOW")
    resp = transfer(api, src["id"], dst["id"], "T-LOW", 6)
    assert resp.status_code == 400
    assert resp.json()["error"] == "Not enough quantity to transfer. Available in source: 5"


def test_cannot_overfill_destination(api, make_warehouse, add_item):
    src, dst = make_warehouse(max_capacity=100), make_warehouse(max_capacity=10)
    add_item(src["id"], quantity=50, sku="T-BIG")

    resp = transfer(api, src["id"], dst["id"], "T-BIG", 11)

    assert resp.status_code == 400
    assert "Not enough capacity in destination" in resp.json()["error"]
    # Nothing should have moved
    assert items_by_sku(api, src["id"])["T-BIG"]["quantity"] == 50
    assert capacity(api, dst["id"]) == 0


def test_cannot_transfer_to_same_warehouse(api, make_warehouse, add_item):
    wh = make_warehouse()
    add_item(wh["id"], quantity=5, sku="T-SAME")
    resp = transfer(api, wh["id"], wh["id"], "T-SAME", 1)
    assert resp.status_code == 400
    assert "must be different" in resp.json()["error"]


def test_unknown_sku_returns_404(api, make_warehouse):
    src, dst = make_warehouse(), make_warehouse()
    resp = transfer(api, src["id"], dst["id"], "NOPE", 1)
    assert resp.status_code == 404


def test_unknown_warehouse_returns_404(api, make_warehouse):
    dst = make_warehouse()
    assert transfer(api, 987654, dst["id"], "X", 1).status_code == 404
