import { useMemo, useState } from "react";
import {
  dateKey,
  fullDate,
  isDateAllowedForSchedule,
} from "../utils/schedule";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function monthIndex(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function buildMonthDays(anchor) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - offset);

  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push({
      key: dateKey(date),
      date,
      day: date.getDate(),
      outside: date.getMonth() !== month || date.getFullYear() !== year,
      weekend: isWeekend(date),
    });
  }
  return cells;
}

export default function ScheduleCalendar({
  today,
  limitDate,
  selectedKeys,
  onToggleDate,
}) {
  const [anchor, setAnchor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const cells = useMemo(() => buildMonthDays(anchor), [anchor]);
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const todayKey = dateKey(today);
  const canGoPrev = monthIndex(anchor) > monthIndex(today);
  const canGoNext = monthIndex(anchor) < monthIndex(limitDate);

  function moveMonth(delta) {
    setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="schedule-calendar">
      <div className="schedule-calendar-head">
        <button
          type="button"
          className="schedule-calendar-nav"
          onClick={() => moveMonth(-1)}
          disabled={!canGoPrev}
          aria-label="Mês anterior"
        >
          &#10094;
        </button>
        <span className="schedule-calendar-title">
          {MONTH_LABELS[anchor.getMonth()]} {anchor.getFullYear()}
        </span>
        <button
          type="button"
          className="schedule-calendar-nav"
          onClick={() => moveMonth(1)}
          disabled={!canGoNext}
          aria-label="Próximo mês"
        >
          &#10095;
        </button>
      </div>

      <div className="schedule-calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="schedule-calendar-weekday">
            {label}
          </span>
        ))}
      </div>

      <div
        className="schedule-calendar-grid"
        role="group"
        aria-label="Calendário de datas"
      >
        {cells.map((cell) => {
          const isBeforeToday = cell.key < todayKey;
          const isAfterLimit = !isDateAllowedForSchedule(cell.date, limitDate);
          const isDisabled =
            cell.outside || cell.weekend || isBeforeToday || isAfterLimit;
          const isSelected = selected.has(cell.key);

          const classNames = ["schedule-calendar-day"];
          if (isDisabled) classNames.push("is-disabled");
          if (cell.outside) classNames.push("is-outside");
          if (cell.key === todayKey) classNames.push("is-today");
          if (isSelected) classNames.push("is-selected");

          return (
            <button
              key={cell.key}
              type="button"
              className={classNames.join(" ")}
              onClick={() => onToggleDate(cell.key)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={fullDate(cell.date)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
