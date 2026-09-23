import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import SearchableSelect from "../components/SearchableSelect";
import ScheduleEditor from "../components/ScheduleEditor";
import { getRooms } from "../services/firestore";
import fechaduraPorta from "../assets/fechadura_porta.png";

export default function RoomSchedule() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getRooms();
        if (!active) return;
        setRooms(data);
        if (state?.roomId && data.some((r) => r.id === state.roomId)) {
          setSelectedRoom(state.roomId);
        }
      } catch {
        if (active) setError("Erro ao carregar as salas.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [state?.roomId]);

  function handleRoomChange(id) {
    setSelectedRoom(id);
    getRooms()
      .then(setRooms)
      .catch(() => {});
  }

  function handleScheduleReset(roomId) {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId ? { ...room, schedule: {} } : room
      )
    );
  }

  function handleCancelSchedule() {
    navigate("/salas/admin");
  }

  const selectedRoomObj = rooms.find((room) => room.id === selectedRoom) || null;

  return (
    <div className="page-container">
      <Header showUser />

      <main className="page-main schedule-page">
        <div className="page-title-row schedule-title-row">
          <div>
            <h2>Agendamento de Salas</h2>
            <p className="schedule-subtitle">
              Selecione uma sala e defina o agendamento.
            </p>
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
            <section className="schedule-card">
              <div className="schedule-card-head">
                <span className="schedule-step" aria-hidden="true">1</span>
                <div className="schedule-card-titles">
                  <h3 className="schedule-card-title">Selecionar sala</h3>
                  <p className="schedule-card-sub">
                    Escolha a sala que será agendada.
                  </p>
                </div>
              </div>

              <SearchableSelect
                id="room"
                hideLabel
                placeholder="Pesquisar sala pelo nome ou local..."
                emptyMessage="Nenhuma sala encontrada."
                options={rooms}
                value={selectedRoom}
                onChange={handleRoomChange}
                searchFields={["name", "location"]}
                getIcon={() => (
                  <img
                    src={fechaduraPorta}
                    alt=""
                    className="room-select-icon"
                  />
                )}
                getTitle={(room) => room.name}
                getSubtitle={(room) => room.location}
              />
            </section>

            {selectedRoomObj ? (
              <section className="schedule-card">
                <div className="schedule-card-head">
                  <span className="schedule-step" aria-hidden="true">2</span>
                  <div className="schedule-card-titles">
                    <h3 className="schedule-card-title">
                      Agendamento — {selectedRoomObj.name}
                    </h3>
                    <p className="schedule-card-sub">
                      Defina a data, o turno e a situação da sala.
                    </p>
                  </div>
                </div>

                <ScheduleEditor
                  key={selectedRoomObj.id}
                  room={selectedRoomObj}
                  onCancel={handleCancelSchedule}
                  onScheduleReset={handleScheduleReset}
                />
              </section>
            ) : (
              <div className="schedule-empty">
                <span className="schedule-empty-icon" aria-hidden="true">
                  🗓️
                </span>
                <p>Selecione uma sala acima para fazer o agendamento.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}