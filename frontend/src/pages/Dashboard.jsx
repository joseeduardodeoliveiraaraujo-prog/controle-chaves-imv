import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { getKeys, getActiveMovements, returnKey } from "../services/firestore";
import Modal from "../components/Modal";
import WithdrawalForm from "../components/WithdrawalForm";

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    borrowed: 0,
    overdue: 0,
  });
  const [activeMovements, setActiveMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [keys, movements] = await Promise.all([
        getKeys(),
        getActiveMovements(),
      ]);

      const now = new Date();
      let overdueCount = 0;

      movements.forEach((m) => {
        if (m.expectedReturnAt && m.expectedReturnAt.toDate() < now) {
          overdueCount++;
        }
      });

      setStats({
        total: keys.length,
        available: keys.filter((k) => k.status === "available").length,
        borrowed: movements.length,
        overdue: overdueCount,
      });

      setActiveMovements(movements);
    } catch {
      // Silently handle errors for now
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function handleWithdrawalSuccess() {
    setShowModal(false);
    loadDashboard();
  }

  async function handleReturn(movementId, keyId) {
    if (!confirm("Confirmar devolução desta chave?")) return;

    try {
      await returnKey(movementId, keyId);
      await loadDashboard();
    } catch (err) {
      alert(err.message || "Erro ao devolver chave.");
    }
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-left">
          <h1>Controle de Chaves</h1>
          <nav className="header-nav">
            <Link to="/dashboard" className="nav-link active">Painel</Link>
            <Link to="/chaves" className="nav-link">Chaves</Link>
            <Link to="/pessoas" className="nav-link">Pessoas</Link>
            <Link to="/historico" className="nav-link">Histórico</Link>
          </nav>
        </div>
        <div className="header-right">
          <span className="header-email">{user?.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <main className="page-main">
        <div className="page-title-row">
          <h2>Painel</h2>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Retirar Chave
          </button>
        </div>

        {loading ? (
          <div className="loading-inline">
            <div className="spinner"></div>
            <span>Carregando...</span>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat-card available">
                <span className="stat-number">{stats.available}</span>
                <span className="stat-label">Disponíveis</span>
              </div>
              <div className="stat-card borrowed">
                <span className="stat-number">{stats.borrowed}</span>
                <span className="stat-label">Emprestadas</span>
              </div>
              <div className="stat-card overdue">
                <span className="stat-number">{stats.overdue}</span>
                <span className="stat-label">Atrasadas</span>
              </div>
            </div>

            <section className="movements-section">
              <h3>Chaves Emprestadas</h3>
              {activeMovements.length === 0 ? (
                <p className="empty-message">Nenhuma chave emprestada no momento.</p>
              ) : (
                <div className="keys-list">
                  {activeMovements.map((m) => {
                    const now = new Date();
                    const isOverdue =
                      m.expectedReturnAt && m.expectedReturnAt.toDate() < now;

                    return (
                      <div
                        key={m.id}
                        className={`key-card ${isOverdue ? "overdue" : ""}`}
                      >
                        <div className="key-info">
                          <strong>{m.keyName}</strong>
                          <span>Responsável: {m.personName}</span>
                          <span>
                            Retirada:{" "}
                            {m.borrowedAt
                              ? m.borrowedAt.toDate().toLocaleString("pt-BR")
                              : "—"}
                          </span>
                          <span>
                            Previsão:{" "}
                            {m.expectedReturnAt
                              ? m.expectedReturnAt.toDate().toLocaleDateString("pt-BR")
                              : "—"}
                            {isOverdue && <span className="overdue-tag"> ATRASADA</span>}
                          </span>
                        </div>
                        <div className="key-actions">
                          <button
                            className="btn-return"
                            onClick={() => handleReturn(m.id, m.keyId)}
                          >
                            Devolver
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <nav className="nav-cards">
              <Link to="/chaves" className="nav-card">
                <h3>Chaves</h3>
                <p>Cadastrar e gerenciar chaves</p>
              </Link>
              <Link to="/pessoas" className="nav-card">
                <h3>Pessoas</h3>
                <p>Cadastrar pessoas autorizadas</p>
              </Link>
              <Link to="/historico" className="nav-card">
                <h3>Histórico</h3>
                <p>Ver todas as movimentações</p>
              </Link>
            </nav>
          </>
        )}
      </main>

      {showModal && (
        <Modal title="Retirar Chave" onClose={() => setShowModal(false)}>
          <WithdrawalForm
            onSuccess={handleWithdrawalSuccess}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}
