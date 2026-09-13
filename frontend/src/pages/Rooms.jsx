import { useState, useEffect } from "react";
import Header from "../components/Header";
import { getRooms } from "../services/firestore";

const WEEK_DAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
];

const DAY_SHORT = {
  "Segunda-feira": "Seg",
  "Terça-feira": "Ter",
  "Quarta-feira": "Qua",
  "Quinta-feira": "Qui",
  "Sexta-feira": "Sex",
};

const SHIFTS = ["Manhã", "Tarde"];

const SITUATIONS = {
  available: { label: "Livre", className: "available" },
  occupied: { label: "Ocupado", className: "occupied" },
  maintenance: { label: "Manutenção", className: "maintenance" },
};

function buildScheduleMatrix(schedule) {
  const entries = schedule || [];
  const daySet = new Set(entries.map((e) => e.day));
  const shiftSet = new Set(entries.map((e) => e.shift));

  const days = WEEK_DAYS.filter((day) => daySet.has(day));
  const shifts = SHIFTS.filter((shift) => shiftSet.has(shift));

  const byDayAndShift = {};
  entries.forEach((e) => {
    if (!byDayAndShift[e.shift]) byDayAndShift[e.shift] = {};
    byDayAndShift[e.shift][e.day] = e;
  });

  return { days, shifts, byDayAndShift };
}

function RoomCard({ room }) {
  const { days, shifts, byDayAndShift } = buildScheduleMatrix(room.schedule);

  return (
    <article className="room-card">
      <div className="room-card-top">
        <h3>{room.name}</h3>
        {room.location && <span className="room-location">{room.location}</span>}
      </div>
      {room.description && <p className="room-description">{room.description}</p>}

      {days.length === 0 || shifts.length === 0 ? (
        <p className="room-no-schedule">Sem grade de horários disponível.</p>
      ) : (
        <div className="room-schedule-wrap">
          <table className="room-schedule">
            <thead>
              <tr>
                <th></th>
                {days.map((day) => (
                  <th key={day}>{DAY_SHORT[day] || day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift}>
                  <th className="shift-label">{shift}</th>
                  {days.map((day) => {
                    const entry = byDayAndShift[shift]?.[day];
                    const situation = entry ? SITUATIONS[entry.situation] : null;
                    return (
                      <td
                        key={day}
                        className={`room-cell ${
                          entry
                            ? situation
                              ? situation.className
                              : "unknown"
                            : ""
                        }`}
                        title={
                          entry?.notes || (situation ? situation.label : "")
                        }
                      >
                        {situation ? situation.label : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRooms();
  }, []);

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

      <main className="page-main">
        <div className="page-title-row">
          <h2>Salas</h2>
        </div>
        <p className="subtitle">
          Consulta pública das salas de aula e seus horários de disponibilidade.
        </p>

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
            <div className="rooms-legend">
              <span className="legend-item legend-available">Livre</span>
              <span className="legend-item legend-borrowed">Ocupado</span>
              <span className="legend-item legend-overdue">Manutenção</span>
            </div>

            <div className="rooms-grid">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}