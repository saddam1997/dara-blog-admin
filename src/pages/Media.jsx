import { useEffect, useState } from "react";
import { del, get, post, put } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Thumb } from "../components/MediaModal.jsx";
import Uploader from "../components/Uploader.jsx";
import { Modal, Notice, Pages, Spinner, useNotice, useSelection } from "../components/ui.jsx";
import { fileSize, fmtDate, monthLabel } from "../utils.js";

function Details({ m, onClose, onSaved, onDeleted, fail }) {
  const [f, setF] = useState({ title: m.title, alt: m.alt, caption: m.caption, description: m.description });
  const [usedIn, setUsedIn] = useState(null);
  const [busy, setBusy] = useState(false);
  const isImage = m.mimeType.startsWith("image/") && m.mimeType !== "image/gif";

  useEffect(() => {
    get(`/admin/media/${m._id}`).then((r) => setUsedIn(r.meta.usedIn)).catch(() => {});
  }, [m._id]);

  const save = async () => {
    setBusy(true);
    try {
      onSaved((await put(`/admin/media/${m._id}`, f)).data, "Media updated.");
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const edit = async (body, msg) => {
    setBusy(true);
    try {
      onSaved((await post(`/admin/media/${m._id}/edit`, body)).data, msg, true);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const remove = async () => {
    const warn = usedIn?.length ? `\n\nThis file is used in ${usedIn.length} post(s). It will be removed from their featured/hero image.` : "";
    if (!confirm(`You are about to permanently delete this item from your site.${warn}\n\nThis action cannot be undone.`)) return;
    try {
      await del(`/admin/media/${m._id}`);
      onDeleted();
    } catch (e) { fail(e); }
  };

  return (
    <Modal title="Attachment details" onClose={onClose}>
      <div className="media-detail">
        <div className="preview">
          {m.mimeType.startsWith("image/") ? <img src={`${m.url}?v=${m.updatedAt}`} alt={m.alt} /> : m.mimeType.startsWith("video/") ? <video src={m.url} controls style={{ maxWidth: "100%" }} /> : <a href={m.url} target="_blank" rel="noreferrer">📄 Open {m.originalName}</a>}
        </div>
        <div className="attachment-details" style={{ border: 0 }}>
          <div className="meta">
            <strong>Uploaded on:</strong> {fmtDate(m.createdAt)}<br />
            <strong>Uploaded by:</strong> {m.uploadedBy?.displayName || "—"}<br />
            <strong>File name:</strong> {m.filename}<br />
            <strong>File type:</strong> {m.mimeType}<br />
            <strong>File size:</strong> {fileSize(m.size)}<br />
            {m.width && <><strong>Dimensions:</strong> {m.width} × {m.height} pixels<br /></>}
            {usedIn && usedIn.length > 0 && <><strong>Used in:</strong> {usedIn.map((p) => p.title).join(", ")}<br /></>}
          </div>
          {isImage && (
            <div className="flex" style={{ marginBottom: 10 }}>
              <span className="muted">Edit image:</span>
              <button className="button button-small" disabled={busy} onClick={() => edit({ rotate: 270 }, "Image rotated.")} title="Rotate left">⟲</button>
              <button className="button button-small" disabled={busy} onClick={() => edit({ rotate: 90 }, "Image rotated.")} title="Rotate right">⟳</button>
              <button className="button button-small" disabled={busy} onClick={() => edit({ flop: true }, "Image flipped.")} title="Flip horizontally">⇋</button>
              <button className="button button-small" disabled={busy} onClick={() => edit({ flip: true }, "Image flipped.")} title="Flip vertically">⇵</button>
              <button
                className="button button-small"
                disabled={busy}
                onClick={() => {
                  const w = Number(prompt(`New width in pixels (current ${m.width}px)`, Math.round(m.width / 2)));
                  if (w > 0 && w < m.width) edit({ scale: { width: w } }, "Image scaled.");
                }}
              >
                Scale
              </button>
              <button
                className="button button-small"
                disabled={busy}
                onClick={() => {
                  const v = prompt(`Crop: left,top,width,height in px (image is ${m.width}×${m.height})`, `0,0,${m.width},${Math.round((m.width * 9) / 16)}`);
                  if (!v) return;
                  const [left, top, width, height] = v.split(",").map((n) => parseInt(n, 10));
                  if ([left, top, width, height].some((n) => Number.isNaN(n))) return;
                  edit({ crop: { left, top, width, height } }, "Image cropped.");
                }}
              >
                Crop
              </button>
            </div>
          )}
          <div className="field"><span>Alternative Text</span><textarea rows={2} value={f.alt} onChange={(e) => setF({ ...f, alt: e.target.value })} /><p className="help">Describe the purpose of the image. Leave empty if purely decorative.</p></div>
          <div className="field"><span>Title</span><input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><span>Caption</span><textarea rows={2} value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} /></div>
          <div className="field"><span>Description</span><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field"><span>File URL</span><input type="text" readOnly value={m.url} onFocus={(e) => e.target.select()} /><button className="button button-small" style={{ marginTop: 4 }} onClick={() => navigator.clipboard?.writeText(m.url)}>Copy URL to clipboard</button></div>
          <div className="flex" style={{ justifyContent: "space-between" }}>
            <button className="button button-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <a href={m.url} target="_blank" rel="noreferrer">View media file</a>
            <button className="button-link button-link-delete" onClick={remove}>Delete permanently</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Media({ uploadOnly }) {
  const { can, user } = useAuth();
  const [mode, setMode] = useState(() => localStorage.getItem("dara_media_mode") || "grid");
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: "", month: "", q: "" });
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(Boolean(uploadOnly));
  const [open, setOpen] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const sel = useSelection(items);
  const { notice, show, fail, clear } = useNotice();

  const load = () => {
    setLoading(true);
    get("/admin/media", { page, limit: mode === "grid" ? 60 : 20, ...filters })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
    sel.clear();
  };
  useEffect(load, [page, filters.type, filters.month, filters.q, mode]);

  const canEdit = (m) => can("edit_others_media") || m.uploadedBy?._id === user._id;
  const bulkDelete = async () => {
    if (!sel.selected.length || !confirm(`Permanently delete ${sel.selected.length} item(s)? This cannot be undone.`)) return;
    try {
      const r = await post("/admin/media/bulk-delete", { ids: sel.selected });
      show(`${r.deleted} media file(s) permanently deleted.`);
      setBulkMode(false);
      load();
    } catch (e) { fail(e); }
  };
  const setMode2 = (m) => { setMode(m); localStorage.setItem("dara_media_mode", m); };

  return (
    <div className="wrap">
      <h1 className="page-title">{uploadOnly ? "Upload New Media" : "Media Library"}</h1>
      {!uploadOnly && <button className="button page-title-action" onClick={() => setShowUpload(!showUpload)}>Add New Media File</button>}
      <Notice notice={notice} onClose={clear} />

      {showUpload && (
        <Uploader
          onError={fail}
          onUploaded={(list) => {
            show(`${list.length} file(s) uploaded.`);
            if (uploadOnly) setItems((cur) => [...list, ...cur]);
            else { setPage(1); load(); }
          }}
        />
      )}

      {uploadOnly ? (
        items.length > 0 && (
          <table className="widefat"><tbody>{items.map((m) => (
            <tr key={m._id}><td className="thumb-cell" style={{ width: 70 }}><Thumb m={m} /></td><td><strong>{m.originalName}</strong><br /><a href="#" onClick={(e) => { e.preventDefault(); setOpen(m); }}>Edit</a> · <a href={m.url} target="_blank" rel="noreferrer">Copy URL</a></td></tr>
          ))}</tbody></table>
        )
      ) : (
        <>
          <div className="media-toolbar">
            <div className="flex">
              <button className={`button ${mode === "list" ? "button-primary" : ""}`} onClick={() => setMode2("list")} aria-label="List view" title="List view">☰</button>
              <button className={`button ${mode === "grid" ? "button-primary" : ""}`} onClick={() => setMode2("grid")} aria-label="Grid view" title="Grid view">▦</button>
              <select value={filters.type} onChange={(e) => { setPage(1); setFilters({ ...filters, type: e.target.value }); }} aria-label="Filter by type">
                <option value="">All media items</option><option value="image">Images</option><option value="video">Video</option><option value="document">Documents</option>
              </select>
              <select value={filters.month} onChange={(e) => { setPage(1); setFilters({ ...filters, month: e.target.value }); }} aria-label="Filter by date">
                <option value="">All dates</option>{(meta?.months || []).map((mo) => <option key={mo} value={mo}>{monthLabel(mo)}</option>)}
              </select>
              {mode === "grid" && (bulkMode ? (
                <>
                  <button className="button button-primary" onClick={bulkDelete} disabled={!sel.selected.length}>Delete permanently</button>
                  <button className="button" onClick={() => { setBulkMode(false); sel.clear(); }}>Cancel</button>
                </>
              ) : <button className="button" onClick={() => setBulkMode(true)}>Bulk select</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setFilters({ ...filters, q: e.target.q.value }); }} className="flex">
              <input name="q" type="search" placeholder="Search media" defaultValue={filters.q} aria-label="Search media" />
            </form>
          </div>

          {loading ? <p><Spinner /></p> : mode === "grid" ? (
            <>
              <div className="attachments">
                {items.map((m) => (
                  <button key={m._id} type="button" className={`attachment ${sel.has(m._id) ? "selected" : ""}`} title={m.title}
                    onClick={() => (bulkMode ? canEdit(m) && sel.toggle(m._id) : setOpen(m))}>
                    <Thumb m={m} />
                    {sel.has(m._id) && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
              {items.length === 0 && <p className="muted">No media files found.</p>}
            </>
          ) : (
            <>
              <div className="tablenav">
                <div className="actions"><button className="button" onClick={bulkDelete} disabled={!sel.selected.length}>Delete permanently</button></div>
                <Pages meta={meta} page={page} setPage={setPage} />
              </div>
              <table className="widefat">
                <thead><tr><td className="check-column"><input type="checkbox" checked={sel.all} onChange={sel.toggleAll} aria-label="Select all" /></td><th>File</th><th className="hide-sm">Author</th><th className="hide-sm">Size</th><th>Date</th></tr></thead>
                <tbody>
                  {items.length === 0 && <tr className="no-items"><td colSpan={5}>No media files found.</td></tr>}
                  {items.map((m) => (
                    <tr key={m._id}>
                      <th className="check-column">{canEdit(m) && <input type="checkbox" checked={sel.has(m._id)} onChange={() => sel.toggle(m._id)} aria-label={`Select ${m.title}`} />}</th>
                      <td>
                        <div className="flex" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                          <div className="thumb-cell"><Thumb m={m} /></div>
                          <div>
                            <strong><a className="row-title" href="#" onClick={(e) => { e.preventDefault(); setOpen(m); }}>{m.title || m.originalName}</a></strong>
                            <div className="muted">{m.filename}</div>
                            <div className="row-actions">
                              <span><button onClick={() => setOpen(m)}>Edit</button></span>
                              {canEdit(m) && <span className="delete"><button onClick={async () => { if (!confirm("Delete permanently?")) return; try { await del(`/admin/media/${m._id}`); show("Media file permanently deleted."); load(); } catch (e) { fail(e); } }}>Delete Permanently</button></span>}
                              <span><a href={m.url} target="_blank" rel="noreferrer">View</a></span>
                              <span><button onClick={() => navigator.clipboard?.writeText(m.url)}>Copy URL</button></span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hide-sm">{m.uploadedBy?.displayName}</td>
                      <td className="hide-sm">{fileSize(m.size)}{m.width ? <><br /><span className="muted">{m.width}×{m.height}</span></> : null}</td>
                      <td>{fmtDate(m.createdAt, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {mode === "grid" && <div className="tablenav"><div /><Pages meta={meta} page={page} setPage={setPage} /></div>}
        </>
      )}

      {open && (
        <Details
          m={open}
          fail={fail}
          onClose={() => setOpen(null)}
          onSaved={(m, msg, keepOpen) => {
            show(msg);
            setItems((list) => list.map((x) => (x._id === m._id ? { ...m, uploadedBy: x.uploadedBy } : x)));
            if (keepOpen) setOpen({ ...m, uploadedBy: open.uploadedBy });
            else setOpen(null);
          }}
          onDeleted={() => { setOpen(null); show("Media file permanently deleted."); load(); }}
        />
      )}
    </div>
  );
}
