import { NavLink } from "react-router-dom";

// Simple inline SVG icons (no icon library needed)
const icons = {
  dashboard: (
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
  ),
  warehouses: (
    <path d="M2 9 12 4l10 5v11h-3v-8H5v8H2zm5 5h10v2H7zm0 3h10v3H7z" />
  ),
  inventory: (
    <path d="M12 2 3 7v10l9 5 9-5V7zm0 2.3L18.7 8 12 11.7 5.3 8zM5 9.7l6 3.3v6.6l-6-3.3zm8 9.9V13l6-3.3v6.6z" />
  ),
  transfers: (
    <path d="M7 7h11l-3-3 1.4-1.4L22 8l-5.6 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2 16l5.6-5.4L9 12l-3 3h11z" />
  ),
};

const links = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/warehouses", label: "Warehouses", icon: "warehouses" },
  { to: "/inventory", label: "Inventory", icon: "inventory" },
  { to: "/transfers", label: "Transfers", icon: "transfers" },
];

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <span className="brand">Warehouse Inventory Manager</span>
        <nav aria-label="Main">
          <ul className="nav-links">
            {links.map(({ to, label, icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="nav-link">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
                    {icons[icon]}
                  </svg>
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
