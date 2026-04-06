"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { serializeMapGridLayout } from "@/lib/map-grid";

type LibraryResponse = {
  currentPage: number;
  ids: number[];
  order: "asc" | "desc";
  pageSize: number;
  query: string;
  total: number;
  totalPages: number;
};

type ComposerClientProps = {
  initialCells: Array<Array<number | null>>;
};

type DragPayload = {
  id: number;
  source: "gallery" | "grid";
  row?: number;
  column?: number;
};

const LIBRARY_PAGE_SIZE = 48;

function cloneCells(cells: Array<Array<number | null>>) {
  return cells.map((row) => [...row]);
}

function resizeCells(
  cells: Array<Array<number | null>>,
  nextRows: number,
  nextColumns: number,
) {
  return Array.from({ length: nextRows }, (_, rowIndex) =>
    Array.from({ length: nextColumns }, (_, columnIndex) => cells[rowIndex]?.[columnIndex] ?? null),
  );
}

function safeJsonParse(value: string): DragPayload | null {
  try {
    return JSON.parse(value) as DragPayload;
  } catch {
    return null;
  }
}

export default function ComposerClient({ initialCells }: ComposerClientProps) {
  const [cells, setCells] = useState(initialCells);
  const [query, setQuery] = useState("");
  const [libraryPage, setLibraryPage] = useState(1);
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [draggingCell, setDraggingCell] = useState<{ row: number; column: number } | null>(null);
  const deferredQuery = useDeferredValue(query);

  const rowCount = cells.length;
  const columnCount = cells[0]?.length ?? 0;
  const layout = useMemo(() => serializeMapGridLayout(cells), [cells]);
  const deferredLayout = useDeferredValue(layout);
  const previewUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("layout", deferredLayout);
    return `/api/maps/compose?${params.toString()}`;
  }, [deferredLayout]);
  const uniqueIds = useMemo(
    () => [...new Set(cells.flat().filter((id): id is number => id !== null))],
    [cells],
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("page", String(libraryPage));
    params.set("pageSize", String(LIBRARY_PAGE_SIZE));
    params.set("order", "desc");

    if (deferredQuery.trim().length > 0) {
      params.set("query", deferredQuery.trim());
    }
    fetch(`/api/maps/library?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load map library");
        }

        return response.json() as Promise<LibraryResponse>;
      })
      .then((result) => {
        startTransition(() => {
          setLibrary(result);
        });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          startTransition(() => {
            setLibrary(null);
          });
        }
      })
      .finally(() => {
        setIsLoadingLibrary(false);
      });

    return () => controller.abort();
  }, [deferredQuery, libraryPage]);

  function updateCell(row: number, column: number, id: number | null) {
    setCells((current) => {
      const next = cloneCells(current);
      next[row][column] = id;
      return next;
    });
  }

  function moveGridCell(
    from: { row: number; column: number },
    to: { row: number; column: number },
    id: number,
  ) {
    setCells((current) => {
      const next = cloneCells(current);
      const targetValue = next[to.row][to.column];
      next[to.row][to.column] = id;
      next[from.row][from.column] = targetValue;
      return next;
    });
  }

  function handleGridDrop(row: number, column: number, payload: DragPayload) {
    if (payload.source === "grid" && payload.row !== undefined && payload.column !== undefined) {
      moveGridCell({ row: payload.row, column: payload.column }, { row, column }, payload.id);
      return;
    }

    updateCell(row, column, payload.id);
  }

  function addRow() {
    setCells((current) => resizeCells(current, current.length + 1, current[0]?.length ?? 1));
  }

  function addColumn() {
    setCells((current) => resizeCells(current, current.length, (current[0]?.length ?? 0) + 1));
  }

  function removeRow() {
    setCells((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  function removeColumn() {
    setCells((current) => {
      const currentColumns = current[0]?.length ?? 0;
      return currentColumns > 1 ? current.map((row) => row.slice(0, -1)) : current;
    });
  }

  return (
    <main className="composer-page">
      <div className="composer-shell">
        <section className="detail-panel composer-workbench">
        <div className="detail-copy">
          <p className="eyebrow">Interactive Composer</p>
          <h1>ドラッグ＆ドロップで map を配置</h1>
          <p>
            左のギャラリーから map を掴んでセルへドロップできます。既に置いたセル同士の入れ替え、
            クリックで削除、行列の増減にも対応しています。
          </p>
        </div>

        <div className="composer-toolbar">
          <div className="composer-toolbar-group">
            <Link className="back-link" href="/">
              Back to gallery
            </Link>
            <a className="back-link" href={previewUrl} rel="noreferrer" target="_blank">
              Open BMP
            </a>
          </div>
        </div>

        <div className="composer-grid-stage">
          <div className="composer-grid-head">
            <div className="grid-axis-spacer">
              <span>Rows</span>
            </div>
            <div
              className="grid-axis grid-axis-top"
              style={{ gridTemplateColumns: `repeat(${columnCount}, 128px)` }}
            >
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <span className="grid-axis-label" key={`column-${columnIndex}`}>
                  C{columnIndex + 1}
                </span>
              ))}
            </div>
            <div className="grid-edge-actions">
              <button
                aria-label="Remove column"
                className="grid-icon-button"
                onClick={removeColumn}
                title="Remove column"
                type="button"
              >
                <span aria-hidden="true">-</span>
                <small>col</small>
              </button>
              <button
                aria-label="Add column"
                className="grid-icon-button"
                onClick={addColumn}
                title="Add column"
                type="button"
              >
                <span aria-hidden="true">+</span>
                <small>col</small>
              </button>
            </div>
          </div>

          <div className="composer-grid-body">
            <div className="grid-edge-actions grid-edge-actions-vertical">
              <button
                aria-label="Remove row"
                className="grid-icon-button"
                onClick={removeRow}
                title="Remove row"
                type="button"
              >
                <span aria-hidden="true">-</span>
                <small>row</small>
              </button>
              <button
                aria-label="Add row"
                className="grid-icon-button"
                onClick={addRow}
                title="Add row"
                type="button"
              >
                <span aria-hidden="true">+</span>
                <small>row</small>
              </button>
            </div>

            <div className="composer-grid-wrapper">
              <div
                className="composer-grid"
                style={{ gridTemplateColumns: `repeat(${columnCount}, 128px)` }}
              >
                {cells.map((row, rowIndex) =>
                  row.map((cell, columnIndex) => (
                    <div
                      className={`composer-cell${draggingCell?.row === rowIndex && draggingCell?.column === columnIndex ? " is-dragging" : ""}`}
                      key={`${rowIndex}-${columnIndex}`}
                      onClick={() => updateCell(rowIndex, columnIndex, null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const payload = safeJsonParse(
                          event.dataTransfer.getData("application/json"),
                        );

                        if (payload) {
                          handleGridDrop(rowIndex, columnIndex, payload);
                        }

                        setDraggingCell(null);
                      }}
                    >
                      <span className="composer-cell-label">
                        {rowIndex + 1},{columnIndex + 1}
                      </span>
                      {cell === null ? (
                        <span className="composer-placeholder">Drop map here</span>
                      ) : (
                        <div
                          className="composer-map"
                          draggable
                          onDragEnd={() => setDraggingCell(null)}
                          onDragStart={(event) => {
                            setDraggingCell({ row: rowIndex, column: columnIndex });
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({
                                column: columnIndex,
                                id: cell,
                                row: rowIndex,
                                source: "grid",
                              } satisfies DragPayload),
                            );
                          }}
                        >
                          <Image
                            alt={`Minecraft map ${cell}`}
                            height={128}
                            src={`/api/maps/${cell}`}
                            unoptimized
                            width={128}
                          />
                          <strong>{cell}</strong>
                        </div>
                      )}
                    </div>
                  )),
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-preview compose-preview interactive-preview">
          <Image
            alt="Composed Minecraft maps"
            height={Math.max(1, rowCount) * 128}
            src={previewUrl}
            unoptimized
            width={Math.max(1, columnCount) * 128}
          />
        </div>
        </section>

        <aside className="composer-sidebar">
          <section className="detail-sidebar composer-library-panel">
          <div className="library-header">
            <div>
              <p className="eyebrow">Map Library</p>
              <h2>Gallery</h2>
            </div>
            <label className="field">
              <span>Search ids</span>
              <input
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setIsLoadingLibrary(true);
                  startTransition(() => {
                    setQuery(nextValue);
                    setLibraryPage(1);
                  });
                }}
                placeholder="105, 171..."
                type="search"
                value={query}
              />
            </label>
          </div>

          <div className="library-meta">
            <span>{library ? `${library.total.toLocaleString()} matches` : "Loading..."}</span>
            <span>{isLoadingLibrary ? "Refreshing..." : `Page ${library?.currentPage ?? 1}`}</span>
          </div>

          <div className="library-scroll-area">
            <div className="library-grid">
              {(library?.ids ?? []).map((id) => (
                <button
                  className="library-card"
                  draggable
                  key={id}
                  onClick={() => {
                    setCells((current) => {
                      const next = cloneCells(current);

                      for (let rowIndex = 0; rowIndex < next.length; rowIndex += 1) {
                        for (let columnIndex = 0; columnIndex < next[rowIndex].length; columnIndex += 1) {
                          if (next[rowIndex][columnIndex] === null) {
                            next[rowIndex][columnIndex] = id;
                            return next;
                          }
                        }
                      }

                      next[0][0] = id;
                      return next;
                    });
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({ id, source: "gallery" } satisfies DragPayload),
                    );
                  }}
                  type="button"
                >
                  <Image
                    alt={`Minecraft map ${id}`}
                    height={128}
                    src={`/api/maps/${id}`}
                    unoptimized
                    width={128}
                  />
                  <span>{id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pager composer-pager">
            <button
              className="pager-link"
              disabled={(library?.currentPage ?? 1) <= 1}
              onClick={() => {
                setIsLoadingLibrary(true);
                startTransition(() => setLibraryPage((page) => Math.max(1, page - 1)));
              }}
              type="button"
            >
              Previous
            </button>
            <span className="pager-label">
              {library ? `${library.currentPage} / ${library.totalPages}` : "1 / 1"}
            </span>
            <button
              className="pager-link"
              disabled={(library?.currentPage ?? 1) >= (library?.totalPages ?? 1)}
              onClick={() => {
                setIsLoadingLibrary(true);
                startTransition(() =>
                  setLibraryPage((page) => Math.min(library?.totalPages ?? page, page + 1)),
                );
              }}
              type="button"
            >
              Next
            </button>
          </div>
          </section>

          <section className="detail-sidebar">
            <dl>
              <div>
                <dt>Grid Size</dt>
                <dd>{`${columnCount} x ${rowCount}`}</dd>
              </div>
              <div>
                <dt>Unique Maps</dt>
                <dd>{uniqueIds.length}</dd>
              </div>
              <div>
                <dt>Output Size</dt>
                <dd>{`${columnCount * 128} x ${rowCount * 128}`}</dd>
              </div>
              <div>
                <dt>Layout</dt>
                <dd className="composer-layout-code">{layout}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
