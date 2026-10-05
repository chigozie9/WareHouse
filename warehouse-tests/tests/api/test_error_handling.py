"""Bad input should get a clear 4xx error, never a 500.

These are regression tests for BUG-1 to BUG-4. Before the fixes, the
GlobalExceptionHandler had no handlers for validation errors, unreadable JSON
or duplicates, so all of these returned 500 "Unexpected server error".
"""
import pytest

from conftest import unique

pytestmark = [pytest.mark.api, pytest.mark.bug]


# ---------- BUG-1: bean validation failures ----------

@pytest.mark.parametrize("body, field", [
    pytest.param({"location": "x", "maxCapacity": 5}, "name", id="missing-name"),
    pytest.param({"name": "  ", "maxCapacity": 5}, "name", id="blank-name"),
    pytest.param({"name": "N", "maxCapacity": -1}, "maxCapacity", id="negative-capacity"),
    pytest.param({"name": "N"}, "maxCapacity", id="missing-capacity"),
])
def test_invalid_warehouse_returns_400_naming_the_field(api, body, field):
    resp = api.post("/warehouses", json=body)
    assert resp.status_code == 400
    assert resp.json()["error"].startswith(f"{field}: ")


def test_invalid_item_returns_400(api, make_warehouse):
    wh = make_warehouse()
    resp = api.post(f"/warehouses/{wh['id']}/items", json={"name": "No SKU", "quantity": 1})
    assert resp.status_code == 400
    assert "sku" in resp.json()["error"]


def test_multiple_invalid_fields_are_all_reported(api):
    resp = api.post("/warehouses", json={"name": "", "maxCapacity": -1})
    assert resp.status_code == 400
    assert "name: " in resp.json()["error"]
    assert "maxCapacity: " in resp.json()["error"]


def test_transfer_with_zero_quantity_returns_400(api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=5, sku="Z-1")
    resp = api.post("/transfers", json={"sourceWarehouseId": src["id"], "destinationWarehouseId": dst["id"],
                                        "sku": "Z-1", "quantity": 0})
    assert resp.status_code == 400
    assert resp.json()["error"].startswith("quantity: ")


# ---------- BUG-2: duplicate warehouse names ----------

def test_duplicate_warehouse_name_returns_409(api, make_warehouse):
    existing = make_warehouse()
    resp = api.post("/warehouses", json={"name": existing["name"], "maxCapacity": 5})
    assert resp.status_code == 409
    assert resp.json()["error"] == f'A warehouse named "{existing["name"]}" already exists.'


def test_renaming_to_existing_name_returns_409(api, make_warehouse):
    first, second = make_warehouse(), make_warehouse()
    resp = api.put(f"/warehouses/{second['id']}",
                   json={"name": first["name"], "location": "x", "maxCapacity": second["maxCapacity"]})
    assert resp.status_code == 409


def test_saving_a_warehouse_with_its_own_name_is_not_a_conflict(api, make_warehouse):
    wh = make_warehouse()
    resp = api.put(f"/warehouses/{wh['id']}", json={"name": wh["name"], "location": "Helena, MT",
                                                   "maxCapacity": wh["maxCapacity"]})
    assert resp.status_code == 200


# ---------- BUG-3: malformed JSON ----------

def test_malformed_json_returns_400(api):
    resp = api.post("/warehouses", data='{"name": ')
    assert resp.status_code == 400
    assert resp.json() == {"error": "Request body is missing or is not valid JSON."}


def test_wrong_type_returns_400(api):
    resp = api.post("/warehouses", json={"name": unique("WH"), "maxCapacity": "lots"})
    assert resp.status_code == 400


def test_errors_never_leak_stack_traces(api):
    resp = api.post("/warehouses", data='{"name": ')
    assert set(resp.json()) == {"error"}
    assert "Exception" not in resp.text


# ---------- BUG-4 follow-on ----------

def test_transfer_still_works_after_rejected_duplicate_sku_update(api, make_warehouse, add_item):
    # Before the fix, the update succeeded and the next transfer of "D-A" crashed with 500
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=5, sku="D-A")
    b = add_item(src["id"], quantity=5, sku=unique("D-B"))
    assert api.put(f"/warehouses/{src['id']}/items/{b['id']}", json={**b, "sku": "D-A"}).status_code == 409

    resp = api.post("/transfers", json={"sourceWarehouseId": src["id"], "destinationWarehouseId": dst["id"],
                                        "sku": "D-A", "quantity": 1})
    assert resp.status_code == 200
