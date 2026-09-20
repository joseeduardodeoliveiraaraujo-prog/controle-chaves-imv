import { useState, useEffect, useMemo, useRef } from "react";
import Header from "../components/Header";
import { getHistoryPage, getMovementsForSearch, getPeople } from "../services/firestore";
import { formatPhone } from "../utils/format";

const PAGE_SIZE = 80;

export default function History() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMovements, setHasMovements] = useState(false);
  const [searchRaw, setSearchRaw] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const isSearch = searchTerm.trim() !== "";
  const serverCacheRef = useRef(new Map());
  const dataKeyRef = useRef("");

  useEffect(() => {
    getPeople().then(setPeople).catch(() => {});
  }, []);

  useEffect(() => {
    getHistoryPage({ pageSize: 1 })
      .then((res) => setHasMovements(res.count > 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFrom, dateTo]);

  useEffect(() => {
    if (!isSearch) return;
    let cancelled = false;
    getMovementsForSearch({ dateFrom, dateTo })
      .then((docs) => {
        if (!cancelled) setSearchRaw(docs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSearch, dateFrom, dateTo]);

  useEffect(() => {
    if (isSearch) return;
    let cancelled = false;

    const dataKey = `${dateFrom}|${dateTo}`;
    if (dataKeyRef.current !== dataKey) {
      serverCacheRef.current = new Map();
      dataKeyRef.current = dataKey;
    }

    const cache = serverCacheRef.current;
    if (cache.get(currentPage)) {
      setLoading(false);
      return;
    }

    let after = null;
    let startPage = 1;
    for (let k = currentPage - 1; k >= 1; k--) {
      if (cache.has(k)) {
        startPage = k + 1;
        after = cache.get(k).lastDoc;
        break;
      }
    }

    setLoading(true);
    (async () => {
      try {
        for (let k = startPage; k <= currentPage; k++) {
          if (cancelled) return;
          const res = await getHistoryPage({ after, dateFrom, dateTo });
          cache.set(k, {
            documents: res.documents,
            lastDoc: res.lastDoc,
            count: res.count,
          });
          after = res.lastDoc;
        }
      } catch {
        // handle error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, isSearch, dateFrom, dateTo]);

  const searchFiltered = useMemo(() => {
    if (!isSearch || !searchRaw) return [];
    const term = searchTerm.trim().toLowerCase();
    return searchRaw.filter(
      (m) =>
        m.keyName?.toLowerCase().includes(term) ||
        m.personName?.toLowerCase().includes(term)
    );
  }, [isSearch, searchRaw, searchTerm]);

  const displayedMovements = isSearch
    ? searchFiltered.slice(
        (currentPage - 1) * PAGE_SIZE,
        (currentPage - 1) * PAGE_SIZE + PAGE_SIZE
      )
    : serverCacheRef.current.get(currentPage)?.documents ?? [];

  const totalCount = isSearch
    ? searchFiltered.length
    : serverCacheRef.current.get(currentPage)?.count ?? 0;

  function formatTimestamp(timestamp) {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString("pt-BR");
  }

  const peopleById = useMemo(() => {
    const map = new Map();
    people.forEach((p) => map.set(p.id, p));
    return map;
  }, [people]);

  function getPhone(movement) {
    if (movement.personPhone) {
      return formatPhone(String(movement.personPhone).replace(/\D/g, ""));
    }
    const person = peopleById.get(movement.personId);
    const phone = (person?.phone || "").replace(/\D/g, "");
    if (!phone) return "-";
    return formatPhone(phone);
  }

  const hasActiveFilters = searchTerm.trim() !== "" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginationStart = totalCount ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const paginationEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  const pageReady = isSearch
    ? searchRaw !== null
    : serverCacheRef.current.has(currentPage);

  return (
    <div className="page-container">
      <Header showUser />

      <main className="page-main history-main">
        <h2>Histórico de Movimentações</h2>
        <p className="subtitle">Todas as retiradas e devoluções registradas.</p>

        {loading ? (
          <div className="loading-inline">
            <div className="spinner"></div>
            <span>Carregando...</span>
          </div>
        ) : !hasMovements ? (
          <p className="empty-message">Nenhuma movimentação registrada.</p>
        ) : (
          <>
            <div className="history-filters">
              <div className="filter-row">
                <div className="filter-group filter-search">
                  <label htmlFor="search">Pesquisar</label>
                  <div className="list-search">
                    <span className="search-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </span>
                    <input
                      id="search"
                      type="text"
                      placeholder="Nome da chave ou pessoa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="filter-group">
                  <label htmlFor="dateFrom">De</label>
                  <input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="dateTo">Até</label>
                  <input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                {hasActiveFilters && (
                  <button className="btn-clear-filters" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {!pageReady ? (
              <div className="loading-inline">
                <div className="spinner"></div>
                <span>Carregando...</span>
              </div>
            ) : totalCount === 0 ? (
              <p className="empty-message">
                Nenhuma movimentação encontrada para os filtros selecionados.
              </p>
            ) : (
              <>
                <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Ordem</th>
                    <th>Chave</th>
                    <th>Pessoa</th>
                    <th>Telefone</th>
                    <th>Retirada</th>
                    <th>Previsão</th>
                    <th>Devolução</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMovements.map((m, index) => {
                    const now = new Date();
                    const isOverdue =
                      m.status === "active" &&
                      m.expectedReturnAt &&
                      m.expectedReturnAt.toDate() < now;

                    return (
                      <tr key={m.id} className={isOverdue ? "row-overdue" : ""}>
                        <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td>
                          <span className="truncate-cell key-name" title={m.keyName}>{m.keyName}</span>
                        </td>
                        <td>
                          <span className="truncate-cell person-name" title={m.personName}>{m.personName}</span>
                        </td>
                        <td className="nowrap">{getPhone(m)}</td>
                        <td className="nowrap">{formatTimestamp(m.borrowedAt)}</td>
                        <td className="nowrap">{formatTimestamp(m.expectedReturnAt)}</td>
                        <td className="nowrap">{m.returnedAt ? formatTimestamp(m.returnedAt) : "—"}</td>
                        <td>
                          <span className={`status-badge ${isOverdue ? "overdue" : m.status === "active" ? "borrowed" : "available"}`}>
                            {isOverdue ? "Atrasada" : m.status === "active" ? "Em uso" : "Devolvida"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="history-pagination-bar">
              <span className="pagination-info">
                Exibindo {paginationStart}–{paginationEnd} de {totalCount} registro{totalCount === 1 ? "" : "s"}
              </span>
              {totalPages > 1 && (
                <nav className="pagination" aria-label="Paginação">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`pagination-item ${currentPage === n ? "active" : ""}`}
                      aria-current={currentPage === n ? "page" : undefined}
                      onClick={() => setCurrentPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </button>
                </nav>
              )}
            </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
