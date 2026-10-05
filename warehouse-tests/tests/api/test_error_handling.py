"""Bad input should get a clear 4xx error, never a 500.

These tests document BUG-1, BUG-2 and BUG-3: the GlobalExceptionHandler has no
handlers for validation errors, unreadable JSON or database constraint
violations, so they all fall through to the generic 500 handler.
"""
import pytest

from conftest import unique

pytestmark = [pytest.mark.api, pytest.mark.bug]

BUG_1 = "BUG-1: bean validation failures (@Valid) return 500 instead of 400"


@pytest.mark.xfail(reason=BUG_1)
@pytest.mark.parametrize("body", [
    pytest.param({"location": "x", "maxCapacity": 5}, id="missing-name"),
    pytest.param({"name": "  ", "maxCapacity": 5}, id="blank-name"),
    pytest.param({"name": "N", "maxCapacity": -1}, id="negative-capacity"),
    pytest.param({"name": "N"}, id="missing-capacity"),
])
def test_invalid_warehouse_returns_400(api, body):
    resp = api.post("/warehouses", json=body)
    assert resp.status_code == 400


@pytest.mark.xfail(reason=BUG_1)
def test_invalid_item_returns_400(api, make_warehouse):
    wh = make_warehouse()
    resp = api.post(f"/warehouses/{wh['id']}/items", json={"name": "No SKU", "quantity": 1})
    assert resp.status_code == 400


@pytest.mark.xfail(reason=BUG_1)
def test_transfer_with_zero_quantity_returns_400(api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=5, sku="Z-1")
    resp = api.post("/transfers", json={"sourceWarehouseId": src["id"], "destinationWarehouseId": dst["id"],
                                        "sku": "Z-1", "quantity": 0})
    assert resp.status_code == 400


@pytest.mark.xfail(reason="BUG-2: duplicate warehouse name hits the DB unique constraint and returns 500")
def test_duplicate_warehouse_name_returns_409(api, make_warehouse):
    existing = make_warehouse()
    resp = api.post("/warehouses", json={"name": existing["name"], "maxCapacity": 5})
    assert resp.status_code == 409


@pytest.mark.xfail(reason="BUG-3: malformed JSON returns 500 instead of 400")
def test_malformed_json_returns_400(api):
    resp = api.post("/warehouses", data='{"name": ')
    assert resp.status_code == 400


def test_errors_never_leak_stack_traces(api):
    # Even the 500 fallback should only return a friendly message
    resp = api.post("/warehouses", data='{"name": ')
    assert set(resp.json()) == {"error"}
    assert "Exception" not in resp.text


@pytest.mark.xfail(reason="BUG-4 (follow-on): once a warehouse has duplicate SKUs, transfers by that SKU crash with 500")
def test_transfer_after_duplicate_sku_update_does_not_500(api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=5, sku="D-A")
    b = add_item(src["id"], quantity=5, sku=unique("D-B"))
    api.put(f"/warehouses/{src['id']}/items/{b['id']}", json={**b, "sku": "D-A"})

    resp = api.post("/transfers", json={"sourceWarehouseId": src["id"], "destinationWarehouseId": dst["id"],
                                        "sku": "D-A", "quantity": 1})
    assert resp.status_code != 500
