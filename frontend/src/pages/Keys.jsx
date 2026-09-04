import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addKey,
  getKeys,
  updateKey,
  deleteKey,
  migrateKeysOrder,
  saveKeysOrder,
} from "../services/firestore";

const emptyForm = { name: "", location: "", description: "" };

function SortableKeyCard({ item, isOrganizing, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`key-card ${isDragging ? "key-card-dragging" : ""}`}
    >
      <div className="key-info">
        <strong>{item.name}</strong>
        <span>{item.location}</span>
        {item.description && <span className="key-desc">{item.description}</span>}
      </div>
      {isOrganizing ? (
        <div className="drag-zone" {...attributes} {...listeners}>
          <span className="drag-zone-grip" aria-hidden="true">&#8942;&#8942;</span>
          <span className="drag-zone-label">Arraste para mover</span>
        </div>
      ) : (
        <div className="key-actions">
          <span className={`status-badge ${item.status}`}>
            {item.status === "available" ? "Disponível" : "Emprestada"}
          </span>
          <button className="btn-edit" onClick={() => onEdit(item)}>
            Editar
          </button>
          <button className="btn-delete" onClick={() => onDelete(item.id)}>
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [originalKeysSnapshot, setOriginalKeysSnapshot] = useState([]);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      await migrateKeysOrder();
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
        await addKey(trimmedForm, keys.length);
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

  function handleStartOrganizing() {
    setOriginalKeysSnapshot(keys.map((k) => ({ ...k })));
    setIsOrganizing(true);
  }

  async function handleSaveOrganizing() {
    try {
      await saveKeysOrder(keys);
      setIsOrganizing(false);
      setOriginalKeysSnapshot([]);
    } catch {
      setError("Erro ao salvar a ordem das chaves.");
    }
  }

  function handleCancelOrganizing() {
    setKeys(originalKeysSnapshot);
    setIsOrganizing(false);
    setOriginalKeysSnapshot([]);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setKeys((items) => {
      const oldIndex = items.findIndex((k) => k.id === active.id);
      const newIndex = items.findIndex((k) => k.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
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
            <div className="list-header">
              <h2>Chaves Cadastradas ({keys.length})</h2>
              {!isOrganizing ? (
                <button
                  className="btn-organize"
                  onClick={handleStartOrganizing}
                  disabled={keys.length < 2}
                >
                  <span className="btn-icon" aria-hidden="true">&#9998;</span>
                  Organizar ordem
                </button>
              ) : (
                <div className="organize-actions">
                  <button className="btn-save-organize" onClick={handleSaveOrganizing}>
                    <span className="btn-icon" aria-hidden="true">&#10003;</span>
                    Salvar alterações
                  </button>
                  <button className="btn-cancel-organize" onClick={handleCancelOrganizing}>
                    <span className="btn-icon" aria-hidden="true">&#10005;</span>
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="loading-inline">
                <div className="spinner"></div>
                <span>Carregando...</span>
              </div>
            ) : keys.length === 0 ? (
              <p className="empty-message">Nenhuma chave cadastrada ainda.</p>
            ) : isOrganizing ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={keys.map((k) => k.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="keys-list keys-list-sortable">
                    {keys.map((key) => (
                      <SortableKeyCard
                        key={key.id}
                        item={key}
                        isOrganizing={isOrganizing}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
