const API_BASE = "/api"; // same origin as Spring Boot

let warehouses = [];
let selectedWarehouse = null;
let items = [];

const errorBanner = document.getElementById("errorBanner");
const warehouseListEl = document.getElementById("warehouseList");
const selectedTitleEl = document.getElementById("selectedWarehouseTitle");
const warehouseMetaEl = document.getElementById("warehouseMeta");
const itemsTableBody = document.getElementById("itemsTableBody");
const itemsLoadingEl = document.getElementById("itemsLoading");
const noItemsMessageEl = document.getElementById("noItemsMessage");

// Forms
const warehouseForm = document.getElementById("warehouseForm");
const itemForm = document.getElementById("itemForm");
const transferForm = document.getElementById("transferForm");

// Transfer dropdowns
const transferSourceSelect = document.getElementById("transferSource");
const transferDestinationSelect = document.getElementById("transferDestination");

// Search input
const itemSearchInput = document.getElementById("itemSearch");

// ---------- Helper: error banner ----------
function showError(msg) {
  if (!msg) {
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
    return;
  }
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
}

// ---------- Load warehouses ----------
async function loadWarehouses() {
  try {
    showError("");
    const res = await fetch(`${API_BASE}/warehouses`);
    if (!res.ok) throw new Error("Failed to load warehouses");

    warehouses = await res.json();
    renderWarehouseList();
    updateTransferWarehouseOptions();

    if (warehouses.length > 0) {
      if (!selectedWarehouse) {
        selectWarehouse(warehouses[0].id);
      } else {
        const stillThere = warehouses.find(
          (w) => w.id === selectedWarehouse.id
        );
        if (stillThere) {
          selectWarehouse(stillThere.id);
        } else {
          selectWarehouse(warehouses[0].id);
        }
      }
    } else {
      selectedWarehouse = null;
      items = [];
      renderItems();
      selectedTitleEl.textContent = "Select a warehouse";
      warehouseMetaEl.textContent = "";
    }
  } catch (err) {
    showError(err.message);
  }
}

function renderWarehouseList() {
  warehouseListEl.innerHTML = "";
  warehouses.forEach((wh) => {
    const li = document.createElement("li");
    li.className = "warehouse-item";
    if (selectedWarehouse && wh.id === selectedWarehouse.id) {
      li.classList.add("selected");
    }
    li.textContent = `${wh.name} — ${wh.location} (capacity ${wh.currentCapacity}/${wh.maxCapacity})`;
    li.addEventListener("click", () => selectWarehouse(wh.id));
    warehouseListEl.appendChild(li);
  });
}

// ---------- Populate transfer dropdowns ----------
function updateTransferWarehouseOptions() {
  if (!transferSourceSelect || !transferDestinationSelect) return;

  const selects = [transferSourceSelect, transferDestinationSelect];

  selects.forEach((sel) => {
    sel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select warehouse...";
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);

    warehouses.forEach((wh) => {
      const opt = document.createElement("option");
      opt.value = wh.id;
      opt.textContent = `${wh.id} — ${wh.name} (${wh.location})`;
      sel.appendChild(opt);
    });
  });

  if (selectedWarehouse) {
    transferSourceSelect.value = String(selectedWarehouse.id);
  }
}

// ---------- Select warehouse & load items ----------
async function selectWarehouse(id) {
  const wh = warehouses.find((w) => w.id === id);
  if (!wh) return;

  selectedWarehouse = wh;
  renderWarehouseList();

  selectedTitleEl.textContent = `${wh.name} — Inventory`;
  warehouseMetaEl.textContent = `Location: ${wh.location} · Capacity: ${wh.currentCapacity}/${wh.maxCapacity}`;

  updateTransferWarehouseOptions();

  await loadItemsForWarehouse(wh.id);
}

async function loadItemsForWarehouse(warehouseId) {
  try {
    showError("");
    itemsLoadingEl.classList.remove("hidden");
    noItemsMessageEl.classList.add("hidden");
    itemsTableBody.innerHTML = "";

    const res = await fetch(`${API_BASE}/warehouses/${warehouseId}/items`);
    if (!res.ok) throw new Error("Failed to load items");

    items = await res.json();
    renderItems();
  } catch (err) {
    showError(err.message);
  } finally {
    itemsLoadingEl.classList.add("hidden");
  }
}

function renderItems() {
  itemsTableBody.innerHTML = "";

  const query = itemSearchInput
    ? itemSearchInput.value.trim().toLowerCase()
    : "";

  let visible = items || [];

  if (query) {
    visible = visible.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const sku = (item.sku || "").toLowerCase();
      const category = (item.category || "").toLowerCase();
      const location = (item.storageLocation || "").toLowerCase();
      return (
        name.includes(query) ||
        sku.includes(query) ||
        category.includes(query) ||
        location.includes(query)
      );
    });
  }

  if (!visible || visible.length === 0) {
    noItemsMessageEl.classList.remove("hidden");
    return;
  }
  noItemsMessageEl.classList.add("hidden");

  visible.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.sku}</td>
      <td>${item.category || ""}</td>
      <td>${item.storageLocation || ""}</td>
      <td>${item.quantity}</td>
      <td>
        <button class="btn-delete-item" data-id="${item.id}">Delete</button>
      </td>
    `;

    const deleteBtn = tr.querySelector(".btn-delete-item");
    deleteBtn.addEventListener("click", () => handleDeleteItem(item.id));

    itemsTableBody.appendChild(tr);
  });
}

// ---------- Delete item ----------
async function handleDeleteItem(itemId) {
  if (!selectedWarehouse) return;

  const confirmDelete = confirm("Are you sure you want to delete this item?");
  if (!confirmDelete) return;

  try {
    showError("");
    const res = await fetch(
      `${API_BASE}/warehouses/${selectedWarehouse.id}/items/${itemId}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to delete item");
    }

    await loadItemsForWarehouse(selectedWarehouse.id);
    await loadWarehouses();
  } catch (err) {
    showError(err.message);
  }
}

// ---------- Handlers: Add warehouse ----------
warehouseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!warehouseForm.checkValidity()) return;

  const name = document.getElementById("whName").value.trim();
  const location = document.getElementById("whLocation").value.trim();
  const maxCapacity = Number(document.getElementById("whCapacity").value);

  try {
    showError("");
    const res = await fetch(`${API_BASE}/warehouses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location, maxCapacity }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to create warehouse");
    }

    warehouseForm.reset();
    await loadWarehouses();
  } catch (err) {
    showError(err.message);
  }
});

// ---------- Handlers: Add item ----------
itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedWarehouse) {
    alert("Select a warehouse first.");
    return;
  }
  if (!itemForm.checkValidity()) return;

  const name = document.getElementById("itemName").value.trim();
  const sku = document.getElementById("itemSku").value.trim();
  const description = document.getElementById("itemDescription").value.trim();
  const category = document.getElementById("itemCategory").value.trim();
  const storageLocation = document.getElementById("itemStorage").value.trim();
  const quantity = Number(document.getElementById("itemQuantity").value);

  try {
    showError("");
    const res = await fetch(
      `${API_BASE}/warehouses/${selectedWarehouse.id}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          description,
          category,
          storageLocation,
          quantity,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to add item");
    }

    itemForm.reset();
    await loadItemsForWarehouse(selectedWarehouse.id);
    await loadWarehouses();
  } catch (err) {
    showError(err.message);
  }
});

// ---------- Handlers: Transfer ----------
transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!transferForm.checkValidity()) return;

  const sourceWarehouseId = Number(transferSourceSelect.value);
  const destinationWarehouseId = Number(transferDestinationSelect.value);
  const sku = document.getElementById("transferSku").value.trim();
  const quantity = Number(
    document.getElementById("transferQuantity").value
  );

  try {
    showError("");
    const res = await fetch(`${API_BASE}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceWarehouseId,
        destinationWarehouseId,
        sku,
        quantity,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to transfer inventory");
    }

    transferForm.reset();
    await loadWarehouses();
    if (selectedWarehouse) {
      await loadItemsForWarehouse(selectedWarehouse.id);
    }
    alert("Transfer completed successfully.");
  } catch (err) {
    showError(err.message);
  }
});

// ---------- Search: re-render on input ----------
if (itemSearchInput) {
  itemSearchInput.addEventListener("input", () => {
    renderItems();
  });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  loadWarehouses();
});
