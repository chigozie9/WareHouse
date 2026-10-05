import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import ErrorBanner from "../components/ErrorBanner.jsx";
import { useWarehouses } from "../useWarehouses";

const emptyItem = { name: "", sku: "", category: "", storageLocation: "", quantity: "", expirationDate: "" };

// Turn form strings into the shape the API expects (blank optional fields -> null)
function toPayload(item) {
  return {
    ...item,
    quantity: Number(item.quantity),
    category: item.category || null,
    storageLocation: item.storageLocation || null,
    expirationDate: item.expirationDate || null,
  };
}

export default function Inventory() {
  const { warehouses, loading: loadingWarehouses, error: warehouseError, reload: reloadWarehouses } = useWarehouses();
  // Selected warehouse lives in the URL (?warehouse=3) so it survives refresh and can be linked to
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("warehouse") ?? "";
  const selected = warehouses.find((w) => String(w.id) === selectedId);

  // Remember which warehouse the loaded items belong to, so switching warehouses
  // never briefly shows the previous warehouse's items
  const [loaded, setLoaded] = useState({ warehouseId: null, items: [] });
  const items = loaded.warehouseId === selectedId ? loaded.items : [];
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyItem);

  const loadItems = useCallback(async () => {
    const data = await api.listItems(selectedId);
    setLoaded({ warehouseId: selectedId, items: data });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api.listItems(selectedId)
      .then((data) => !cancelled && setLoaded({ warehouseId: selectedId, items: data }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function run(action) {
    try {
      setError("");
      await action();
      await Promise.all([loadItems(), reloadWarehouses()]);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    const ok = await run(() => api.addItem(selectedId, toPayload(form)));
    if (ok) setForm(emptyItem);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({ ...emptyItem, ...item, category: item.category ?? "", storageLocation: item.storageLocation ?? "",
      expirationDate: item.expirationDate ?? "" });
  }

  async function handleSave(itemId) {
    const ok = await run(() => api.updateItem(selectedId, itemId, toPayload(editForm)));
    if (ok) setEditingId(null);
  }

  async function handleDelete(item) {
    if (window.confirm(`Delete "${item.name}" (${item.sku})?`)) {
      await run(() => api.deleteItem(selectedId, item.id));
    }
  }

  return (
    <>
      <h1>Inventory</h1>
      <ErrorBanner message={warehouseError || error} onDismiss={() => setError("")} />

      {!loadingWarehouses && warehouses.length === 0 ? (
        <p>
          No warehouses yet. <Link to="/warehouses">Create a warehouse</Link> before adding inventory.
        </p>
      ) : (
        <label className="field-inline">
          Warehouse
          <select value={selectedId} onChange={(e) => setParams(e.target.value ? { warehouse: e.target.value } : {})}>
            <option value="">Select a warehouse...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.currentCapacity}/{w.maxCapacity})
              </option>
            ))}
          </select>
        </label>
      )}

      {selected && (
        <div className="layout-two-col">
          <section className="card">
            <h2>
              Items in {selected.name}{" "}
              <span className="muted">
                · {selected.maxCapacity - selected.currentCapacity} units of space left
              </span>
            </h2>
            {items.length === 0 ? (
              <p>No items in this warehouse yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Expires</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) =>
                    editingId === item.id ? (
                      <tr key={item.id}>
                        <td><input aria-label="Edit item name" value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                        <td><input aria-label="Edit SKU" value={editForm.sku}
                          onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} /></td>
                        <td><input aria-label="Edit category" value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} /></td>
                        <td><input aria-label="Edit storage location" value={editForm.storageLocation}
                          onChange={(e) => setEditForm({ ...editForm, storageLocation: e.target.value })} /></td>
                        <td><input aria-label="Edit quantity" type="number" min={1} value={editForm.quantity}
                          onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></td>
                        <td><input aria-label="Edit expiration date" type="date" value={editForm.expirationDate}
                          onChange={(e) => setEditForm({ ...editForm, expirationDate: e.target.value })} /></td>
                        <td className="actions">
                          <button onClick={() => handleSave(item.id)}>Save</button>
                          <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.sku}</td>
                        <td>{item.category}</td>
                        <td>{item.storageLocation}</td>
                        <td>{item.quantity}</td>
                        <td>{item.expirationDate}</td>
                        <td className="actions">
                          <button className="secondary" onClick={() => startEdit(item)}>Edit</button>
                          <button className="danger" onClick={() => handleDelete(item)}>Delete</button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </section>

          <section className="card form-card">
            <h2>Add Item</h2>
            <form onSubmit={handleAdd} className="form">
              <input placeholder="Item name" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="SKU" value={form.sku} required
                onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <input placeholder="Category" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input placeholder="Storage location (e.g. Aisle 3)" value={form.storageLocation}
                onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} />
              <input placeholder="Quantity" type="number" min={1} value={form.quantity} required
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <label className="field">
                Expiration date (optional)
                <input type="date" value={form.expirationDate}
                  onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
              </label>
              <button type="submit">Add Item</button>
            </form>
            <p className="hint">Adding a SKU that already exists here adds to its quantity.</p>
          </section>
        </div>
      )}
    </>
  );
}
