import { useCallback, useEffect, useState } from "react";

export function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.type || "success"}`} role={notice.type === "error" ? "alert" : "status"}>
      <p>{notice.text}</p>
      {onClose && (
        <button className="dismiss" onClick={onClose} aria-label="Dismiss this notice">
          ×
        </button>
      )}
    </div>
  );
}

/** const [notice, show, clear] = useNotice() */
export function useNotice() {
  const [notice, setNotice] = useState(null);
  const show = useCallback((text, type = "success") => {
    setNotice({ text, type });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const fail = useCallback((e) => show(e?.message || String(e), "error"), [show]);
  return { notice, show, fail, clear: () => setNotice(null) };
}

export function Pages({ meta, page, setPage }) {
  if (!meta) return null;
  const { total, totalPages } = meta;
  return (
    <div className="tablenav-pages">
      <span>
        {total} item{total === 1 ? "" : "s"}
      </span>
      {totalPages > 1 && (
        <>
          <button className="button" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page">«</button>
          <button className="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
          <span>
            {page} of {totalPages}
          </span>
          <button className="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
          <button className="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">»</button>
        </>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size || ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Postbox({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`postbox ${open ? "" : "closed"}`}>
      <h2 className="hndle" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="toggle" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </h2>
      <div className="inside">{children}</div>
    </div>
  );
}

export const Spinner = () => <span className="spinner" aria-label="Loading" />;

/** Checkbox helpers for list tables */
export function useSelection(items) {
  const [selected, setSelected] = useState([]);
  const ids = items.map((i) => i._id);
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  return {
    selected,
    clear: () => setSelected([]),
    toggle: (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    toggleAll: () => setSelected(all ? [] : ids),
    all,
    has: (id) => selected.includes(id),
  };
}

export function SearchBox({ value, onSearch, label = "Search" }) {
  const [q, setQ] = useState(value || "");
  return (
    <form
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim());
      }}
    >
      <label className="sr-only" htmlFor="search-input">{label}</label>
      <input id="search-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="button">{label}</button>
    </form>
  );
}
