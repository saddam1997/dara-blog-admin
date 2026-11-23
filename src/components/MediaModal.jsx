import { useEffect, useState } from "react";
import { get, put } from "../api.js";
import { Modal, Spinner } from "./ui.jsx";
import Uploader from "./Uploader.jsx";
import { fileSize, fmtDate } from "../utils.js";

export function Thumb({ m }) {
  if (m.mimeType?.startsWith("image/")) return <img src={m.sizes?.medium?.url || m.sizes?.thumbnail?.url || m.url} alt={m.alt || ""} loading="lazy" />;
  return <div className="file"><span style={{ fontSize: 32 }}>{m.mimeType === "application/pdf" ? "📄" : "🎬"}</span>{m.originalName}</div>;
}

/**
 * WordPress-style media frame.
 * onSelect(media | null). imagesOnly limits the library to images.
 */
export default function MediaModal({ title = "Select Media", buttonLabel = "Select", onSelect, onClose, imagesOnly }) {
  const [tab, setTab] = useState("library");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState("");
  // Typed-but-not-yet-saved alt/title/caption, merged into the selection on insert.
  const [draft, setDraft] = useState({});
  const pick = (m) => {
    setSel(m);
    setDraft({});
  };
  const choose = () => {
    const final = { ...sel, ...draft };
    Object.keys(draft).forEach((k) => saveField(k, draft[k]).catch(() => {}));
    onSelect(final);
  };

  const load = (p = 1, query = q) => {
    setLoading(true);
    get("/admin/media", { page: p, limit: 40, q: query, type: imagesOnly ? "image" : undefined })
      .then((r) => {
        setItems((cur) => (p === 1 ? r.data : [...cur, ...r.data]));
        setMore(p < r.meta.totalPages);
        setPage(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => load(1), []);

  const saveField = async (field, value) => {
    if (!sel || sel[field] === value) return;
    try {
      const r = await put(`/admin/media/${sel._id}`, { [field]: value });
      setSel((cur) => (cur?._id === r.data._id ? r.data : cur));
      setItems((list) => list.map((i) => (i._id === r.data._id ? r.data : i)));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <button className="button button-primary button-large" disabled={!sel} onClick={choose}>
          {buttonLabel}
        </button>
      }
    >
      <div className="nav-tab-wrapper" style={{ marginTop: 0, marginBottom: 12 }}>
        <a className={`nav-tab ${tab === "upload" ? "nav-tab-active" : ""}`} onClick={() => setTab("upload")}>Upload files</a>
        <a className={`nav-tab ${tab === "library" ? "nav-tab-active" : ""}`} onClick={() => setTab("library")}>Media Library</a>
      </div>
      {error && <div className="notice notice-error"><p>{error}</p></div>}
      {tab === "upload" ? (
        <Uploader
          onError={(e) => setError(e.message)}
          onUploaded={(list) => {
            setItems((cur) => [...list, ...cur]);
            pick(list[0]);
            setTab("library");
          }}
        />
      ) : (
        <div className="media-modal-grid">
          <div>
            <form className="flex" style={{ marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); load(1, q); }}>
              <input type="search" placeholder="Search media items…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
              <button className="button">Search</button>
            </form>
            <div className="attachments">
              {items.map((m) => (
                <button type="button" key={m._id} className={`attachment ${sel?._id === m._id ? "selected" : ""}`} onClick={() => pick(m)} onDoubleClick={() => onSelect(m)} title={m.title}>
                  <Thumb m={m} />
                  {sel?._id === m._id && <span className="check">✓</span>}
                </button>
              ))}
            </div>
            {loading && <p><Spinner /></p>}
            {!loading && items.length === 0 && <p className="muted">No media items found. Upload some files first.</p>}
            {more && !loading && <p><button className="button" onClick={() => load(page + 1)}>Load more</button></p>}
          </div>
          <div className="attachment-details">
            {sel ? (
              <>
                <h3 className="mt-0" style={{ textTransform: "uppercase", fontSize: 12, color: "#646970" }}>Attachment Details</h3>
                {sel.mimeType.startsWith("image/") && <img src={sel.sizes?.medium?.url || sel.url} alt="" />}
                <div className="meta">
                  <strong>{sel.originalName}</strong><br />
                  {fmtDate(sel.createdAt, false)}<br />
                  {fileSize(sel.size)}{sel.width ? ` · ${sel.width} × ${sel.height} px` : ""}
                </div>
                <div className="field"><span>Alt Text</span><input type="text" defaultValue={sel.alt} key={`alt${sel._id}`} onChange={(e) => setDraft((d) => ({ ...d, alt: e.target.value }))} onBlur={(e) => saveField("alt", e.target.value)} /><p className="help">Describe the image for screen readers & SEO.</p></div>
                <div className="field"><span>Title</span><input type="text" defaultValue={sel.title} key={`t${sel._id}`} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={(e) => saveField("title", e.target.value)} /></div>
                <div className="field"><span>Caption</span><textarea rows={2} defaultValue={sel.caption} key={`c${sel._id}`} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} onBlur={(e) => saveField("caption", e.target.value)} /></div>
                <div className="field"><span>File URL</span><input type="text" readOnly value={sel.url} onFocus={(e) => e.target.select()} /></div>
              </>
            ) : (
              <p className="muted">Select a file to see its details.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
