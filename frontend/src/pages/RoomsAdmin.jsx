import { useState, useEffect, useMemo } from "react";
import Header from "../components/Header";
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
  addRoom,
  getRooms,
  updateRoom,
  deleteRoom,
  saveRoomsOrder,
} from "../services/firestore";
import Modal from "../components/Modal";
import {
  SHIFTS,
  decodeSchedule,
  parseLocalDate,
  fullDate,
  businessDaysBetween,
  applyScheduleRange,
  applyScheduleOnDate,
} from "../utils/schedule";

const emptyForm = { name: "", location: "", description: "" };

const LIMITS = { name: 50, location: 50, description: 80 };

function restrictToVerticalAxis({ transform }) {
  return { ...transform, x: 0 };
}

function SortableRoomCard({ item, isOrganizing, onSchedule, onEdit, onDelete }) {
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
        {item.location && <span>{item.location}</span>}
        {item.description && <span className="key-desc">{item.description}</span>}
      </div>
      {isOrganizing ? (
        <div className="drag-zone" {...attributes} {...listeners}>
          <span className="drag-zone-grip" aria-hidden="true">&#8942;&#8942;</span>
          <span className="drag-zone-label">Arraste para mover</span>
        </div>
      ) : (
        <div className="key-actions">
          <button className="btn-schedule" onClick={() => onSchedule(item)}>
            Agendamento
          </button>
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

const SITUATION_OPTIONS = [
  { value: "occupied", label: "Ocupado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "available", label: "Livre" },
];

const PERIOD_OPTIONS = [
  { value: "Manha", label: "Manhã", shifts: ["Manhã"] },
  { value: "Tarde", label: "Tarde", shifts: ["Tarde"] },
  { value: "Ambos", label: "Manhã e Tarde", shifts: [...SHIFTS] },
];

const SCHEDULE_MODES = [
  { value: "single", label: "Data específica" },
  { value: "range", label: "Período" },
];

const EMPTY_SCHEDULE_FORM = {
  mode: "single",
  date: "",
  startDate: "",
  endDate: "",
  period: "Manha",
  situation: "occupied",
  notes: "",
};

const NOTES_LIMIT = 120;

function formatDayList(days) {
  const list = days.map((d) => d.short);
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} e ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
}

function ScheduleEditor({ room, onCancel }) {
  const [schedule, setSchedule] = useState(() => decodeSchedule(room.schedule));
  const [form, setForm] = useState(EMPTY_SCHEDULE_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [appliedMessage, setAppliedMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const singleDate = parseLocalDate(form.date);
  const startDate = parseLocalDate(form.startDate);
  const endDate = parseLocalDate(form.endDate);

  let previewText = "";
  if (form.mode === "single") {
    if (singleDate) {
      previewText = `Será agendado o dia ${fullDate(singleDate)}.`;
    }
  } else if (startDate && endDate && endDate >= startDate) {
    const days = businessDaysBetween(startDate, endDate);
    if (days.length > 0) {
      previewText = `Serão agendados os dias úteis: ${formatDayList(days)}.`;
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    if (name === "situation" && value === "available") {
      next.notes = "";
    }
    setForm(next);
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: "" });
    }
  }

  function handleModeChange(mode) {
    setForm({ ...form, mode });
    setFieldErrors({});
  }

  function validate() {
    const errors = {};
    if (form.mode === "single") {
      if (!form.date) {
        errors.date = "Data é obrigatória.";
      }
    } else {
      if (!form.startDate) {
        errors.startDate = "Data inicial é obrigatória.";
      }
      if (!form.endDate) {
        errors.endDate = "Data final é obrigatória.";
      }
      if (form.startDate && form.endDate && endDate < startDate) {
        errors.endDate = "A data final deve ser igual ou posterior à data inicial.";
      }
    }
    if (form.situation !== "available") {
      if (!form.notes.trim()) {
        errors.notes = "Responsável/Motivo é obrigatório.";
      } else if (form.notes.length > NOTES_LIMIT) {
        errors.notes = `Responsável/Motivo deve ter no máximo ${NOTES_LIMIT} caracteres.`;
      }
    }
    return errors;
  }

  async function handleApply(e) {
    e.preventDefault();
    setError("");
    setAppliedMessage("");
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const period = PERIOD_OPTIONS.find((p) => p.value === form.period);
    const payload = {
      shifts: period.shifts,
      situation: form.situation,
      notes: form.notes.trim(),
    };
    const next =
      form.mode === "single"
        ? applyScheduleOnDate(schedule, singleDate, payload)
        : applyScheduleRange(schedule, {
            start: startDate,
            end: endDate,
            ...payload,
          });

    setSaving(true);
    try {
      await updateRoom(room.id, { schedule: next });
      setSchedule(next);
      setAppliedMessage(
        form.mode === "single"
          ? `Agendamento aplicado ao dia ${fullDate(singleDate)}.`
          : (() => {
              const days = businessDaysBetween(startDate, endDate);
              return days.length === 1
                ? "Agendamento aplicado a 1 dia útil."
                : `Agendamento aplicado a ${days.length} dias úteis.`;
            })()
      );
    } catch (err) {
      setError(err.message || "Erro ao salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="schedule-editor">
      <p className="schedule-editor-hint">
        {form.mode === "single"
          ? "Escolha a data, o período e a situação. O agendamento será aplicado somente na data selecionada."
          : "Defina o intervalo de datas, o período e a situação. O agendamento será aplicado somente aos dias úteis (segunda a sexta) do intervalo."}
      </p>

      {error && <div className="error">{error}</div>}
      {appliedMessage && <div className="success">{appliedMessage}</div>}

      <form onSubmit={handleApply} noValidate>
        <div className="schedule-mode-toggle">
          {SCHEDULE_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={form.mode === mode.value ? "schedule-mode-active" : ""}
              onClick={() => handleModeChange(mode.value)}
              disabled={saving}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="range-fields">
          {form.mode === "single" ? (
            <div className="range-field">
              <label htmlFor="scheduleDate">Data</label>
              <input
                id="scheduleDate"
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                className={fieldErrors.date ? "input-error" : ""}
                disabled={saving}
              />
              {fieldErrors.date && (
                <span className="field-error">{fieldErrors.date}</span>
              )}
            </div>
          ) : (
            <>
              <div className="range-field">
                <label htmlFor="rangeStart">Data inicial</label>
                <input
                  id="rangeStart"
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                  className={fieldErrors.startDate ? "input-error" : ""}
                  disabled={saving}
                />
                {fieldErrors.startDate && (
                  <span className="field-error">{fieldErrors.startDate}</span>
                )}
              </div>

              <div className="range-field">
                <label htmlFor="rangeEnd">Data final</label>
                <input
                  id="rangeEnd"
                  name="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={handleChange}
                  className={fieldErrors.endDate ? "input-error" : ""}
                  disabled={saving}
                />
                {fieldErrors.endDate && (
                  <span className="field-error">{fieldErrors.endDate}</span>
                )}
              </div>
            </>
          )}

          <div className="range-field">
            <label htmlFor="rangePeriod">Período</label>
            <select
              id="rangePeriod"
              name="period"
              value={form.period}
              onChange={handleChange}
              disabled={saving}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="range-field">
            <label htmlFor="rangeSituation">Situação</label>
            <select
              id="rangeSituation"
              name="situation"
              value={form.situation}
              onChange={handleChange}
              disabled={saving}
            >
              {SITUATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.situation !== "available" && (
          <div className="range-field">
            <label htmlFor="rangeNotes">
              Responsável / Motivo
              <span className="char-count">
                {form.notes.length}/{NOTES_LIMIT}
              </span>
            </label>
            <input
              id="rangeNotes"
              name="notes"
              type="text"
              value={form.notes}
              onChange={handleChange}
              placeholder={
                form.situation === "occupied"
                  ? "Ex.: Nome do responsável"
                  : "Ex.: Motivo da manutenção"
              }
              maxLength={NOTES_LIMIT}
              className={fieldErrors.notes ? "input-error" : ""}
              disabled={saving}
            />
            {fieldErrors.notes && (
              <span className="field-error">{fieldErrors.notes}</span>
            )}
          </div>
        )}

        {previewText && <p className="range-preview">{previewText}</p>}

        <div className="schedule-editor-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-save-organize" disabled={saving}>
            {saving ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RoomsAdmin() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [originalRoomsSnapshot, setOriginalRoomsSnapshot] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [scheduleRoom, setScheduleRoom] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch {
      setError("Erro ao carregar salas.");
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
    } else if (name.length < 3 || name.length > LIMITS.name) {
      errors.name = `Nome deve ter entre 3 e ${LIMITS.name} caracteres.`;
    }

    if (!location) {
      errors.location = "Local é obrigatório.";
    } else if (location.length < 2 || location.length > LIMITS.location) {
      errors.location = `Local deve ter entre 2 e ${LIMITS.location} caracteres.`;
    }

    if (description.length > LIMITS.description) {
      errors.description = `Descrição deve possuir no máximo ${LIMITS.description} caracteres.`;
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
        await updateRoom(editingId, trimmedForm);
      } else {
        await addRoom(trimmedForm, rooms.length);
      }
      setForm(emptyForm);
      setFieldErrors({});
      setEditingId(null);
      await loadRooms();
    } catch {
      setError("Erro ao salvar sala.");
    }
  }

  function handleEdit(room) {
    setForm({
      name: room.name,
      location: room.location || "",
      description: room.description || "",
    });
    setEditingId(room.id);
    setFieldErrors({});
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
  }

  function handleOpenSchedule(room) {
    setScheduleRoom(room);
  }

  async function handleDelete(id) {
    if (!confirm("Tem certeza que deseja excluir esta sala?")) return;

    try {
      await deleteRoom(id);
      await loadRooms();
    } catch (err) {
      setError(err.message || "Erro ao excluir sala.");
    }
  }

  function handleStartOrganizing() {
    setOriginalRoomsSnapshot(rooms.map((r) => ({ ...r })));
    setSearchTerm("");
    setIsOrganizing(true);
  }

  async function handleSaveOrganizing() {
    try {
      await saveRoomsOrder(rooms);
      setIsOrganizing(false);
      setOriginalRoomsSnapshot([]);
    } catch {
      setError("Erro ao salvar a ordem das salas.");
    }
  }

  function handleCancelOrganizing() {
    setRooms(originalRoomsSnapshot);
    setIsOrganizing(false);
    setOriginalRoomsSnapshot([]);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setRooms((items) => {
      const oldIndex = items.findIndex((r) => r.id === active.id);
      const newIndex = items.findIndex((r) => r.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  const filteredRooms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        r.location?.toLowerCase().includes(term)
    );
  }, [rooms, searchTerm]);

  return (
    <div className="page-container">
      <Header showUser />

      <main className="page-main">
        <div className="content-grid">
          <section className="form-section">
            <h2>{editingId ? "Editar Sala" : "Nova Sala"}</h2>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label htmlFor="name">
                Nome/Identidade
                <span className="char-count">{form.name.length}/{LIMITS.name}</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Ex: Sala 1 Graduação"
                value={form.name}
                onChange={handleChange}
                maxLength={LIMITS.name}
                className={fieldErrors.name ? "input-error" : ""}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}

              <label htmlFor="location">
                Local
                <span className="char-count">{form.location.length}/{LIMITS.location}</span>
              </label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="Ex: Bloco A, 2º andar"
                value={form.location}
                onChange={handleChange}
                maxLength={LIMITS.location}
                className={fieldErrors.location ? "input-error" : ""}
              />
              {fieldErrors.location && <span className="field-error">{fieldErrors.location}</span>}

              <label htmlFor="description">
                Descrição
                <span className="char-count">{form.description.length}/{LIMITS.description}</span>
              </label>
              <input
                id="description"
                name="description"
                type="text"
                placeholder="Opcional — Ex: Sala de aula com capacidade para 40 pessoas"
                value={form.description}
                onChange={handleChange}
                maxLength={LIMITS.description}
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
              <h2>Salas Cadastradas ({rooms.length})</h2>
              {!isOrganizing ? (
                <button
                  className="btn-organize"
                  onClick={handleStartOrganizing}
                  disabled={rooms.length < 2}
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

            {rooms.length > 0 && !isOrganizing && (
              <div className="list-search">
                <span className="search-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Buscar por nome ou local..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {loading ? (
              <div className="loading-inline">
                <div className="spinner"></div>
                <span>Carregando...</span>
              </div>
            ) : rooms.length === 0 ? (
              <p className="empty-message">Nenhuma sala cadastrada ainda.</p>
            ) : isOrganizing ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext
                  items={rooms.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="keys-list keys-list-sortable">
                    {rooms.map((room) => (
                      <SortableRoomCard
                        key={room.id}
                        item={room}
                        isOrganizing={isOrganizing}
                        onSchedule={handleOpenSchedule}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : filteredRooms.length === 0 ? (
              <p className="empty-message">Nenhuma sala encontrada para a pesquisa.</p>
            ) : (
              <div className="keys-list">
                {filteredRooms.map((room) => (
                  <div key={room.id} className="key-card">
                    <div className="key-info">
                      <strong>{room.name}</strong>
                      {room.location && <span>{room.location}</span>}
                      {room.description && <span className="key-desc">{room.description}</span>}
                    </div>
                    <div className="key-actions">
                      <button className="btn-schedule" onClick={() => handleOpenSchedule(room)}>
                        Agendamento
                      </button>
                      <button className="btn-edit" onClick={() => handleEdit(room)}>
                        Editar
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(room.id)}>
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

      {scheduleRoom && (
        <Modal
          title={`Agendamento — ${scheduleRoom.name}`}
          onClose={() => setScheduleRoom(null)}
        >
          <ScheduleEditor
            room={scheduleRoom}
            onCancel={() => setScheduleRoom(null)}
          />
        </Modal>
      )}
    </div>
  );
}