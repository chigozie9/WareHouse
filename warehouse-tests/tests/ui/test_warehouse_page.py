"""Browser tests for the React frontend using Playwright.

The app has four pages behind a nav bar: Dashboard, Warehouses, Inventory and
Transfers. Other tests share the same backend, so these assert on their own
uniquely named data rather than on exact page contents.
"""
import re

import pytest
from playwright.sync_api import Page, expect

from conftest import UI_URL, unique

pytestmark = pytest.mark.ui


def nav(page: Page, label: str):
    page.get_by_role("navigation", name="Main").get_by_role("link", name=label).click()
    expect(page.get_by_role("heading", level=1, name=label)).to_be_visible()


def row_for(page: Page, text: str):
    return page.get_by_role("row").filter(has_text=text)


@pytest.fixture
def cleanup_by_name(api):
    names = []
    yield names
    for wh in api.get("/warehouses").json():
        if wh["name"] in names:
            for item in api.get(f"/warehouses/{wh['id']}/items").json():
                api.delete(f"/warehouses/{wh['id']}/items/{item['id']}")
            api.delete(f"/warehouses/{wh['id']}")


# ---------- Navigation ----------

def test_nav_bar_switches_pages_and_highlights_current(page: Page, api):
    page.goto(UI_URL)
    expect(page.get_by_role("heading", level=1, name="Dashboard")).to_be_visible()

    for label, path in [("Warehouses", "/warehouses"), ("Inventory", "/inventory"),
                        ("Transfers", "/transfers"), ("Dashboard", "/")]:
        nav(page, label)
        expect(page).to_have_url(re.compile(rf"{re.escape(path)}$"))
        current = page.get_by_role("link", name=label)
        expect(current).to_have_class(re.compile(r"\bactive\b"))
        expect(current).to_have_attribute("aria-current", "page")


def test_unknown_url_redirects_to_dashboard(page: Page, api):
    page.goto(f"{UI_URL}/does-not-exist")
    expect(page).to_have_url(re.compile(r"/$"))
    expect(page.get_by_role("heading", level=1, name="Dashboard")).to_be_visible()


# ---------- Dashboard ----------

def test_dashboard_shows_capacity_bar_per_warehouse(page: Page, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=40)
    add_item(wh["id"], quantity=10)
    page.goto(UI_URL)

    bar = page.get_by_role("progressbar", name=f"{wh['name']} capacity")
    expect(bar).to_have_attribute("aria-valuenow", "25")
    expect(page.get_by_text("10/40 (25%)")).to_be_visible()


# ---------- Warehouses ----------

def test_warehouses_page_lists_warehouses_from_api(page: Page, make_warehouse):
    wh = make_warehouse(max_capacity=40)
    page.goto(f"{UI_URL}/warehouses")
    expect(row_for(page, wh["name"])).to_contain_text("0/40")


def test_create_warehouse_through_form(page: Page, api, cleanup_by_name):
    name = unique("UI-WH")
    cleanup_by_name.append(name)
    page.goto(f"{UI_URL}/warehouses")

    page.get_by_placeholder("Name").fill(name)
    page.get_by_placeholder("Location").fill("Kalispell, MT")
    page.get_by_placeholder("Max Capacity").fill("75")
    page.get_by_role("button", name="Create").click()

    expect(row_for(page, name)).to_contain_text("Kalispell, MT")
    expect(row_for(page, name)).to_contain_text("0/75")
    expect(page.get_by_placeholder("Name")).to_have_value("")  # form resets
    assert any(w["name"] == name for w in api.get("/warehouses").json())


def test_required_fields_block_submit(page: Page, api):
    page.goto(f"{UI_URL}/warehouses")
    before = len(api.get("/warehouses").json())

    page.get_by_placeholder("Location").fill("Nowhere")
    page.get_by_role("button", name="Create").click()

    # Browser-native validation keeps focus on the empty required field
    expect(page.get_by_placeholder("Name")).to_be_focused()
    assert len(api.get("/warehouses").json()) == before


def test_edit_warehouse_inline(page: Page, api, make_warehouse):
    wh = make_warehouse(max_capacity=50)
    page.goto(f"{UI_URL}/warehouses")

    row_for(page, wh["name"]).get_by_role("button", name="Edit").click()
    page.get_by_label("Edit max capacity").fill("80")
    page.get_by_role("button", name="Save").click()

    expect(row_for(page, wh["name"])).to_contain_text("0/80")
    assert api.get(f"/warehouses/{wh['id']}").json()["maxCapacity"] == 80


def test_delete_warehouse_after_confirming(page: Page, api):
    wh = api.post("/warehouses", json={"name": unique("UI-DEL"), "maxCapacity": 5}).json()
    page.goto(f"{UI_URL}/warehouses")

    page.once("dialog", lambda d: d.accept())
    row_for(page, wh["name"]).get_by_role("button", name="Delete").click()

    expect(row_for(page, wh["name"])).to_have_count(0)
    assert api.get(f"/warehouses/{wh['id']}").status_code == 404


def test_delete_blocked_when_warehouse_has_items(page: Page, make_warehouse, add_item):
    wh = make_warehouse()
    add_item(wh["id"], quantity=1)
    page.goto(f"{UI_URL}/warehouses")

    page.once("dialog", lambda d: d.accept())
    row_for(page, wh["name"]).get_by_role("button", name="Delete").click()

    expect(page.get_by_role("alert")).to_contain_text("still has inventory items")
    expect(row_for(page, wh["name"])).to_be_visible()


@pytest.mark.bug
def test_duplicate_name_shows_helpful_error(page: Page, make_warehouse):
    existing = make_warehouse()
    page.goto(f"{UI_URL}/warehouses")
    page.get_by_placeholder("Name").fill(existing["name"])
    page.get_by_placeholder("Location").fill("Missoula, MT")
    page.get_by_placeholder("Max Capacity").fill("10")
    page.get_by_role("button", name="Create").click()
    expect(page.get_by_role("alert")).to_contain_text(re.compile("already exists|taken", re.I), timeout=3000)


def test_error_banner_when_backend_rejects_create(page: Page):
    # Simulate a backend failure without touching real data
    page.route("**/api/warehouses", lambda route: route.fulfill(
        status=400, json={"error": "Current capacity cannot exceed max capacity"})
        if route.request.method == "POST" else route.continue_())
    page.goto(f"{UI_URL}/warehouses")

    page.get_by_placeholder("Name").fill(unique("UI-ERR"))
    page.get_by_placeholder("Location").fill("Missoula, MT")
    page.get_by_placeholder("Max Capacity").fill("5")
    page.get_by_role("button", name="Create").click()

    expect(page.get_by_role("alert")).to_have_text(re.compile("Current capacity cannot exceed max capacity"))


def test_shows_error_when_backend_is_down(page: Page):
    page.route("**/api/warehouses", lambda route: route.abort())
    page.goto(f"{UI_URL}/warehouses")
    expect(page.get_by_role("alert")).to_contain_text("Failed to fetch")
    expect(page.get_by_text("No warehouses yet.")).not_to_be_visible()


# ---------- Inventory ----------

def test_add_item_updates_table_and_capacity(page: Page, api, make_warehouse):
    wh = make_warehouse(max_capacity=100)
    page.goto(f"{UI_URL}/inventory")
    page.get_by_label("Warehouse").select_option(str(wh["id"]))
    expect(page).to_have_url(re.compile(rf"warehouse={wh['id']}"))  # selection kept in the URL

    page.get_by_placeholder("Item name").fill("Steel Bolts")
    page.get_by_placeholder("SKU").fill("BLT-1")
    page.get_by_placeholder("Category").fill("Hardware")
    page.get_by_placeholder("Quantity").fill("30")
    page.get_by_role("button", name="Add Item").click()

    expect(row_for(page, "BLT-1")).to_contain_text("Steel Bolts")
    expect(page.get_by_text("70 units of space left")).to_be_visible()
    assert api.get(f"/warehouses/{wh['id']}").json()["currentCapacity"] == 30


def test_inventory_selection_survives_reload(page: Page, make_warehouse, add_item):
    wh = make_warehouse()
    add_item(wh["id"], sku="KEEP-1")
    page.goto(f"{UI_URL}/inventory?warehouse={wh['id']}")
    page.reload()
    expect(row_for(page, "KEEP-1")).to_be_visible()


def test_adding_too_much_shows_capacity_error(page: Page, make_warehouse):
    wh = make_warehouse(max_capacity=5)
    page.goto(f"{UI_URL}/inventory?warehouse={wh['id']}")

    page.get_by_placeholder("Item name").fill("Too Many")
    page.get_by_placeholder("SKU").fill("BIG-1")
    page.get_by_placeholder("Quantity").fill("6")
    page.get_by_role("button", name="Add Item").click()

    expect(page.get_by_role("alert")).to_have_text(re.compile("Not enough capacity. Available: 5"))


def test_edit_item_quantity(page: Page, api, make_warehouse, add_item):
    wh = make_warehouse(max_capacity=100)
    item = add_item(wh["id"], quantity=10, sku="EDIT-1")
    page.goto(f"{UI_URL}/inventory?warehouse={wh['id']}")

    row_for(page, "EDIT-1").get_by_role("button", name="Edit").click()
    page.get_by_label("Edit quantity").fill("25")
    page.get_by_role("button", name="Save").click()

    expect(row_for(page, "EDIT-1")).to_contain_text("25")
    assert api.get(f"/warehouses/{wh['id']}").json()["currentCapacity"] == 25


# ---------- Transfers ----------

def test_transfer_moves_stock(page: Page, api, make_warehouse, add_item):
    src, dst = make_warehouse(), make_warehouse()
    add_item(src["id"], quantity=20, sku="MOVE-1", name="Pallet Wrap")
    page.goto(f"{UI_URL}/transfers")

    page.get_by_label("From").select_option(str(src["id"]))
    page.get_by_label("Item").select_option("MOVE-1")
    page.get_by_label("To").select_option(str(dst["id"]))
    page.get_by_label("Quantity").fill("8")
    page.get_by_role("button", name="Transfer").click()

    expect(page.get_by_role("status")).to_have_text("Transfer completed successfully.")
    dst_items = api.get(f"/warehouses/{dst['id']}/items").json()
    assert [(i["sku"], i["quantity"]) for i in dst_items] == [("MOVE-1", 8)]
    # The item dropdown refreshes with the new source quantity
    expect(page.get_by_label("Item").locator("option", has_text="MOVE-1")).to_contain_text("12 available")


def test_destination_list_excludes_source(page: Page, make_warehouse, add_item):
    src, _ = make_warehouse(), make_warehouse()
    add_item(src["id"], sku="SELF-1")
    page.goto(f"{UI_URL}/transfers")
    page.get_by_label("From").select_option(str(src["id"]))
    expect(page.get_by_label("To").locator(f"option[value='{src['id']}']")).to_have_count(0)
