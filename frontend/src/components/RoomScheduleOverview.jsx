import { useMemo, useState } from "react";
import {
  SHIFTS,
  getWeekDates,
  getWeekMonday,
  getScheduleEntryInfo,
  normalizeSchedule,
} from "../utils/schedule";

export default function RoomScheduleOverview({ room }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const schedule = room ? room.schedule : null;

  const weekStart = useMemo(() => {
    const start = new Date(getWeekMonday());
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekDays = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const byDay = useMemo(
    () => normalizeSchedule(schedule, weekStart),
    [schedule, weekStart]
  );

  if (!room) {
    return (
      <p className="room-schedule-hint">
        Selecione uma sala para visualizar a agenda.
      </p>
    );
  }

  return (
    <div className="room-schedule-overview">
      <div className="rooms-weekbar">
        <div className="rooms-weekbar-label">
          {`Semana de ${weekDays[0].full} a ${weekDays[4].full}`}
        </div>
        <div className="rooms-weekbar-controls">
          <button
            type="button"
            className="rooms-week-btn"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            ‹ Semana anterior
          </button>
          <button
            type="button"
            className="rooms-week-btn rooms-week-btn-current"
            onClick={() => setWeekOffset(0)}
          >
            Semana atual
          </button>
          <button
            type="button"
            className="rooms-week-btn"
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            Próxima semana ›
          </button>
        </div>
      </div>

      <div className="rooms-table-wrap">
        <table className="rooms-table">
          <caption className="rooms-overview-caption">
            Programação de {room.name} — visualização apenas informativa.
          </caption>
          <thead>
            <tr>
              <th className="rooms-corner rooms-overview-corner" scope="col">
                Turno
              </th>
              {weekDays.map((day) => (
                <th key={day.dateKey} className="rooms-day-head" scope="col">
                  <span className="rooms-day-name">{day.dayShort}</span>
                  <span className="rooms-day-date">{day.short}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift) => (
              <tr key={shift}>
                <th className="rooms-shift-col" scope="row">
                  {shift}
                </th>
                {weekDays.map((day) => {
                  const info = getScheduleEntryInfo(
                    byDay[day.dateKey]?.[shift]
                  );
                  return (
                    <td
                      key={day.dateKey}
                      className={`rooms-cell ${info.className}`}
                      title={info.title}
                    >
                      {info.hasEntry ? (
                        <span className="rooms-cell-content">
                          <span>{info.label}</span>
                          {info.notes && (
                            <span className="rooms-cell-note">{info.notes}</span>
                          )}
                        </span>
                      ) : (
                        info.label
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
