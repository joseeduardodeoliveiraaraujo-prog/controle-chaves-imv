import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { addKey, getKeys, updateKey, deleteKey } from "../services/firestore";

const emptyForm = { name: "", location: "", description: "" };

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

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
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: "" });
    }
  }

  function validateForm() {
    const errors = {};
    const name = form.name.trim();
    const location = form.location.trim();
    const description = form.description.trim();

    if (!name) {
      errors.name = "Nome é obrigatório.";
    } else if (name.length < 3 || name.length > 50) {
      errors.name = "Nome deve ter entre 3 e 50 caracteres.";
    }

    if (!location) {
      errors.location = "Local é obrigatório.";
    } else if (location.length < 2 || location.length > 80) {
      errors.location = "Local deve ter entre 2 e 80 caracteres.";
    }

    if (description.length > 200) {
      errors.description = "Descrição deve possuir no máximo 200 caracteres.";
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const trimmedForm = {
      name: form.name.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
    };

    try {
      if (editingId) {
        await updateKey(editingId, trimmedForm);
      } else {
        await addKey(trimmedForm);
      }
      setForm(emptyForm);
      setFieldErrors({});
      setEditingId(null);
      await loadKeys();
    } catch {
      setError("Erro ao salvar chave.");
    }
  }

  function handleEdit(key) {
    setForm({ name: key.name, location: key.location, description: key.description || "" });
    setEditingId(key.id);
    setFieldErrors({});
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
  }

  async function handleDelete(id) {
    if (!confirm("Tem certeza que deseja excluir esta chave?")) return;

    try {
      await deleteKey(id);
      await loadKeys();
    } catch (err) {
      setError(err.message || "Erro ao excluir chave.");
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-left">
          <h1>Controle de Chaves</h1>
          <nav className="header-nav">
            <Link to="/dashboard" className="nav-link">Painel</Link>
            <Link to="/chaves" className="nav-link active">Chaves</Link>
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
                maxLength={50}
                className={fieldErrors.name ? "input-error" : ""}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}

              <label htmlFor="location">Local</label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="Ex: Bloco A"
                value={form.location}
                onChange={handleChange}
                maxLength={80}
                className={fieldErrors.location ? "input-error" : ""}
              />
              {fieldErrors.location && <span className="field-error">{fieldErrors.location}</span>}

              <label htmlFor="description">Descrição</label>
              <input
                id="description"
                name="description"
                type="text"
                placeholder="Ex: Chave principal da Sala 5"
                value={form.description}
                onChange={handleChange}
                maxLength={200}
                className={fieldErrors.description ? "input-error" : ""}
              />
              {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}

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
              <div className="loading-inline">
                <div className="spinner"></div>
                <span>Carregando...</span>
              </div>
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
