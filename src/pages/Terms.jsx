import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, post, put, SITE_URL } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Notice, Pages, SearchBox, Spinner, useNotice, useSelection } from "../components/ui.jsx";
import { slugify } from "../utils.js";

const ICONS = ["roadside-tips", "car-care", "car-wash", "driving-safety", "technology", "company-news"];

function TermForm({ type, initial, categories, onSubmit, onCancel, submitLabel }) {
  const [f, setF] = useState({ name: "", slug: "", parent: "", description: "", icon: "", sub: "", ...initial, parent: initial?.parent || "" });
  const isCat = type === "category";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const body = { name: f.name, slug: f.slug || undefined, description: f.description };
        if (isCat) Object.assign(body, { parent: f.parent || null, icon: f.icon, sub: f.sub });
        onSubmit(body);
      }}
    >
      <div className="field"><label className="lbl" htmlFor="t-name">Name</label><input id="t-name" type="text" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><p className="help">The name is how it appears on your site.</p></div>
      <div className="field"><label className="lbl" htmlFor="t-slug">Slug</label><input id="t-slug" type="text" value={f.slug} placeholder={slugify(f.name)} onChange={(e) => setF({ ...f, slug: e.target.value })} /><p className="help">The “slug” is the URL-friendly version of the name. Lowercase letters, numbers, and hyphens.</p></div>
      {isCat && (
        <>
          <div className="field">
            <label className="lbl" htmlFor="t-parent">Parent Category</label>
            <select id="t-parent" value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })}>
              <option value="">None</option>
              {categories.filter((c) => c._id !== initial?._id).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <p className="help">Categories can have a hierarchy, e.g. “Car Care” → “Engine Oil”.</p>
          </div>
          <div className="field"><label className="lbl" htmlFor="t-sub">Subtitle</label><input id="t-sub" type="text" value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} /><p className="help">Small text under the category chip on the blog (e.g. “Maintenance tips”).</p></div>
          <div className="field">
            <label className="lbl" htmlFor="t-icon">Icon</label>
            <select id="t-icon" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>
              <option value="">Default (tag)</option>
              {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </>
      )}
      <div className="field"><label className="lbl" htmlFor="t-desc">Description</label><textarea id="t-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="flex">
        <button className="button button-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function Terms({ type }) {
  const { can } = useAuth();
  const isCat = type === "category";
  const base = isCat ? "/admin/categories" : "/admin/tags";
  const L = isCat ? { one: "Category", many: "Categories" } : { one: "Tag", many: "Tags" };
  const [items, setItems] = useState([]);
  const [all, setAll] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [order, setOrder] = useState({ orderby: "", order: "" });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [bulk, setBulk] = useState("");
  const sel = useSelection(items);
  const { notice, show, fail, clear } = useNotice();
  const manage = can("manage_categories");

  const load = () => {
    setLoading(true);
    get(base, { page, limit: 20, q, ...order })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
    if (isCat) get(base, { all: 1 }).then((r) => setAll(r.data)).catch(() => {});
    sel.clear();
  };
  useEffect(load, [page, q, order.orderby, order.order]);

  const create = async (body) => {
    try {
      await post(base, body);
      show(`${L.one} added.`);
      setFormKey((k) => k + 1);
      load();
    } catch (e) { fail(e); }
  };
  const save = async (body) => {
    try {
      await put(`${base}/${editing._id}`, body);
      show(`${L.one} updated.`);
      setEditing(null);
      load();
    } catch (e) { fail(e); }
  };
  const remove = async (t) => {
    if (!confirm(`You are about to permanently delete “${t.name}”. Posts in it will not be deleted.`)) return;
    try {
      await del(`${base}/${t._id}`);
      show(`${L.one} deleted.`);
      load();
    } catch (e) { fail(e); }
  };
  const applyBulk = async () => {
    if (bulk !== "delete" || !sel.selected.length || !confirm(`Delete ${sel.selected.length} ${L.many.toLowerCase()}?`)) return;
    try {
      const r = await post(`${base}/bulk-delete`, { ids: sel.selected });
      show(`${r.deleted} ${L.many.toLowerCase()} deleted.`);
      load();
    } catch (e) { fail(e); }
  };
  const sortBy = (f) => setOrder((o) => ({ orderby: f, order: o.orderby === f && o.order !== "desc" ? "desc" : "asc" }));
  const depth = (t) => {
    let d = 0;
    let p = t.parent;
    while (p && d < 5) { d++; p = all.find((x) => x._id === p)?.parent; }
    return d;
  };

  if (editing) {
    return (
      <div className="wrap" style={{ maxWidth: 800 }}>
        <h1 className="page-title">Edit {L.one}</h1>
        <Notice notice={notice} onClose={clear} />
        <p><a href="#" onClick={(e) => { e.preventDefault(); setEditing(null); }}>← Back to {L.many}</a></p>
        <TermForm type={type} initial={editing} categories={all} onSubmit={save} onCancel={() => setEditing(null)} submitLabel="Update" />
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1 className="page-title">{L.many}</h1>
      {q && <span className="subtitle">Search results for: <strong>{q}</strong></span>}
      <Notice notice={notice} onClose={clear} />
      <div className="col-wrap-2">
        <div className="form-wrap">
          <h2>Add New {L.one}</h2>
          <TermForm key={formKey} type={type} categories={all} onSubmit={create} submitLabel={`Add New ${L.one}`} />
        </div>
        <div>
          <SearchBox value={q} onSearch={(s) => { setPage(1); setQ(s); }} label={`Search ${L.many}`} />
          <div className="tablenav" style={{ clear: "both" }}>
            {manage ? (
              <div className="actions">
                <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk actions"><option value="">Bulk actions</option><option value="delete">Delete</option></select>
                <button className="button" onClick={applyBulk}>Apply</button>
              </div>
            ) : <div />}
            <Pages meta={meta} page={page} setPage={setPage} />
          </div>
          <table className="widefat">
            <thead>
              <tr>
                {manage && <td className="check-column"><input type="checkbox" checked={sel.all} onChange={sel.toggleAll} aria-label="Select all" /></td>}
                <th className="sortable" onClick={() => sortBy("name")}>Name</th>
                <th className="hide-sm">Description</th>
                <th className="sortable hide-sm" onClick={() => sortBy("slug")}>Slug</th>
                <th className="column-count sortable" onClick={() => sortBy("count")}>Count</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="no-items"><td colSpan={5}><Spinner /></td></tr>}
              {!loading && items.length === 0 && <tr className="no-items"><td colSpan={5}>No {L.many.toLowerCase()} found.</td></tr>}
              {!loading && items.map((t) => (
                <tr key={t._id}>
                  {manage && <th className="check-column">{!t.isDefault && <input type="checkbox" checked={sel.has(t._id)} onChange={() => sel.toggle(t._id)} aria-label={`Select ${t.name}`} />}</th>}
                  <td>
                    <strong>{isCat && "— ".repeat(depth(t))}{manage ? <a className="row-title" href="#" onClick={(e) => { e.preventDefault(); setEditing(t); }}>{t.name}</a> : t.name}</strong>
                    {t.isDefault && <span className="post-state"> — Default</span>}
                    {manage && (
                      <div className="row-actions">
                        <span><button onClick={() => setEditing(t)}>Edit</button></span>
                        {!t.isDefault && <span className="delete"><button onClick={() => remove(t)}>Delete</button></span>}
                        <span><a href={isCat ? `${SITE_URL}/blog?category=${t.slug}` : `${SITE_URL}/blog/tag/${t.slug}`} target="_blank" rel="noreferrer">View</a></span>
                      </div>
                    )}
                  </td>
                  <td className="hide-sm">{t.description || <span className="muted">—</span>}</td>
                  <td className="hide-sm">{t.slug}</td>
                  <td className="column-count"><Link to={`/posts?${isCat ? "category" : "tag"}=${t._id}`}>{t.count}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {isCat && <p className="help">Deleting a category does not delete the posts in it. Posts left without a category are moved to the default category “Uncategorized”.</p>}
        </div>
      </div>
    </div>
  );
}
