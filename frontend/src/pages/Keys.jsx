import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { addKey, getKeys, updateKey, deleteKey } from "../services/firestore";

const emptyForm = { name: "", location: "", description: "" };

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const data = await getKeys();
      setKeys(data);
    } catch {
      setError("Erro ao carregar chaves.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      if (editingId) {
        await updateKey(editingId, form);
      } else {
        await addKey(form);
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadKeys();
    } catch {
      setError("Erro ao salvar chave.");
    }
  }

  function handleEdit(key) {
    setForm({ name: key.name, location: key.location, description: key.description || "" });
    setEditingId(key.id);
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!confirm("Tem certeza que deseja excluir esta chave?")) return;

    try {
      await deleteKey(id);
      await loadKeys();
    } catch {
      setError("Erro ao excluir chave.");
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Controle de Chaves</h1>
        <div className="header-right">
          <span>{user?.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <main className="page-main">
        <div className="content-grid">
          <section className="form-section">
            <h2>{editingId ? "Editar Chave" : "Nova Chave"}</h2>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label htmlFor="name">Nome/Identificação</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Ex: Sala 5"
                value={form.name}
                onChange={handleChange}
                required
              />

              <label htmlFor="location">Local</label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="Ex: Bloco A"
                value={form.location}
                onChange={handleChange}
                required
              />

              <label htmlFor="description">Descrição</label>
              <input
                id="description"
                name="description"
                type="text"
                placeholder="Ex: Chave principal da Sala 5"
                value={form.description}
                onChange={handleChange}
              />

              <div className="form-buttons">
                <button type="submit">
                  {editingId ? "Salvar Alterações" : "Cadastrar"}
                </button>
                {editingId && (
                  <button type="button" className="btn-cancel" onClick={handleCancel}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="list-section">
            <h2>Chaves Cadastradas ({keys.length})</h2>

            {loading ? (
              <p>Carregando...</p>
            ) : keys.length === 0 ? (
              <p className="empty-message">Nenhuma chave cadastrada ainda.</p>
            ) : (
              <div className="keys-list">
                {keys.map((key) => (
                  <div key={key.id} className="key-card">
                    <div className="key-info">
                      <strong>{key.name}</strong>
                      <span>{key.location}</span>
                      {key.description && <span className="key-desc">{key.description}</span>}
                    </div>
                    <div className="key-actions">
                      <span className={`status-badge ${key.status}`}>
                        {key.status === "available" ? "Disponível" : "Emprestada"}
                      </span>
                      <button className="btn-edit" onClick={() => handleEdit(key)}>
                        Editar
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(key.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
