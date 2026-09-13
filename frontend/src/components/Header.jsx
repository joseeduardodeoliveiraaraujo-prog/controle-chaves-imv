import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const KEY_ENV_LINKS = [
  { to: "/dashboard", label: "Painel" },
  { to: "/chaves", label: "Chaves" },
  { to: "/pessoas", label: "Pessoas" },
  { to: "/salas", label: "Salas" },
  { to: "/historico", label: "Histórico" },
];

function isLinkActive(pathname, link) {
  if (link.to === "/salas") {
    return pathname === "/salas" || pathname.startsWith("/salas");
  }
  return pathname === link.to;
}

export default function Header({ showUser = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const titleWrapRef = useRef(null);

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isSalasEnv = pathname.startsWith("/salas");
  const currentTitle = isSalasEnv ? "Controle de Salas" : "Controle de Chaves";

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        titleWrapRef.current &&
        !titleWrapRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function goTo(path) {
    setMenuOpen(false);
    navigate(path);
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="page-header">
      <div className="header-left">
        <div className="header-title-wrap" ref={titleWrapRef}>
          <button
            type="button"
            className={`header-selector ${menuOpen ? "open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="header-selector-label">{currentTitle}</span>
            <span className="header-selector-caret" aria-hidden="true">&#9662;</span>
          </button>

          {menuOpen && (
            <div className="header-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className={`header-menu-item ${isSalasEnv ? "" : "active"}`}
                onClick={() => goTo("/dashboard")}
              >
                Controle de Chaves
              </button>
              <button
                type="button"
                role="menuitem"
                className={`header-menu-item ${isSalasEnv ? "active" : ""}`}
                onClick={() => goTo("/salas")}
              >
                Controle de Salas
              </button>
            </div>
          )}
        </div>

        <nav className="header-nav">
          {isSalasEnv ? (
            <Link
              to="/salas"
              className={`nav-link ${pathname.startsWith("/salas") ? "active" : ""}`}
            >
              Salas
            </Link>
          ) : (
            KEY_ENV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isLinkActive(pathname, link) ? "active" : ""}`}
              >
                {link.label}
              </Link>
            ))
          )}
        </nav>
      </div>

      {showUser && (
        <div className="header-right">
          <span className="header-email">{user?.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      )}
    </header>
  );
}