import { useState, useEffect } from "react";
import { getKeys, getPeople, withdrawKey } from "../services/firestore";

export default function WithdrawalForm({ onSuccess, onCancel }) {
  const [keys, setKeys] = useState([]);
  const [people, setPeople] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [keysData, peopleData] = await Promise.all([
          getKeys(),
          getPeople(),
        ]);
        setKeys(keysData.filter((k) => k.status === "available"));
        setPeople(peopleData);
      } catch {
        setError("Erro ao carregar dados.");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const key = keys.find((k) => k.id === selectedKey);
    const person = people.find((p) => p.id === selectedPerson);

    try {
      const [year, month, day] = expectedDate.split("-").map(Number);
      const expectedReturnDate = new Date(year, month - 1, day, 23, 59, 59);

      await withdrawKey(
        key.id,
        key.name,
        person.id,
        person.name,
        expectedReturnDate
      );
      onSuccess();
    } catch (err) {
      setError(err.message || "Erro ao registrar retirada.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="loading-inline">
        <div className="spinner"></div>
        <span>Carregando chaves e pessoas...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}

      {keys.length === 0 ? (
        <p className="empty-message">Nenhuma chave disponível para retirada.</p>
      ) : (
        <>
          <label htmlFor="key">Chave</label>
          <select
            id="key"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            required
          >
            <option value="">Selecione uma chave</option>
            {keys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name} — {key.location}
              </option>
            ))}
          </select>

          <label htmlFor="person">Pessoa</label>
          <select
            id="person"
            value={selectedPerson}
            onChange={(e) => setSelectedPerson(e.target.value)}
            required
          >
            <option value="">Selecione uma pessoa</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} {person.sector ? `(${person.sector})` : ""}
              </option>
            ))}
          </select>

          <label htmlFor="expectedDate">Previsão de Devolução</label>
          <input
            id="expectedDate"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            required
          />

          <div className="form-buttons">
            <button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Confirmar Retirada"}
            </button>
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </form>
  );
}
