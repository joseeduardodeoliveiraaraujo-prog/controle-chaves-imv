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
import ScheduleCalendar from "./ScheduleCalendar";

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
  { value: "calendar", label: "Datas específicas" },
  { value: "range", label: "Período" },
];

const EMPTY_SCHEDULE_FORM = {
  mode: "calendar",
  dates: [],
  startDate: "",
  endDate: "",
  period: "Manha",
  situation: "occupied",
  notes: "",
};

const NOTES_LIMIT = 50;

const MAX_LISTED_DATES = 5;

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

  const today = new Date();
  const scheduleLimit = getScheduleLimitDate(today);
  const scheduleLimitLabel = fullDate(scheduleLimit);
  const scheduleLimitKey = dateKey(scheduleLimit);
  const todayKey = dateKey(today);
  const limitMessage = `Só é possível agendar até ${scheduleLimitLabel} (limite de 3 meses).`;
  const pastMessage = "A data não pode ser anterior à data de hoje.";

  const startDate = parseLocalDate(form.startDate);
  const endDate = parseLocalDate(form.endDate);
  const selectedDates = useMemo(() => [...(form.dates || [])].sort(), [
    form.dates,
  ]);

  let previewText = "";
  if (form.mode === "range") {
    if (startDate && endDate && endDate >= startDate) {
      const days = businessDaysBetween(startDate, endDate);
      if (days.length > 0) {
        previewText = `Serão agendados os dias úteis: ${formatDayList(days)}.`;
      }
    }
  }

  let selectionText = "";
  if (selectedDates.length > 0) {
    selectionText =
      selectedDates.length <= MAX_LISTED_DATES
        ? selectedDates.map((key) => fullDate(parseLocalDate(key))).join(" · ")
        : `${selectedDates.length} dias · ${fullDate(
            parseLocalDate(selectedDates[0])
          )} a ${fullDate(parseLocalDate(selectedDates[selectedDates.length - 1]))}`;
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

  function isDateBeforeToday(date) {
    return Boolean(date) && dateKey(date) < todayKey;
  }

  function isDateSelectable(key) {
    const date = parseLocalDate(key);
    if (!date || dateKey(date) !== key) return false;
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    return (
      !isDateBeforeToday(date) &&
      isDateAllowedForSchedule(date, scheduleLimit)
    );
  }

  function handleToggleDate(key) {
    if (!isDateSelectable(key)) return;
    setForm((prev) => {
      const current = prev.dates || [];
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      return { ...prev, dates: next.sort() };
    });
    if (fieldErrors.dates) {
      setFieldErrors((prev) => ({ ...prev, dates: "" }));
    }
  }

  function handleClearDates() {
    setForm((prev) => ({ ...prev, dates: [] }));
    if (fieldErrors.dates) {
      setFieldErrors((prev) => ({ ...prev, dates: "" }));
    }
  }

  function validate() {
    const errors = {};
    if (form.mode === "calendar") {
      const dates = form.dates || [];
      if (dates.length === 0) {
        errors.dates = "Selecione ao menos uma data.";
      } else if (!dates.every((key) => isDateSelectable(key))) {
        errors.dates = "A seleção contém datas inválidas. Refaça a seleção.";
      }
    } else {
      if (!form.startDate) {
        errors.startDate = "Data inicial é obrigatória.";
      } else if (isDateBeforeToday(startDate)) {
        errors.startDate = pastMessage;
      } else if (!isDateAllowedForSchedule(startDate, scheduleLimit)) {
        errors.startDate = limitMessage;
      }
      if (!form.endDate) {
        errors.endDate = "Data final é obrigatória.";
      } else if (isDateBeforeToday(endDate)) {
        errors.endDate = pastMessage;
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
    const period = PERIOD_OPTIONS.find((p) => p.value === form.period);
    if (!period || !period.shifts || period.shifts.length === 0) {
      errors.period = "Selecione um turno.";
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

    const isCalendarMode = form.mode === "calendar";
    const next = isCalendarMode
      ? selectedDates.reduce(
          (acc, key) => applyScheduleOnDate(acc, parseLocalDate(key), payload),
          schedule
        )
      : applyScheduleRange(schedule, {
          start: startDate,
          end: endDate,
          ...payload,
        });

    setSaving(true);
    try {
      await updateRoom(room.id, { schedule: next });
      setSchedule(next);

      if (isCalendarMode) {
        setForm((prev) => ({ ...prev, dates: [] }));
        setAppliedMessage(
          selectedDates.length === 1
            ? "Agendamento aplicado a 1 data."
            : `Agendamento aplicado a ${selectedDates.length} datas.`
        );
      } else {
        const days = businessDaysBetween(startDate, endDate);
        setAppliedMessage(
          days.length === 1
            ? "Agendamento aplicado a 1 dia útil."
            : `Agendamento aplicado a ${days.length} dias úteis.`
        );
      }
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
      setSchedule(decodeSchedule({}));
      setForm(EMPTY_SCHEDULE_FORM);
      setFieldErrors({});
      onScheduleReset(room.id);
      setAppliedMessage("Agendamentos da sala foram resetados.");
    } catch (err) {
      setError(err.message || "Erro ao resetar os agendamentos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="schedule-editor">
      <p className="schedule-editor-hint">
        {form.mode === "calendar"
          ? "Toque ou clique nas datas desejadas para selecioná-las. É possível escolher várias datas, e clicar novamente em uma data selecionada a remove."
          : "Defina o intervalo de datas, o turno e a situação. O agendamento será aplicado somente aos dias úteis (segunda a sexta) do intervalo."}
      </p>
      <p className="schedule-editor-limit">
        O limite para criação de agendamentos é de 3 meses: só é possível
        agendar até {scheduleLimitLabel}.
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
          {form.mode === "calendar" ? (
            <div className="range-field range-field-full">
              <ScheduleCalendar
                today={today}
                limitDate={scheduleLimit}
                selectedKeys={selectedDates}
                onToggleDate={handleToggleDate}
              />
              {fieldErrors.dates && (
                <span className="field-error">{fieldErrors.dates}</span>
              )}
              {selectionText && (
                <div className="schedule-selection">
                  <div className="schedule-selection-text">
                    <span className="schedule-selection-label">
                      {selectedDates.length === 1
                        ? "Data selecionada:"
                        : "Datas selecionadas:"}
                    </span>
                    <span className="schedule-selection-value">
                      {selectionText}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-clear-dates"
                    onClick={handleClearDates}
                    disabled={saving}
                  >
                    Limpar
                  </button>
                </div>
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
                  min={todayKey}
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
                  min={todayKey}
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
            {fieldErrors.period && (
              <span className="field-error">{fieldErrors.period}</span>
            )}
          </div>

          <div
            className={`range-field ${
              form.mode === "range" ? "range-field-full" : ""
            }`}
          >
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
          <div className="schedule-editor-actions">
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
        </div>
      </form>
    </div>
  );
}