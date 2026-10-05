import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import NavBar from "./components/NavBar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Warehouses from "./pages/Warehouses.jsx";
import Inventory from "./pages/Inventory.jsx";
import Transfers from "./pages/Transfers.jsx";

function App() {
  return (
    <>
      <NavBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/warehouses" element={<Warehouses />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
