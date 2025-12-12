// app.js

const API_BASE = "/api";

let warehouses = [];
let selectedWarehouseId = null;
let editingWarehouseId = null;
let editingItemId = null;
let currentItems = []; // items for the selected warehouse
const recentActivity = [];

// ------- helpers -------

const errorBanner = document.getElementById("errorBanner");
let errorHideTimer = null;

function showError(message) {
  if (!errorBanner) {
    alert(message);
    return;
  }
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");

  if (errorHideTimer) {
    clearTimeout(errorHideTimer);
  }
  errorHideTimer = setTimeout(() => {
    errorBanner.classList.add("hidden");
  }, 6000);
}

/**
 * Unified fetch response handling.
 * - Tries to parse JSON: { message: "..."} or { error: "..." }
 * - Falls back to generic message otherwise.
 */
async function handleResponse(response) {
  if (!response.ok) {
    let msg = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      if (data) {
        if (typeof data.message === "string" && data.message.trim() !== "") {
          msg = data.message;
        } else if (typeof data.error === "string" && data.error.trim() !== "") {
          msg = data.error;
        }
      }
    } catch (e) {
      // non-JSON body, keep default msg
    }

    throw new Error(msg);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}

// Small helper to safely run async event handlers
function withErrorHandling(fn) {
  return async (event) => {
    event.preventDefault();
    try {
      await fn(event);
    } catch (err) {
      console.error(err);
      showError(err.message || "An unexpected error occurred.");
    }
  };
}

// ------- DOM refs -------

// Warehouse list + header
const warehouseListEl = document.getElementById("warehouseList");
const selectedWarehouseTitle = document.getElementById("selectedWarehouseTitle");
const warehouseMeta = document.getElementById("warehouseMeta");

// Items table / search
const itemsTableBody = document.getElementById("itemsTableBody");
const itemsLoading = document.getElementById("itemsLoading");
const noItemsMessage = document.getElementById("noItemsMessage");
const itemSearchInput = document.getElementById("itemSearch");

// Forms
const warehouseForm = document.getElementById("warehouseForm");
const whNameInput = document.getElementById("whName");
const whLocationInput = document.getElementById("whLocation");
const whCapacityInput = document.getElementById("whCapacity");
const warehouseFormTitle = document.getElementById("warehouseFormTitle");
const warehouseSubmitBtn = document.getElementById("warehouseSubmitBtn");

const itemForm = document.getElementById("itemForm");
const itemNameInput = document.getElementById("itemName");
const itemSkuInput = document.getElementById("itemSku");
const itemDescriptionInput = document.getElementById("itemDescription");
const itemCategoryInput = document.getElementById("itemCategory");
const itemStorageInput = document.getElementById("itemStorage");
const itemQuantityInput = document.getElementById("itemQuantity");
const itemFormTitle = document.getElementById("itemFormTitle");
const itemSubmitBtn = document.getElementById("itemSubmitBtn");

const transferForm = document.getElementById("transferForm");
const transferSourceSelect = document.getElementById("transferSource");
const transferDestinationSelect = document.getElementById("transferDestination");
const transferSkuInput = document.getElementById("transferSku");
const transferQuantityInput = document.getElementById("transferQuantity");

// Dashboard bits
const dashboardTotalEl = document.getElementById("dashboardTotal");
const dashboardListEl = document.getElementById("dashboardList");
const alertsListEl = document.getElementById("alertsList");
const recentActivityEl = document.getElementById("recentActivityList");

// ------- main load -------

document.addEventListener("DOMContentLoaded", () => {
  loadWarehouses();

  if (warehouseForm) {
    warehouseForm.addEventListener("submit", withErrorHandling(onWarehouseFormSubmit));
  }
  if (itemForm) {
    itemForm.addEventListener("submit", withErrorHandling(onItemFormSubmit));
  }
  if (transferForm) {
    transferForm.addEventListener("submit", withErrorHandling(onTransfer));
  }
  if (itemSearchInput) {
    itemSearchInput.addEventListener("input", () => {
      filterItemsInTable();
    });
  }
  if (transferSourceSelect) {
    transferSourceSelect.addEventListener("change", () => {
      // When user manually changes the source, keep their choice
      updateTransferWarehouseOptions();
    });
  }
});

// ------- warehouses -------

async function loadWarehouses() {
  try {
    const res = await fetch(`${API_BASE}/warehouses`);
    warehouses = await handleResponse(res);

    // keep selection if possible
    if (!selectedWarehouseId && warehouses.length > 0) {
      selectedWarehouseId = warehouses[0].id;
    } else if (
      selectedWarehouseId &&
      !warehouses.some((w) => w.id === selectedWarehouseId)
    ) {
      selectedWarehouseId = warehouses.length ? warehouses[0].id : null;
    }

    renderWarehousesList();
    updateDashboardSummary();
    // Here we want source warehouse to follow the selected warehouse
    updateTransferWarehouseOptions(true);
    await loadItemsForSelectedWarehouse();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

function renderWarehousesList() {
  if (!warehouseListEl) return;

  warehouseListEl.innerHTML = "";

  warehouses.forEach((w) => {
    const li = document.createElement("li");
    li.className = "warehouse-item" + (w.id === selectedWarehouseId ? " selected" : "");
    li.dataset.id = w.id;

    const infoDiv = document.createElement("div");
    infoDiv.innerHTML = `
      <div>${w.name}</div>
      <div class="small muted">${w.location} · capacity ${w.currentCapacity}/${w.maxCapacity}</div>
    `;

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "warehouse-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.className = "btn-secondary btn-small";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startEditWarehouse(w);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn-danger btn-small";
    deleteBtn.addEventListener(
      "click",
      withErrorHandling(async (e) => {
        e.stopPropagation();

        const confirmed = window.confirm(
          `Are you sure you want to delete warehouse "${w.name}"?\n` +
          `You must remove all inventory items first.`
        );
        if (!confirmed) return;

        await deleteWarehouse(w);
      })
    );

    btnWrapper.appendChild(editBtn);
    btnWrapper.appendChild(deleteBtn);

    li.appendChild(infoDiv);
    li.appendChild(btnWrapper);

    li.addEventListener("click", () => {
      selectedWarehouseId = w.id;
      renderWarehousesList();
      loadItemsForSelectedWarehouse();
      // When user clicks a warehouse, treat that as the source by default
      updateTransferWarehouseOptions(true);
    });

    warehouseListEl.appendChild(li);
  });
}

function startEditWarehouse(w) {
  editingWarehouseId = w.id;
  if (!warehouseForm) return;

  whNameInput.value = w.name;
  whLocationInput.value = w.location || "";
  whCapacityInput.value = w.maxCapacity != null ? w.maxCapacity : "";

  if (warehouseFormTitle) warehouseFormTitle.textContent = "Edit Warehouse";
  if (warehouseSubmitBtn) warehouseSubmitBtn.textContent = "Save Changes";
}

function resetWarehouseForm() {
  editingWarehouseId = null;
  if (warehouseForm) warehouseForm.reset();
  if (warehouseFormTitle) warehouseFormTitle.textContent = "Add Warehouse";
  if (warehouseSubmitBtn) warehouseSubmitBtn.textContent = "Create Warehouse";
}

async function deleteWarehouse(warehouse) {
  const res = await fetch(`${API_BASE}/warehouses/${warehouse.id}`, {
    method: "DELETE",
  });
  await handleResponse(res);

  recentActivity.unshift(`Deleted warehouse "${warehouse.name}"`);
  if (recentActivity.length > 5) recentActivity.pop();
  updateRecentActivity();

  await loadWarehouses();
}

async function onWarehouseFormSubmit() {
  const payload = {
    name: whNameInput.value.trim(),
    location: whLocationInput.value.trim(),
    maxCapacity: Number(whCapacityInput.value),
  };

  const method = editingWarehouseId ? "PUT" : "POST";
  const url = editingWarehouseId
    ? `${API_BASE}/warehouses/${editingWarehouseId}`
    : `${API_BASE}/warehouses`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const saved = await handleResponse(res);

  const verb = editingWarehouseId ? "Updated" : "Created";
  recentActivity.unshift(`${verb} warehouse "${saved.name}"`);
  if (recentActivity.length > 5) recentActivity.pop();
  updateRecentActivity();

  resetWarehouseForm();
  await loadWarehouses();
}

// ------- items -------

async function loadItemsForSelectedWarehouse() {
  if (!selectedWarehouseId) {
    currentItems = [];
    setItemsTable([]);
    if (selectedWarehouseTitle) {
      selectedWarehouseTitle.textContent = "Select a warehouse";
    }
    if (warehouseMeta) warehouseMeta.textContent = "";
    return;
  }

  try {
    if (itemsLoading) itemsLoading.classList.remove("hidden");
    if (noItemsMessage) noItemsMessage.classList.add("hidden");

    const res = await fetch(`${API_BASE}/warehouses/${selectedWarehouseId}/items`);
    const items = await handleResponse(res);

    // sort by name for stable display
    currentItems = (items || []).slice().sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    setItemsTable(currentItems);

    const w = warehouses.find((x) => x.id === selectedWarehouseId);
    if (w && selectedWarehouseTitle && warehouseMeta) {
      selectedWarehouseTitle.textContent = `${w.name} — Inventory`;
      warehouseMeta.textContent = `Location: ${w.location} · Capacity: ${w.currentCapacity}/${w.maxCapacity}`;
    }
  } catch (err) {
    console.error(err);
    showError(err.message);
  } finally {
    if (itemsLoading) itemsLoading.classList.add("hidden");
  }
}

function setItemsTable(items) {
  if (!itemsTableBody) return;

  const term = itemSearchInput ? itemSearchInput.value.toLowerCase().trim() : "";
  itemsTableBody.innerHTML = "";

  const filtered = items.filter((it) => {
    if (!term) return true;
    return (
      (it.name && it.name.toLowerCase().includes(term)) ||
      (it.sku && it.sku.toLowerCase().includes(term)) ||
      (it.category && it.category.toLowerCase().includes(term)) ||
      (it.storageLocation && it.storageLocation.toLowerCase().includes(term))
    );
  });

  if (filtered.length === 0) {
    if (noItemsMessage) noItemsMessage.classList.remove("hidden");
  } else {
    if (noItemsMessage) noItemsMessage.classList.add("hidden");
  }

  filtered.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.sku}</td>
      <td>${item.category || ""}</td>
      <td>${item.storageLocation || ""}</td>
      <td>${item.quantity}</td>
    `;

    const actionsTd = document.createElement("td");
    actionsTd.className = "table-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.className = "btn-secondary btn-small";
    editBtn.addEventListener("click", () => {
      startEditItem(item);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.className = "btn-danger btn-small";
    delBtn.addEventListener(
      "click",
      withErrorHandling(async () => {
        const confirmed = window.confirm(
          `Delete item "${item.name}" (SKU ${item.sku}) from this warehouse?`
        );
        if (!confirmed) return;

        await deleteItem(item);
      })
    );

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);

    itemsTableBody.appendChild(tr);
  });
}

function filterItemsInTable() {
  setItemsTable(currentItems);
}

function startEditItem(item) {
  editingItemId = item.id;

  if (!itemForm) return;

  itemNameInput.value = item.name || "";
  itemSkuInput.value = item.sku || "";
  itemDescriptionInput.value = item.description || "";
  itemCategoryInput.value = item.category || "";
  itemStorageInput.value = item.storageLocation || "";
  itemQuantityInput.value = item.quantity != null ? item.quantity : "";

  if (itemFormTitle) itemFormTitle.textContent = "Edit Item";
  if (itemSubmitBtn) itemSubmitBtn.textContent = "Save Changes";
}

function resetItemForm() {
  editingItemId = null;
  if (itemForm) itemForm.reset();
  if (itemFormTitle) itemFormTitle.textContent = "Add Item";
  if (itemSubmitBtn) itemSubmitBtn.textContent = "Add Item";
}

async function deleteItem(item) {
  // Use nested endpoint that Spring actually exposes
  const res = await fetch(
    `${API_BASE}/warehouses/${selectedWarehouseId}/items/${item.id}`,
    {
      method: "DELETE",
    }
  );
  await handleResponse(res);

  recentActivity.unshift(`Deleted item "${item.name}" (SKU ${item.sku})`);
  if (recentActivity.length > 5) recentActivity.pop();
  updateRecentActivity();

  await loadWarehouses(); // refresh capacities + items
}

async function onItemFormSubmit() {
  if (!selectedWarehouseId) {
    throw new Error("Please select a warehouse first.");
  }

  const payload = {
    name: itemNameInput.value.trim(),
    sku: itemSkuInput.value.trim(),
    description: itemDescriptionInput.value.trim(),
    category: itemCategoryInput.value.trim(),
    storageLocation: itemStorageInput.value.trim(),
    quantity: Number(itemQuantityInput.value),
  };

  let method, url;

  if (editingItemId) {
    method = "PUT";
    // also use nested endpoint for updates
    url = `${API_BASE}/warehouses/${selectedWarehouseId}/items/${editingItemId}`;
  } else {
    method = "POST";
    url = `${API_BASE}/warehouses/${selectedWarehouseId}/items`;
  }

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const saved = await handleResponse(res);

  const verb = editingItemId ? "Updated" : "Added";
  recentActivity.unshift(`${verb} item "${saved.name}" (SKU ${saved.sku})`);
  if (recentActivity.length > 5) recentActivity.pop();
  updateRecentActivity();

  resetItemForm();
  await loadWarehouses();
}

// ------- transfer -------

async function onTransfer() {
  if (!transferDestinationSelect.value) {
    throw new Error("Please select a destination warehouse.");
  }

  const payload = {
    sourceWarehouseId: Number(transferSourceSelect.value),
    destinationWarehouseId: Number(transferDestinationSelect.value),
    sku: transferSkuInput.value.trim(),
    quantity: Number(transferQuantityInput.value),
  };

  const res = await fetch(`${API_BASE}/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await handleResponse(res);

  recentActivity.unshift(
    `Transferred ${payload.quantity} of SKU ${payload.sku} from warehouse #${payload.sourceWarehouseId} to #${payload.destinationWarehouseId}`
  );
  if (recentActivity.length > 5) recentActivity.pop();
  updateRecentActivity();

  transferForm.reset();
  // After transfer, keep source tied to whichever warehouse is selected
  updateTransferWarehouseOptions(true);
  await loadWarehouses();
}

/**
 * Update the transfer dropdowns.
 * @param {boolean} preferSelectedWarehouse
 *   If true, we prefer using selectedWarehouseId as the source.
 */
function updateTransferWarehouseOptions(preferSelectedWarehouse = false) {
  if (!transferSourceSelect || !transferDestinationSelect) return;

  // Decide what the source *should* be
  let currentSourceId = null;

  if (preferSelectedWarehouse && selectedWarehouseId) {
    // Called after warehouse click / initial load: follow left-panel selection
    currentSourceId = selectedWarehouseId;
  } else if (transferSourceSelect.value) {
    // Keep user's manual choice
    currentSourceId = Number(transferSourceSelect.value);
  } else if (selectedWarehouseId) {
    // Fallback to selected warehouse if dropdown is empty
    currentSourceId = selectedWarehouseId;
  }

  // Rebuild source options
  transferSourceSelect.innerHTML = "";
  warehouses.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.location})`;
    transferSourceSelect.appendChild(opt);
  });

  if (currentSourceId) {
    transferSourceSelect.value = String(currentSourceId);
  } else if (warehouses.length > 0) {
    transferSourceSelect.value = String(warehouses[0].id);
  }

  // Rebuild destination options with placeholder and excluding source
  transferDestinationSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "...Select Destination";
  placeholder.disabled = true;
  placeholder.selected = true;
  transferDestinationSelect.appendChild(placeholder);

  const sourceId = transferSourceSelect.value
    ? Number(transferSourceSelect.value)
    : null;

  warehouses.forEach((w) => {
    if (sourceId && w.id === sourceId) return; // don't include source as destination
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.location})`;
    transferDestinationSelect.appendChild(opt);
  });
}

// ------- dashboard -------

function updateDashboardSummary() {
  if (!dashboardTotalEl || !dashboardListEl) return;

  let totalCurrent = 0;
  let totalMax = 0;

  dashboardListEl.innerHTML = "";

  warehouses.forEach((w) => {
    totalCurrent += w.currentCapacity;
    totalMax += w.maxCapacity;

    const usedPercent =
      w.maxCapacity > 0
        ? Math.round((w.currentCapacity / w.maxCapacity) * 100)
        : 0;

    const li = document.createElement("li");
    li.textContent = `${w.name} — ${w.currentCapacity}/${w.maxCapacity} (${usedPercent}% used)`;
    dashboardListEl.appendChild(li);
  });

  const overall =
    totalMax > 0 ? Math.round((totalCurrent / totalMax) * 100) : 0;
  dashboardTotalEl.textContent = `Total: ${totalCurrent}/${totalMax} capacity used (${overall}% overall)`;

  updateAlerts(overall);
  updateRecentActivity();
}

function updateAlerts(overallPercent) {
  if (!alertsListEl) return;

  alertsListEl.innerHTML = "";

  if (!warehouses.length) {
    const li = document.createElement("li");
    li.textContent = "No warehouses yet.";
    alertsListEl.appendChild(li);
    return;
  }

  const highUsage = warehouses.filter((w) => {
    if (!w.maxCapacity) return false;
    return w.currentCapacity / w.maxCapacity >= 0.75;
  });

  if (highUsage.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No alerts. All warehouses are under 75% capacity.";
    alertsListEl.appendChild(li);
    return;
  }

  highUsage.forEach((w) => {
    const percent = Math.round((w.currentCapacity / w.maxCapacity) * 100);
    const li = document.createElement("li");
    li.textContent = `${w.name} is at ${percent}% capacity.`;
    alertsListEl.appendChild(li);
  });
}

function updateRecentActivity() {
  if (!recentActivityEl) return;

  recentActivityEl.innerHTML = "";
  if (recentActivity.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No recent activity yet.";
    recentActivityEl.appendChild(li);
    return;
  }

  recentActivity.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg;
    recentActivityEl.appendChild(li);
  });
}
