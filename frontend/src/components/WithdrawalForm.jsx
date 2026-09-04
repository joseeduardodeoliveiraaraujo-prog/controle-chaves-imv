import { useState, useEffect } from "react";
import { getKeys, getPeople, withdrawKey } from "../services/firestore";
import SearchableSelect from "./SearchableSelect";

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
          <SearchableSelect
            id="key"
            label="Chave"
            placeholder="Pesquisar chave..."
            emptyMessage="Nenhuma chave encontrada."
            options={keys}
            value={selectedKey}
            onChange={setSelectedKey}
            searchFields={["name", "location"]}
            getIcon={() => "🔑"}
            getTitle={(k) => k.name}
            getSubtitle={(k) => k.location}
          />

          <SearchableSelect
            id="person"
            label="Pessoa"
            placeholder="Pesquisar pessoa..."
            emptyMessage="Nenhuma pessoa encontrada."
            options={people}
            value={selectedPerson}
            onChange={setSelectedPerson}
            searchFields={["name", "sector"]}
            getIcon={() => "👤"}
            getTitle={(p) => p.name}
            getSubtitle={(p) => p.sector || ""}
          />

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
