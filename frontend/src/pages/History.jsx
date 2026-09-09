import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { getAllMovements, getPeople } from "../services/firestore";
import { formatPhone } from "../utils/format";

export default function History() {
  const [movements, setMovements] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const [movementsData, peopleData] = await Promise.all([
        getAllMovements(),
        getPeople(),
      ]);
      movementsData.sort((a, b) => {
        const dateA = a.borrowedAt?.toDate() || new Date(0);
        const dateB = b.borrowedAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      setMovements(movementsData);
      setPeople(peopleData);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString("pt-BR");
  }

  function toLocalDateString(timestamp) {
    if (!timestamp) return "";
    const d = timestamp.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const filteredMovements = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return movements.filter((m) => {
      if (term) {
        const matchKey = m.keyName?.toLowerCase().includes(term);
        const matchPerson = m.personName?.toLowerCase().includes(term);
        if (!matchKey && !matchPerson) return false;
      }
      if (dateFrom || dateTo) {
        const borrowedDate = toLocalDateString(m.borrowedAt);
        if (!borrowedDate) return false;
        if (dateFrom && borrowedDate < dateFrom) return false;
        if (dateTo && borrowedDate > dateTo) return false;
      }
      return true;
    });
  }, [movements, searchTerm, dateFrom, dateTo]);

  const peopleById = useMemo(() => {
    const map = new Map();
    people.forEach((p) => map.set(p.id, p));
    return map;
  }, [people]);

  function getPhone(movement) {
    if (movement.personPhone) {
      return formatPhone(String(movement.personPhone).replace(/\D/g, ""));
    }
    const person = peopleById.get(movement.personId);
    const phone = (person?.phone || "").replace(/\D/g, "");
    if (!phone) return "-";
    return formatPhone(phone);
  }

  const hasActiveFilters = searchTerm.trim() !== "" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-left">
          <h1>Controle de Chaves</h1>
          <nav className="header-nav">
            <Link to="/dashboard" className="nav-link">Painel</Link>
            <Link to="/chaves" className="nav-link">Chaves</Link>
            <Link to="/pessoas" className="nav-link">Pessoas</Link>
            <Link to="/historico" className="nav-link active">Histórico</Link>
          </nav>
        </div>
        <div className="header-right">
          <span className="header-email">{user?.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <main className="page-main history-main">
        <h2>Histórico de Movimentações</h2>
        <p className="subtitle">Todas as retiradas e devoluções registradas.</p>

        {!loading && movements.length > 0 && (
          <div className="history-filters">
            <div className="filter-row">
              <div className="filter-group filter-search">
                <label htmlFor="search">Pesquisar</label>
                <div className="list-search">
                  <span className="search-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </span>
                  <input
                    id="search"
                    type="text"
                    placeholder="Nome da chave ou pessoa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="filter-group">
                <label htmlFor="dateFrom">De</label>
                <input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="dateTo">Até</label>
                <input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              {hasActiveFilters && (
                <button className="btn-clear-filters" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-inline">
            <div className="spinner"></div>
            <span>Carregando...</span>
          </div>
        ) : movements.length === 0 ? (
          <p className="empty-message">Nenhuma movimentação registrada.</p>
        ) : filteredMovements.length === 0 ? (
          <p className="empty-message">Nenhuma movimentação encontrada para os filtros selecionados.</p>
        ) : (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Chave</th>
                  <th>Pessoa</th>
                  <th>Telefone</th>
                  <th>Retirada</th>
                  <th>Previsão</th>
                  <th>Devolução</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m, index) => {
                  const now = new Date();
                  const isOverdue =
                    m.status === "active" &&
                    m.expectedReturnAt &&
                    m.expectedReturnAt.toDate() < now;

                  return (
                    <tr key={m.id} className={isOverdue ? "row-overdue" : ""}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="truncate-cell key-name" title={m.keyName}>{m.keyName}</span>
                      </td>
                      <td>
                        <span className="truncate-cell person-name" title={m.personName}>{m.personName}</span>
                      </td>
                      <td className="nowrap">{getPhone(m)}</td>
                      <td className="nowrap">{formatTimestamp(m.borrowedAt)}</td>
                      <td className="nowrap">{formatTimestamp(m.expectedReturnAt)}</td>
                      <td className="nowrap">{m.returnedAt ? formatTimestamp(m.returnedAt) : "—"}</td>
                      <td>
                        <span className={`status-badge ${isOverdue ? "overdue" : m.status === "active" ? "borrowed" : "available"}`}>
                          {isOverdue ? "Atrasada" : m.status === "active" ? "Em uso" : "Devolvida"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
