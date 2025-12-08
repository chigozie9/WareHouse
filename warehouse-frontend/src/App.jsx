import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8080/api";

function App() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newWarehouse, setNewWarehouse] = useState({
    name: "",
    location: "",
    maxCapacity: 0,
  });

  // -------- API calls --------

  async function loadWarehouses() {
    try {
      setError("");
      setLoading(true);

      const res = await fetch(`${API_BASE}/warehouses`);
      if (!res.ok) {
        throw new Error("Failed to load warehouses");
      }

      const data = await res.json();
      setWarehouses(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function handleCreateWarehouse(e) {
    e.preventDefault();
    try {
      setError("");

      const res = await fetch(`${API_BASE}/warehouses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newWarehouse,
          maxCapacity: Number(newWarehouse.maxCapacity),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to create warehouse");
      }

      // Clear form
      setNewWarehouse({ name: "", location: "", maxCapacity: 0 });

      // Refresh list
      await loadWarehouses();
    } catch (e) {
      setError(e.message);
    }
  }

  // -------- UI --------

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#020617",
        color: "white",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1
        style={{
          marginBottom: "1.5rem",
          fontSize: "3rem",
          fontWeight: 800,
        }}
      >
        Warehouse Inventory Manager
      </h1>

      {error && (
        <div
          style={{
            backgroundColor: "#f97373",
            color: "#111827",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            maxWidth: "500px",
          }}
        >
          {error}
        </div>
      )}

      {loading && <p>Loading warehouses...</p>}

      {!loading && warehouses.length === 0 && !error && (
        <p>No warehouses yet.</p>
      )}

      {!loading && warehouses.length > 0 && (
        <ul style={{ marginBottom: "1.5rem" }}>
          {warehouses.map((wh) => (
            <li key={wh.id}>
              {wh.name} — {wh.location} (capacity {wh.currentCapacity}/
              {wh.maxCapacity})
            </li>
          ))}
        </ul>
      )}

      {/* Add Warehouse Card */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          maxWidth: "320px",
          backgroundColor: "#020617",
          border: "1px solid #1f2937",
          borderRadius: "0.75rem",
          boxShadow: "0 10px 40px rgba(15,23,42,0.7)",
        }}
      >
        <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
          Add Warehouse
        </h2>
        <form
          onSubmit={handleCreateWarehouse}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <input
            type="text"
            placeholder="Name"
            value={newWarehouse.name}
            onChange={(e) =>
              setNewWarehouse({ ...newWarehouse, name: e.target.value })
            }
            required
          />
          <input
            type="text"
            placeholder="Location"
            value={newWarehouse.location}
            onChange={(e) =>
              setNewWarehouse({ ...newWarehouse, location: e.target.value })
            }
            required
          />
          <input
            type="number"
            placeholder="Max Capacity"
            value={newWarehouse.maxCapacity}
            onChange={(e) =>
              setNewWarehouse({
                ...newWarehouse,
                maxCapacity: e.target.value,
              })
            }
            min={0}
            required
          />
          <button type="submit">Create</button>
        </form>
      </div>
    </div>
  );
}

export default App;
