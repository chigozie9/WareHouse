import { Link } from "react-router-dom";
import ErrorBanner from "../components/ErrorBanner.jsx";
import { useWarehouses } from "../useWarehouses";

function percent(used, max) {
  return max > 0 ? Math.round((used / max) * 100) : 0;
}

export default function Dashboard() {
  const { warehouses, loading, error } = useWarehouses();

  const totalMax = warehouses.reduce((sum, w) => sum + w.maxCapacity, 0);
  const totalUsed = warehouses.reduce((sum, w) => sum + w.currentCapacity, 0);
  const nearlyFull = warehouses.filter((w) => percent(w.currentCapacity, w.maxCapacity) >= 90);

  return (
    <>
      <h1>Dashboard</h1>
      <ErrorBanner message={error} />
      {loading && <p>Loading warehouses...</p>}

      {!loading && !error && warehouses.length === 0 && (
        <p>
          No warehouses yet. <Link to="/warehouses">Create your first warehouse</Link>.
        </p>
      )}

      {!loading && warehouses.length > 0 && (
        <>
          <section className="stats" aria-label="Summary">
            <div className="stat">
              <span className="stat-value">{warehouses.length}</span>
              <span className="stat-label">Warehouses</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totalUsed}</span>
              <span className="stat-label">Units stored</span>
            </div>
            <div className="stat">
              <span className="stat-value">{percent(totalUsed, totalMax)}%</span>
              <span className="stat-label">Overall capacity used</span>
            </div>
            <div className="stat">
              <span className="stat-value">{nearlyFull.length}</span>
              <span className="stat-label">Nearly full (90%+)</span>
            </div>
          </section>

          <section className="card">
            <h2>Capacity by warehouse</h2>
            <ul className="capacity-list">
              {warehouses.map((w) => {
                const pct = percent(w.currentCapacity, w.maxCapacity);
                return (
                  <li key={w.id}>
                    <div className="capacity-row">
                      <span>{w.name}</span>
                      <span className="muted">
                        {w.currentCapacity}/{w.maxCapacity} ({pct}%)
                      </span>
                    </div>
                    <div
                      className="bar"
                      role="progressbar"
                      aria-label={`${w.name} capacity`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={`bar-fill ${pct >= 90 ? "bar-full" : ""}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
