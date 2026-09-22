import { useState, useMemo } from "react";
import {
  updateRoom,
  resetRoomSchedule,
} from "../services/firestore";
import {
  SHIFTS,
  decodeSchedule,
  parseLocalDate,
  fullDate,
  dateKey,
  getScheduleLimitDate,
  isDateAllowedForSchedule,
  businessDaysBetween,
  applyScheduleRange,
  applyScheduleOnDate,
} from "../utils/schedule";

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

const NOTES_LIMIT = 50;

function formatDayList(days) {
  const list = days.map((d) => d.short);
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} e ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
}

export default function ScheduleEditor({ room, onCancel, onScheduleReset }) {
  const [schedule, setSchedule] = useState(() => decodeSchedule(room.schedule));
  const [form, setForm] = useState(EMPTY_SCHEDULE_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [appliedMessage, setAppliedMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const scheduleLimit = useMemo(() => getScheduleLimitDate(), []);
  const scheduleLimitLabel = fullDate(scheduleLimit);
  const scheduleLimitKey = dateKey(scheduleLimit);
  const limitMessage = `Só é possível agendar até ${scheduleLimitLabel} (limite de 3 meses).`;

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
      } else if (!isDateAllowedForSchedule(singleDate, scheduleLimit)) {
        errors.date = limitMessage;
      }
    } else {
      if (!form.startDate) {
        errors.startDate = "Data inicial é obrigatória.";
      } else if (!isDateAllowedForSchedule(startDate, scheduleLimit)) {
        errors.startDate = limitMessage;
      }
      if (!form.endDate) {
        errors.endDate = "Data final é obrigatória.";
      } else if (!isDateAllowedForSchedule(endDate, scheduleLimit)) {
        errors.endDate = limitMessage;
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

  async function handleResetSchedule() {
    if (
      !window.confirm(
        "Todos os agendamentos desta sala serão apagados permanentemente. Esta ação não pode ser desfeita. Deseja continuar?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setAppliedMessage("");
    try {
      await resetRoomSchedule(room.id);
      onScheduleReset(room.id);
      onCancel();
    } catch (err) {
      setError(err.message || "Erro ao resetar os agendamentos.");
      setSaving(false);
    }
  }

  return (
    <div className="schedule-editor">
      <p className="schedule-editor-hint">
        {form.mode === "single"
          ? "Escolha a data, o turno e a situação. O agendamento será aplicado somente na data selecionada."
          : "Defina o intervalo de datas, o turno e a situação. O agendamento será aplicado somente aos dias úteis (segunda a sexta) do intervalo."}
      </p>
      {form.mode === "range" && (
        <p className="schedule-editor-limit">
          O limite para criação de agendamentos é de 3 meses: só é possível
          agendar até {scheduleLimitLabel}.
        </p>
      )}

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
                max={scheduleLimitKey}
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
                  max={scheduleLimitKey}
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
                  max={scheduleLimitKey}
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
            <label htmlFor="rangePeriod">Turno</label>
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
            className="btn-reset-schedule"
            onClick={handleResetSchedule}
            disabled={saving}
          >
            Resetar agendamentos
          </button>
          <button
            type="button"
            className="btn-schedule-cancel"
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