import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import SearchableSelect from "../components/SearchableSelect";
import ScheduleEditor from "../components/ScheduleEditor";
import { getRooms } from "../services/firestore";

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
        <div className="page-title-row">
          <h2>Agendamento de Salas</h2>
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
            <section className="withdrawal-section">
              <div className="withdrawal-section-head">
                <span className="withdrawal-step" aria-hidden="true">1</span>
                <h3 className="withdrawal-section-title">Sala</h3>
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
                getIcon={() => "🚪"}
                getTitle={(room) => room.name}
                getSubtitle={(room) => room.location}
              />
            </section>

            {selectedRoomObj ? (
              <section className="withdrawal-section">
                <div className="withdrawal-section-head">
                  <span className="withdrawal-step" aria-hidden="true">2</span>
                  <h3 className="withdrawal-section-title">
                    Agendamento — {selectedRoomObj.name}
                  </h3>
                </div>

                <ScheduleEditor
                  key={selectedRoomObj.id}
                  room={selectedRoomObj}
                  onCancel={handleCancelSchedule}
                  onScheduleReset={handleScheduleReset}
                />
              </section>
            ) : (
              <p className="empty-message">
                Selecione uma sala acima para fazer o agendamento.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}