// All calls to the Spring Boot backend live here so pages stay focused on UI.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // Backend errors look like { "error": "message" }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  listWarehouses: () => request("GET", "/warehouses"),
  createWarehouse: (wh) => request("POST", "/warehouses", wh),
  updateWarehouse: (id, wh) => request("PUT", `/warehouses/${id}`, wh),
  deleteWarehouse: (id) => request("DELETE", `/warehouses/${id}`),

  listItems: (warehouseId) => request("GET", `/warehouses/${warehouseId}/items`),
  addItem: (warehouseId, item) => request("POST", `/warehouses/${warehouseId}/items`, item),
  updateItem: (warehouseId, itemId, item) =>
    request("PUT", `/warehouses/${warehouseId}/items/${itemId}`, item),
  deleteItem: (warehouseId, itemId) =>
    request("DELETE", `/warehouses/${warehouseId}/items/${itemId}`),

  transfer: (req) => request("POST", "/transfers", req),
};
