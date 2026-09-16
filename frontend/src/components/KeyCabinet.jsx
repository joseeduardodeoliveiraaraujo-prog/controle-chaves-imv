import { useState, useRef, useEffect } from "react";
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

const GAP = 8;

export default function KeyCabinet({ keys, movements }) {
  const [activeId, setActiveId] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const cabinetRef = useRef(null);
  const tooltipRef = useRef(null);
  const slotRefs = useRef({});

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

  const activeSlot = activeId
    ? slots.find((s) => s.key.id === activeId) || null
    : null;

  useEffect(() => {
    if (!activeId || !tooltipRef.current || !cabinetRef.current) return;

    const slotEl = slotRefs.current[activeId];
    if (!slotEl) return;

    const cabinetRect = cabinetRef.current.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tw = tooltipEl.offsetWidth || 200;
    const th = tooltipEl.offsetHeight || 80;

    const slotCenterLocal =
      slotRect.left - cabinetRect.left + slotRect.width / 2;

    let left = slotCenterLocal - tw / 2;
    left = Math.max(GAP, Math.min(left, cabinetRect.width - tw - GAP));

    let bottom = cabinetRect.height - (slotRect.top - cabinetRect.top) + GAP;
    let below = false;
    if (bottom - th < GAP) {
      bottom = cabinetRect.height - (slotRect.bottom - cabinetRect.top) + GAP;
      below = true;
    }

    const arrowX = slotCenterLocal - left - tw / 2;

    setTooltipStyle({ left, bottom, arrowX, below });
  }, [activeId]);

  function handleShow(keyId) {
    setActiveId(keyId);
    setTooltipStyle(null);
  }

  function handleHide() {
    setActiveId(null);
    setTooltipStyle(null);
  }

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

      <div className="cabinet" ref={cabinetRef}>
        {slots.length === 0 ? (
          <p className="cabinet-empty">Nenhuma chave cadastrada no claviculário.</p>
        ) : (
          <div className="cabinet-grid">
            {slots.map(({ key, status }, index) => (
              <div
                key={key.id}
                ref={(el) => {
                  if (el) slotRefs.current[key.id] = el;
                }}
                className={`cabinet-slot ${status}`}
                onMouseEnter={() => handleShow(key.id)}
                onMouseLeave={handleHide}
              >
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
              </div>
            ))}
          </div>
        )}

        {activeSlot && (
          <div
            ref={tooltipRef}
            className={`cabinet-tooltip ${
              tooltipStyle ? "visible" : ""
            } ${tooltipStyle?.below ? "below" : ""}`}
            style={
              tooltipStyle
                ? {
                    left: tooltipStyle.left,
                    bottom: tooltipStyle.bottom,
                    "--arrow-x": `${tooltipStyle.arrowX}px`,
                  }
                : undefined
            }
          >
            <strong title={activeSlot.key.name}>{activeSlot.key.name}</strong>
            {activeSlot.key.location && (
              <span title={activeSlot.key.location}>
                Local: {activeSlot.key.location}
              </span>
            )}
            <span>Status: {STATUS_LABELS[activeSlot.status]}</span>
            {activeSlot.movement && (
              <>
                <span title={activeSlot.movement.personName}>
                  Responsável: {activeSlot.movement.personName}
                </span>
                <span>
                  Retirada:{" "}
                  {activeSlot.movement.borrowedAt
                    ? activeSlot.movement.borrowedAt.toDate().toLocaleString("pt-BR")
                    : "—"}
                </span>
                <span>
                  Previsão de devolução:{" "}
                  {formatDate(activeSlot.movement.expectedReturnAt)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}