import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  addPerson,
  getPeople,
  updatePerson,
  deletePerson,
} from "../services/firestore";

const emptyForm = { name: "", phone: "", email: "", sector: "" };

export default function People() {
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadPeople();
  }, []);

  async function loadPeople() {
    try {
      const data = await getPeople();
      setPeople(data);
    } catch {
      setError("Erro ao carregar pessoas.");
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
        await updatePerson(editingId, form);
      } else {
        await addPerson(form);
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadPeople();
    } catch {
      setError("Erro ao salvar pessoa.");
    }
  }

  function handleEdit(person) {
    setForm({
      name: person.name,
      phone: person.phone,
      email: person.email || "",
      sector: person.sector || "",
    });
    setEditingId(person.id);
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!confirm("Tem certeza que deseja excluir esta pessoa?")) return;

    try {
      await deletePerson(id);
      await loadPeople();
    } catch {
      setError("Erro ao excluir pessoa.");
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
            <h2>{editingId ? "Editar Pessoa" : "Nova Pessoa"}</h2>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Ex: João Silva"
                value={form.name}
                onChange={handleChange}
                required
              />

              <label htmlFor="phone">Telefone</label>
              <input
                id="phone"
                name="phone"
                type="text"
                placeholder="Ex: (91) 99999-1234"
                value={form.phone}
                onChange={handleChange}
                required
              />

              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Opcional"
                value={form.email}
                onChange={handleChange}
              />

              <label htmlFor="sector">Setor</label>
              <input
                id="sector"
                name="sector"
                type="text"
                placeholder="Ex: TI, Administração"
                value={form.sector}
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
            <h2>Pessoas Cadastradas ({people.length})</h2>

            {loading ? (
              <p>Carregando...</p>
            ) : people.length === 0 ? (
              <p className="empty-message">Nenhuma pessoa cadastrada ainda.</p>
            ) : (
              <div className="keys-list">
                {people.map((person) => (
                  <div key={person.id} className="key-card">
                    <div className="key-info">
                      <strong>{person.name}</strong>
                      <span>{person.phone}</span>
                      {person.email && <span>{person.email}</span>}
                      {person.sector && <span className="key-desc">{person.sector}</span>}
                    </div>
                    <div className="key-actions">
                      <button className="btn-edit" onClick={() => handleEdit(person)}>
                        Editar
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(person.id)}>
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
