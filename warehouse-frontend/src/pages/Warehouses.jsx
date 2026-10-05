import { useState } from "react";
import { api } from "../api";
import ErrorBanner from "../components/ErrorBanner.jsx";
import { useWarehouses } from "../useWarehouses";

const emptyForm = { name: "", location: "", maxCapacity: "" };

export default function Warehouses() {
  const { warehouses, loading, error, setError, reload } = useWarehouses();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function run(action) {
    try {
      setError("");
      await action();
      await reload();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const ok = await run(() => api.createWarehouse({ ...form, maxCapacity: Number(form.maxCapacity) }));
    if (ok) setForm(emptyForm);
  }

  function startEdit(w) {
    setEditingId(w.id);
    setEditForm({ name: w.name, location: w.location ?? "", maxCapacity: w.maxCapacity });
  }

  async function handleSave(id) {
    const ok = await run(() =>
      api.updateWarehouse(id, { ...editForm, maxCapacity: Number(editForm.maxCapacity) })
    );
    if (ok) setEditingId(null);
  }

  async function handleDelete(w) {
    if (window.confirm(`Delete warehouse "${w.name}"?`)) {
      await run(() => api.deleteWarehouse(w.id));
    }
  }

  return (
    <>
      <h1>Warehouses</h1>
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="layout-two-col">
        <section className="card">
          <h2>All warehouses</h2>
          {loading && <p>Loading warehouses...</p>}
          {!loading && warehouses.length === 0 && !error && <p>No warehouses yet.</p>}

          {!loading && warehouses.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) =>
                  editingId === w.id ? (
                    <tr key={w.id}>
                      <td>
                        <input aria-label="Edit name" value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label="Edit location" value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label="Edit max capacity" type="number" min={0} value={editForm.maxCapacity}
                          onChange={(e) => setEditForm({ ...editForm, maxCapacity: e.target.value })} />
                      </td>
                      <td className="actions">
                        <button onClick={() => handleSave(w.id)}>Save</button>
                        <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td>{w.location}</td>
                      <td>{w.currentCapacity}/{w.maxCapacity}</td>
                      <td className="actions">
                        <button className="secondary" onClick={() => startEdit(w)}>Edit</button>
                        <button className="danger" onClick={() => handleDelete(w)}>Delete</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </section>

        <section className="card form-card">
          <h2>Add Warehouse</h2>
          <form onSubmit={handleCreate} className="form">
            <input type="text" placeholder="Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input type="text" placeholder="Location" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            <input type="number" placeholder="Max Capacity" min={0} value={form.maxCapacity}
              onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} required />
            <button type="submit">Create</button>
          </form>
        </section>
      </div>
    </>
  );
}
