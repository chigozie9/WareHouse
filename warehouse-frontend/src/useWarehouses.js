import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Loads the warehouse list and exposes a reload function. Used by every page.
export function useWarehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      setWarehouses(await api.listWarehouses());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { warehouses, loading, error, setError, reload };
}
