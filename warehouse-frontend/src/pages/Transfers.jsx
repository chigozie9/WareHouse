import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ErrorBanner from "../components/ErrorBanner.jsx";
import { useWarehouses } from "../useWarehouses";

const emptyForm = { sourceWarehouseId: "", destinationWarehouseId: "", sku: "", quantity: "" };

export default function Transfers() {
  const { warehouses, loading, error: warehouseError, reload } = useWarehouses();
  const [form, setForm] = useState(emptyForm);
  const [loaded, setLoaded] = useState({ warehouseId: null, items: [] });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sourceItems = loaded.warehouseId === form.sourceWarehouseId ? loaded.items : [];

  async function loadSourceItems(warehouseId) {
    setLoaded({ warehouseId, items: await api.listItems(warehouseId) });
  }

  // When the source warehouse changes, load its items so the user can pick a SKU
  useEffect(() => {
    const warehouseId = form.sourceWarehouseId;
    if (!warehouseId) return;
    let cancelled = false;
    api.listItems(warehouseId)
      .then((items) => !cancelled && setLoaded({ warehouseId, items }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [form.sourceWarehouseId]);

  const selectedItem = sourceItems.find((i) => i.sku === form.sku);
  const destinations = warehouses.filter((w) => String(w.id) !== form.sourceWarehouseId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await api.transfer({
        sourceWarehouseId: Number(form.sourceWarehouseId),
        destinationWarehouseId: Number(form.destinationWarehouseId),
        sku: form.sku,
        quantity: Number(form.quantity),
      });
      setSuccess(res.message);
      setForm({ ...form, sku: "", quantity: "" });
      await loadSourceItems(form.sourceWarehouseId);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!loading && warehouses.length < 2) {
    return (
      <>
        <h1>Transfers</h1>
        <ErrorBanner message={warehouseError} />
        <p>
          You need at least two warehouses to transfer stock.{" "}
          <Link to="/warehouses">Manage warehouses</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Transfers</h1>
      <ErrorBanner message={warehouseError || error} onDismiss={() => setError("")} />
      {success && <div role="status" className="banner banner-success">{success}</div>}

      <section className="card form-card">
        <h2>Move stock between warehouses</h2>
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            From
            <select required value={form.sourceWarehouseId}
              onChange={(e) => setForm({ ...emptyForm, sourceWarehouseId: e.target.value })}>
              <option value="">Select source warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            Item
            <select required value={form.sku} disabled={!form.sourceWarehouseId}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}>
              <option value="">
                {form.sourceWarehouseId && sourceItems.length === 0 ? "No items in this warehouse" : "Select item..."}
              </option>
              {sourceItems.map((i) => (
                <option key={i.id} value={i.sku}>{i.name} ({i.sku}) · {i.quantity} available</option>
              ))}
            </select>
          </label>

          <label className="field">
            To
            <select required value={form.destinationWarehouseId}
              onChange={(e) => setForm({ ...form, destinationWarehouseId: e.target.value })}>
              <option value="">Select destination warehouse...</option>
              {destinations.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.maxCapacity - w.currentCapacity} space left)
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Quantity
            <input type="number" required min={1} max={selectedItem?.quantity}
              value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </label>

          <button type="submit">Transfer</button>
        </form>
      </section>
    </>
  );
}
