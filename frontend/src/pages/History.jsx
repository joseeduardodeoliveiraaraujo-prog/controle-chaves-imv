import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { getAllMovements } from "../services/firestore";

export default function History() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await getAllMovements();
      data.sort((a, b) => {
        const dateA = a.borrowedAt?.toDate() || new Date(0);
        const dateB = b.borrowedAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      setMovements(data);
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

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString("pt-BR");
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

      <main className="page-main">
        <h2>Histórico de Movimentações</h2>
        <p className="subtitle">Todas as retiradas e devoluções registradas.</p>

        {loading ? (
          <div className="loading-inline">
            <div className="spinner"></div>
            <span>Carregando...</span>
          </div>
        ) : movements.length === 0 ? (
          <p className="empty-message">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Chave</th>
                  <th>Pessoa</th>
                  <th>Retirada</th>
                  <th>Previsão</th>
                  <th>Devolução</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const now = new Date();
                  const isOverdue =
                    m.status === "active" &&
                    m.expectedReturnAt &&
                    m.expectedReturnAt.toDate() < now;

                  return (
                    <tr key={m.id} className={isOverdue ? "row-overdue" : ""}>
                      <td>{m.keyName}</td>
                      <td>{m.personName}</td>
                      <td>{formatDate(m.borrowedAt)}</td>
                      <td>{formatDate(m.expectedReturnAt)}</td>
                      <td>{m.returnedAt ? formatDate(m.returnedAt) : "—"}</td>
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
