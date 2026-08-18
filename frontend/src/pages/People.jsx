import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  addPerson,
  getPeople,
  updatePerson,
  deletePerson,
} from "../services/firestore";

const emptyForm = { name: "", phone: "", email: "", sector: "" };

function formatPhone(digits) {
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${ddd}) ${number}`;
  if (digits.length <= 10) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

export default function People() {
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

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
    const { name, value } = e.target;
    if (name === "phone") {
      const digits = value.replace(/\D/g, "").slice(0, 11);
      setForm({ ...form, phone: formatPhone(digits) });
    } else {
      setForm({ ...form, [name]: value });
    }
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: "" });
    }
  }

  function validateForm() {
    const errors = {};
    const name = form.name.trim();
    const phone = form.phone.replace(/\D/g, "");
    const email = form.email.trim();
    const sector = form.sector.trim();

    if (!name) {
      errors.name = "Nome é obrigatório.";
    } else if (name.length < 3 || name.length > 100) {
      errors.name = "Nome deve ter entre 3 e 100 caracteres.";
    }

    if (!phone) {
      errors.phone = "Telefone é obrigatório.";
    } else if (phone.length < 10 || phone.length > 11) {
      errors.phone = "Telefone deve possuir 10 ou 11 dígitos.";
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "E-mail inválido.";
    }

    if (!sector) {
      errors.sector = "Setor é obrigatório.";
    } else if (sector.length < 2 || sector.length > 80) {
      errors.sector = "Setor deve ter entre 2 e 80 caracteres.";
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
      phone: form.phone.replace(/\D/g, ""),
      email: form.email.trim(),
      sector: form.sector.trim(),
    };

    try {
      if (editingId) {
        await updatePerson(editingId, trimmedForm);
      } else {
        await addPerson(trimmedForm);
      }
      setForm(emptyForm);
      setFieldErrors({});
      setEditingId(null);
      await loadPeople();
    } catch {
      setError("Erro ao salvar pessoa.");
    }
  }

  function handleEdit(person) {
    setForm({
      name: person.name,
      phone: formatPhone((person.phone || "").replace(/\D/g, "")),
      email: person.email || "",
      sector: person.sector || "",
    });
    setEditingId(person.id);
    setFieldErrors({});
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
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
        <div className="header-left">
          <h1>Controle de Chaves</h1>
          <nav className="header-nav">
            <Link to="/dashboard" className="nav-link">Painel</Link>
            <Link to="/chaves" className="nav-link">Chaves</Link>
            <Link to="/pessoas" className="nav-link active">Pessoas</Link>
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
                maxLength={100}
                className={fieldErrors.name ? "input-error" : ""}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}

              <label htmlFor="phone">Telefone</label>
              <input
                id="phone"
                name="phone"
                type="text"
                inputMode="numeric"
                placeholder="Ex: (91) 98765-4321"
                value={form.phone}
                onChange={handleChange}
                className={fieldErrors.phone ? "input-error" : ""}
              />
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}

              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Opcional"
                value={form.email}
                onChange={handleChange}
                className={fieldErrors.email ? "input-error" : ""}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}

              <label htmlFor="sector">Setor</label>
              <input
                id="sector"
                name="sector"
                type="text"
                placeholder="Ex: TI, Administração"
                value={form.sector}
                onChange={handleChange}
                maxLength={80}
                className={fieldErrors.sector ? "input-error" : ""}
              />
              {fieldErrors.sector && <span className="field-error">{fieldErrors.sector}</span>}

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
              <div className="loading-inline">
                <div className="spinner"></div>
                <span>Carregando...</span>
              </div>
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
