import { useState, useEffect } from "react";
import { getKeys, getPeople, withdrawKey } from "../services/firestore";
import { formatPhone } from "../utils/format";
import SearchableSelect from "./SearchableSelect";

const STUDENT_PERSON_ID = "aluno-nao-cadastrado";

export default function WithdrawalForm({ onSuccess, onCancel }) {
  const [keys, setKeys] = useState([]);
  const [people, setPeople] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [responsibleType, setResponsibleType] = useState("registered");
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const isStudent = responsibleType === "student";

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

  function handleTypeChange(type) {
    if (type === responsibleType) return;
    setResponsibleType(type);
    setSelectedPerson("");
    setStudentName("");
    setStudentPhone("");
    setFieldErrors({});
    setError("");
  }

  function handlePersonChange(id) {
    setSelectedPerson(id);
    setFieldErrors({});
    setError("");
  }

  function handleStudentChange(e) {
    const { name, value } = e.target;
    if (name === "studentPhone") {
      const digits = value.replace(/\D/g, "").slice(0, 11);
      setStudentPhone(formatPhone(digits));
    } else {
      setStudentName(value);
    }
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const key = keys.find((k) => k.id === selectedKey);
    if (!key) {
      setError("Selecione uma chave.");
      return;
    }

    if (!expectedDate) {
      setError("Informe a previsão de devolução.");
      return;
    }

    const [year, month, day] = expectedDate.split("-").map(Number);
    const expectedReturnDate = new Date(year, month - 1, day, 23, 59, 59);
    if (Number.isNaN(expectedReturnDate.getTime())) {
      setError("Data de devolução inválida.");
      return;
    }

    let personId;
    let personName;
    let personPhone;
    let personType;

    if (isStudent) {
      const errors = {};
      const name = studentName.trim();
      const phone = studentPhone.replace(/\D/g, "");
      if (!name) {
        errors.studentName = "Nome do aluno é obrigatório.";
      } else if (name.length < 3 || name.length > 100) {
        errors.studentName = "Nome deve ter entre 3 e 100 caracteres.";
      }
      if (!phone) {
        errors.studentPhone = "Telefone é obrigatório.";
      } else if (phone.length < 10 || phone.length > 11) {
        errors.studentPhone = "Telefone deve possuir 10 ou 11 dígitos.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      personId = STUDENT_PERSON_ID;
      personName = name;
      personPhone = phone;
      personType = "student";
    } else {
      const person = people.find((p) => p.id === selectedPerson);
      if (!person) {
        setError("Selecione uma pessoa.");
        return;
      }
      personId = person.id;
      personName = person.name;
      personPhone = (person.phone || "").replace(/\D/g, "");
      personType = "registered";
    }

    setLoading(true);
    try {
      await withdrawKey(
        key.id,
        key.name,
        personId,
        personName,
        expectedReturnDate,
        { personPhone, personType }
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
    <form className="withdrawal-form" onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}

      {keys.length === 0 ? (
        <p className="empty-message">Nenhuma chave disponível para retirada.</p>
      ) : (
        <>
          <section className="withdrawal-section">
            <div className="withdrawal-section-head">
              <span className="withdrawal-step" aria-hidden="true">1</span>
              <h3 className="withdrawal-section-title">Chave</h3>
            </div>

            <SearchableSelect
              id="key"
              label="Chave"
              hideLabel
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
          </section>

          <section className="withdrawal-section">
            <div className="withdrawal-section-head">
              <span className="withdrawal-step" aria-hidden="true">2</span>
              <h3 className="withdrawal-section-title">Responsável</h3>
            </div>

            <div
              className="segmented-control"
              role="tablist"
              aria-label="Tipo de responsável"
            >
              <button
                type="button"
                role="tab"
                aria-selected={responsibleType === "registered"}
                className={`segmented-control-item ${
                  responsibleType === "registered" ? "active" : ""
                }`}
                onClick={() => handleTypeChange("registered")}
              >
                Servidor / Professor
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={responsibleType === "student"}
                className={`segmented-control-item ${
                  responsibleType === "student" ? "active" : ""
                }`}
                onClick={() => handleTypeChange("student")}
              >
                Aluno
              </button>
            </div>

            {isStudent ? (
              <>
                <div className="student-note">
                  <span className="student-badge">Aluno não cadastrado</span>
                  <span>Os dados serão salvos apenas neste registro.</span>
                </div>

                <label htmlFor="studentName">Nome do aluno</label>
                <input
                  id="studentName"
                  name="studentName"
                  type="text"
                  value={studentName}
                  onChange={handleStudentChange}
                  maxLength={100}
                  placeholder="Ex: João da Silva"
                  className={fieldErrors.studentName ? "input-error" : ""}
                />
                {fieldErrors.studentName && (
                  <span className="field-error">{fieldErrors.studentName}</span>
                )}

                <label htmlFor="studentPhone">Telefone</label>
                <input
                  id="studentPhone"
                  name="studentPhone"
                  type="tel"
                  inputMode="numeric"
                  value={studentPhone}
                  onChange={handleStudentChange}
                  placeholder="(91) 98765-4321"
                  className={fieldErrors.studentPhone ? "input-error" : ""}
                />
                {fieldErrors.studentPhone && (
                  <span className="field-error">{fieldErrors.studentPhone}</span>
                )}
              </>
            ) : (
              <SearchableSelect
                id="person"
                label="Pessoa"
                hideLabel
                placeholder="Pesquisar pessoa..."
                emptyMessage="Nenhuma pessoa encontrada."
                options={people}
                value={selectedPerson}
                onChange={handlePersonChange}
                searchFields={["name", "sector"]}
                getIcon={() => "👤"}
                getTitle={(p) => p.name}
                getSubtitle={(p) => p.sector || ""}
              />
            )}
          </section>

          <section className="withdrawal-section">
            <div className="withdrawal-section-head">
              <span className="withdrawal-step" aria-hidden="true">3</span>
              <h3 className="withdrawal-section-title">Previsão de devolução</h3>
            </div>

            <input
              id="expectedDate"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              aria-label="Data de previsão de devolução"
              required
            />
          </section>

          <div className="form-buttons withdrawal-footer">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Confirmar Retirada"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}