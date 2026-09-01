import KeyIcon from "./KeyIcon";

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

const STATUS_LABELS = {
  available: "Disponível",
  borrowed: "Emprestada",
  overdue: "Atrasada",
};

export default function KeyCabinet({ keys, movements }) {
  const slots = keys.map((key) => {
    const movement = movements.find((m) => m.keyId === key.id);

    let status = "available";
    if (movement) {
      const now = new Date();
      const isOverdue =
        movement.expectedReturnAt && movement.expectedReturnAt.toDate() < now;
      status = isOverdue ? "overdue" : "borrowed";
    }

    return { key, movement, status };
  });

  return (
    <section className="cabinet-section">
      <div className="cabinet-header">
        <div>
          <h3>Claviculário</h3>
          <p>Visualização rápida do status das chaves</p>
        </div>
        <div className="cabinet-legend">
          <span className="legend-item legend-available">Disponível</span>
          <span className="legend-item legend-borrowed">Emprestada</span>
          <span className="legend-item legend-overdue">Atrasada</span>
        </div>
      </div>

      <div className="cabinet">
        {slots.length === 0 ? (
          <p className="cabinet-empty">Nenhuma chave cadastrada no claviculário.</p>
        ) : (
          <div className="cabinet-grid">
            {slots.map(({ key, movement, status }, index) => (
              <div key={key.id} className={`cabinet-slot ${status}`}>
                <div className="slot-label">
                  <span className="slot-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="slot-status-dot" aria-hidden="true"></span>
                </div>
                <span className="slot-peg" aria-hidden="true"></span>
                <KeyIcon status={status} />
                <div className="cabinet-slot-name" title={key.name}>
                  {key.name}
                </div>
                {key.location && (
                  <div className="cabinet-slot-location" title={key.location}>
                    {key.location}
                  </div>
                )}

                <div className="cabinet-tooltip">
                  <strong>{key.name}</strong>
                  {key.location && <span>Local: {key.location}</span>}
                  <span>Status: {STATUS_LABELS[status]}</span>
                  {movement && (
                    <>
                      <span>Responsável: {movement.personName}</span>
                      <span>
                        Retirada:{" "}
                        {movement.borrowedAt
                          ? movement.borrowedAt.toDate().toLocaleString("pt-BR")
                          : "—"}
                      </span>
                      <span>
                        Previsão de devolução: {formatDate(movement.expectedReturnAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}