import { useState, useEffect, useMemo } from "react";
import Header from "../components/Header";
import { getRooms } from "../services/firestore";
import {
  SHIFTS,
  getWeekDates,
  getWeekMonday,
  normalizeSchedule,
} from "../utils/schedule";

const SITUATIONS = {
  available: { label: "Livre", className: "available" },
  occupied: { label: "Ocupado", className: "occupied" },
  maintenance: { label: "Manutenção", className: "maintenance" },
};

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    loadRooms();
  }, []);

  const weekStart = useMemo(() => {
    const start = new Date(getWeekMonday());
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekDays = getWeekDates(weekStart);

  const roomsWithSchedule = useMemo(
    () =>
      rooms.map((room) => ({
        room,
        byDay: normalizeSchedule(room.schedule, weekStart),
      })),
    [rooms, weekStart],
  );

  async function loadRooms() {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch {
      setError("Erro ao carregar as salas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <Header />

      <main className="page-main rooms-page-main">
        <div className="rooms-panel">
          <div className="rooms-panel-head">
            <div className="rooms-panel-titles">
              <h2>Salas</h2>
              <p className="rooms-panel-subtitle">
                Consulta pública das salas de aula e seus horários de
                disponibilidade.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-inline">
            <div className="spinner"></div>
            <span>Carregando...</span>
          </div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : rooms.length === 0 ? (
          <p className="empty-message">Nenhuma sala cadastrada ainda.</p>
        ) : (
          <>
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
                <thead>
                  <tr>
                    <th className="rooms-corner" colSpan={2} scope="col">
                      Dia / Período
                    </th>
                    {roomsWithSchedule.map(({ room }) => (
                      <th
                        key={room.id}
                        className="rooms-room-col"
                        scope="col"
                      >
                        <span className="rooms-room-name" title={room.name}>
                          {room.name}
                        </span>
                        {room.location && (
                          <span
                            className="rooms-room-location"
                            title={room.location}
                          >
                            {room.location}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day) =>
                    SHIFTS.map((shift, shiftIndex) => (
                      <tr key={`${day.dateKey}-${shift}`}>
                        {shiftIndex === 0 && (
                          <th
                            className="rooms-day-col"
                            rowSpan={2}
                            scope="rowgroup"
                          >
                            <span className="rooms-day-name">
                              {day.dayShort}
                            </span>
                            <span className="rooms-day-date">{day.short}</span>
                          </th>
                        )}
                        <th className="rooms-shift-col" scope="row">
                          {shift}
                        </th>
                        {roomsWithSchedule.map(({ room, byDay }) => {
                          const entry = byDay[day.dateKey]?.[shift];
                          const situation = entry
                            ? SITUATIONS[entry.situation]
                            : null;
                          const title = entry
                            ? situation
                              ? entry.notes
                                ? `${situation.label} — ${entry.notes}`
                                : situation.label
                              : entry.situation
                            : "Sem agendamento para este dia/período.";
                          return (
                            <td
                              key={room.id}
                              className={`rooms-cell ${
                                entry && situation
                                  ? situation.className
                                  : entry
                                    ? "unknown"
                                    : ""
                              }`}
                              title={title}
                            >
                              {entry ? (
                                <span className="rooms-cell-content">
                                  <span>
                                    {situation
                                      ? situation.label
                                      : entry.situation}
                                  </span>
                                  {entry.notes && (
                                    <span className="rooms-cell-note">
                                      {entry.notes}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}