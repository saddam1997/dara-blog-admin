import { Fragment, useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { del, get, post, put, SITE_URL } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Notice, Pages, SearchBox, Spinner, useNotice, useSelection } from "../components/ui.jsx";
import { fmtDate, monthLabel, STATUS_LABEL, toLocalInput } from "../utils.js";

const TABS = [
  ["all", "All"],
  ["mine", "Mine"],
  ["publish", "Published"],
  ["future", "Scheduled"],
  ["draft", "Drafts"],
  ["pending", "Pending"],
  ["private", "Private"],
  ["sticky", "Sticky"],
  ["trash", "Trash"],
];

function QuickEdit({ p, categories, authors, onCancel, onSaved, fail }) {
  const [f, setF] = useState({
    title: p.title,
    slug: p.slug,
    publishedAt: toLocalInput(p.publishedAt),
    status: p.status === "future" ? "publish" : p.status,
    author: p.author?._id,
    categories: p.categories.map((c) => c._id),
    tags: p.tags.map((t) => t.name).join(", "),
    commentStatus: p.commentStatus,
    sticky: p.sticky,
    password: p.password || "",
  });
  const [busy, setBusy] = useState(false);
  const { can } = useAuth();

  const save = async () => {
    setBusy(true);
    try {
      // create any new tags
      const names = f.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const existing = (await get("/admin/tags", { all: 1 })).data;
      const tagIds = [];
      for (const n of names) {
        const found = existing.find((t) => t.name.toLowerCase() === n.toLowerCase());
        tagIds.push(found ? found._id : (await post("/admin/tags", { name: n })).data._id);
      }
      const body = {
        title: f.title,
        slug: f.slug,
        status: f.status,
        categories: f.categories,
        tags: tagIds,
        commentStatus: f.commentStatus,
        sticky: f.sticky,
        password: f.password,
        publishedAt: f.publishedAt ? new Date(f.publishedAt).toISOString() : null,
      };
      if (can("edit_others_posts") && f.author) body.author = f.author;
      await put(`/admin/posts/${p._id}`, body);
      onSaved();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  return (
    <tr className="inline-edit-row">
      <td colSpan={8}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 12, marginBottom: 8 }}>Quick Edit</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            <div>
              <div className="field"><span>Title</span><input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div className="field"><span>Slug</span><input type="text" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
              <div className="field"><span>Date</span><input type="datetime-local" value={f.publishedAt} onChange={(e) => setF({ ...f, publishedAt: e.target.value })} /></div>
              <div className="field"><span>Password</span><input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            </div>
            <div>
              <div className="field">
                <span>Categories</span>
                <ul className="categorychecklist">
                  {categories.map((c) => (
                    <li key={c._id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={f.categories.includes(c._id)}
                          onChange={(e) => setF({ ...f, categories: e.target.checked ? [...f.categories, c._id] : f.categories.filter((x) => x !== c._id) })}
                        />
                        {c.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <div className="field"><span>Tags</span><textarea rows={3} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /><p className="help">Separate tags with commas</p></div>
              {can("edit_others_posts") && (
                <div className="field">
                  <span>Author</span>
                  <select value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })}>
                    {authors.map((a) => <option key={a._id} value={a._id}>{a.displayName}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <span>Status</span>
                <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  {can("publish_posts") && <option value="publish">Published</option>}
                  {can("publish_posts") && <option value="private">Private</option>}
                  <option value="pending">Pending Review</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <label><input type="checkbox" checked={f.commentStatus === "open"} onChange={(e) => setF({ ...f, commentStatus: e.target.checked ? "open" : "closed" })} /> Allow Comments</label>
              {can("publish_posts") && (
                <label style={{ marginLeft: 12 }}><input type="checkbox" checked={f.sticky} onChange={(e) => setF({ ...f, sticky: e.target.checked })} /> Make this post sticky (Featured)</label>
              )}
            </div>
          </div>
          <div className="flex" style={{ marginTop: 12 }}>
            <button className="button button-primary" onClick={save} disabled={busy}>{busy ? "Updating…" : "Update"}</button>
            <button className="button" onClick={onCancel}>Cancel</button>
          </div>
        </fieldset>
      </td>
    </tr>
  );
}

function BulkEdit({ ids, categories, authors, onCancel, onDone, fail }) {
  const [f, setF] = useState({ status: "", author: "", commentStatus: "", sticky: "", addCategories: [] });
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    try {
      const data = {};
      if (f.status) data.status = f.status;
      if (f.author) data.author = f.author;
      if (f.commentStatus) data.commentStatus = f.commentStatus;
      if (f.sticky) data.sticky = f.sticky === "1";
      if (f.addCategories.length) data.addCategories = f.addCategories;
      const r = await post("/admin/posts/bulk", { ids, action: "edit", data });
      onDone(r.data);
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  const nc = "— No Change —";
  return (
    <div className="postbox" style={{ marginTop: 8 }}>
      <div className="inside">
        <strong>Bulk Edit ({ids.length} posts)</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 10 }}>
          <div className="field">
            <span>Add Categories</span>
            <ul className="categorychecklist">
              {categories.map((c) => (
                <li key={c._id}>
                  <label>
                    <input type="checkbox" checked={f.addCategories.includes(c._id)} onChange={(e) => setF({ ...f, addCategories: e.target.checked ? [...f.addCategories, c._id] : f.addCategories.filter((x) => x !== c._id) })} />
                    {c.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="field"><span>Author</span><select value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })}><option value="">{nc}</option>{authors.map((a) => <option key={a._id} value={a._id}>{a.displayName}</option>)}</select></div>
            <div className="field"><span>Comments</span><select value={f.commentStatus} onChange={(e) => setF({ ...f, commentStatus: e.target.value })}><option value="">{nc}</option><option value="open">Allow</option><option value="closed">Do not allow</option></select></div>
          </div>
          <div>
            <div className="field"><span>Status</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">{nc}</option><option value="publish">Published</option><option value="private">Private</option><option value="pending">Pending Review</option><option value="draft">Draft</option></select></div>
            <div className="field"><span>Sticky</span><select value={f.sticky} onChange={(e) => setF({ ...f, sticky: e.target.value })}><option value="">{nc}</option><option value="1">Sticky</option><option value="0">Not Sticky</option></select></div>
          </div>
        </div>
        <div className="flex">
          <button className="button button-primary" onClick={apply} disabled={busy}>{busy ? "Updating…" : "Update"}</button>
          <button className="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function Posts() {
  const [sp, setSp] = useSearchParams();
  const { can, user } = useAuth();
  const { refreshBadges } = useOutletContext();
  const status = sp.get("status") || "all";
  const page = Number(sp.get("page") || 1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [bulk, setBulk] = useState("");
  const [bulkEdit, setBulkEdit] = useState(false);
  const [quick, setQuick] = useState(null);
  const [month, setMonth] = useState(sp.get("month") || "");
  const [cat, setCat] = useState(sp.get("category") || "");
  const sel = useSelection(items);
  const { notice, show, fail, clear } = useNotice();

  const setParam = (patch) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!("page" in patch)) next.delete("page");
    setSp(next);
  };

  const load = () => {
    setLoading(true);
    const q = {
      page,
      limit: 20,
      q: sp.get("s"),
      month: sp.get("month"),
      category: sp.get("category"),
      orderby: sp.get("orderby"),
      order: sp.get("order"),
      author: sp.get("author"),
      tag: sp.get("tag"),
    };
    if (status === "mine") q.mine = 1;
    else if (status === "sticky") q.sticky = 1;
    else if (status !== "all") q.status = status;
    get("/admin/posts", q)
      .then((r) => {
        setItems(r.data);
        setMeta(r.meta);
      })
      .catch(fail)
      .finally(() => setLoading(false));
    sel.clear();
  };

  useEffect(load, [sp.toString()]);
  // Message after trashing/deleting from the editor
  useEffect(() => {
    if (sp.get("trashed") || sp.get("deleted")) {
      show(sp.get("deleted") ? "1 post permanently deleted." : "1 post moved to the Trash.");
      const next = new URLSearchParams(sp);
      next.delete("trashed");
      next.delete("deleted");
      setSp(next, { replace: true });
    }
  }, []);
  useEffect(() => {
    get("/admin/categories", { all: 1 }).then((r) => setCategories(r.data)).catch(() => {});
    get("/admin/users/authors").then((r) => setAuthors(r.data)).catch(() => {});
  }, []);

  const act = async (fn, msg) => {
    try {
      await fn();
      show(msg);
      load();
      refreshBadges?.();
    } catch (e) {
      fail(e);
    }
  };

  const applyBulk = async () => {
    if (!bulk || !sel.selected.length) return;
    if (bulk === "edit") return setBulkEdit(true);
    if (bulk === "delete" && !confirm(`Permanently delete ${sel.selected.length} post(s)?\n\nTheir comments and revisions will also be deleted. This cannot be undone.`)) return;
    act(async () => {
      const r = await post("/admin/posts/bulk", { ids: sel.selected, action: bulk, force: bulk === "delete" });
      if (r.data.failed.length) throw new Error(`${r.data.ok} done, ${r.data.failed.length} failed: ${r.data.failed[0].message}`);
    }, { trash: "Posts moved to the Trash.", restore: "Posts restored from the Trash.", delete: "Posts permanently deleted." }[bulk]);
    setBulk("");
  };

  const sortBy = (field) => {
    const cur = sp.get("orderby");
    const order = cur === field && sp.get("order") !== "desc" ? "desc" : "asc";
    setParam({ orderby: field, order });
  };
  const sortMark = (field) => (sp.get("orderby") === field ? (sp.get("order") === "desc" ? " ▼" : " ▲") : "");

  const counts = meta?.counts || {};
  const trashView = status === "trash";
  const ownOrEditor = (p) => can("edit_others_posts") || p.author?._id === user._id;

  const head = (
    <tr>
      <td className="check-column"><input type="checkbox" aria-label="Select all" checked={sel.all} onChange={sel.toggleAll} /></td>
      <th className="sortable" onClick={() => sortBy("title")}>Title{sortMark("title")}</th>
      <th className="hide-sm">Author</th>
      <th className="hide-sm">Categories</th>
      <th className="hide-sm">Tags</th>
      <th className="column-comments sortable hide-sm" onClick={() => sortBy("comments")} title="Comments">💬{sortMark("comments")}</th>
      <th className="column-comments sortable hide-sm" onClick={() => sortBy("views")} title="Views">👁{sortMark("views")}</th>
      <th className="column-date sortable" onClick={() => sortBy("date")}>Date{sortMark("date")}</th>
    </tr>
  );

  return (
    <div className="wrap">
      <h1 className="page-title">Posts</h1>
      <Link to="/posts/new" className="button page-title-action">Add New Post</Link>
      {sp.get("s") && <span className="subtitle">Search results for: <strong>{sp.get("s")}</strong></span>}
      <Notice notice={notice} onClose={clear} />

      <div className="toprow">
        <ul className="subsubsub">
          {TABS.filter(([k]) => counts[k] > 0 || k === "all" || k === status).map(([k, label]) => (
            <li key={k}>
              <a className={status === k ? "current" : ""} onClick={() => setParam({ status: k === "all" ? "" : k })}>
                {label} <span className="count">({counts[k] ?? 0})</span>
              </a>
            </li>
          ))}
        </ul>
        <SearchBox value={sp.get("s")} onSearch={(s) => setParam({ s })} label="Search Posts" />
      </div>

      <div className="tablenav">
        <div className="actions">
          <label className="sr-only" htmlFor="bulk">Bulk actions</label>
          <select id="bulk" value={bulk} onChange={(e) => setBulk(e.target.value)}>
            <option value="">Bulk actions</option>
            {trashView ? (
              <>
                <option value="restore">Restore</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : (
              <>
                <option value="edit">Edit</option>
                <option value="trash">Move to Trash</option>
                <option value="delete">Delete permanently</option>
              </>
            )}
          </select>
          <button className="button" onClick={applyBulk} disabled={!sel.selected.length}>Apply</button>
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by date">
            <option value="">All dates</option>
            {(meta?.months || []).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <button className="button" onClick={() => setParam({ month, category: cat })}>Filter</button>
          {trashView && counts.trash > 0 && (
            <button className="button" onClick={() => confirm("Permanently delete everything in the Trash?") && act(() => del("/admin/posts/trash"), "Trash emptied.")}>
              Empty Trash
            </button>
          )}
        </div>
        <Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} />
      </div>

      {bulkEdit && (
        <BulkEdit
          ids={sel.selected}
          categories={categories}
          authors={authors}
          fail={fail}
          onCancel={() => setBulkEdit(false)}
          onDone={(r) => {
            setBulkEdit(false);
            setBulk("");
            show(`${r.ok} post(s) updated${r.failed.length ? `, ${r.failed.length} skipped (${r.failed[0].message})` : ""}.`, r.failed.length ? "warning" : "success");
            load();
          }}
        />
      )}

      <table className="widefat">
        <thead>{head}</thead>
        <tbody>
          {loading && <tr className="no-items"><td colSpan={8}><Spinner /></td></tr>}
          {!loading && items.length === 0 && <tr className="no-items"><td colSpan={8}>No posts found{trashView ? " in Trash" : ""}.</td></tr>}
          {!loading &&
            items.map((p) =>
              quick === p._id ? (
                <QuickEdit key={p._id} p={p} categories={categories} authors={authors} fail={fail} onCancel={() => setQuick(null)} onSaved={() => { setQuick(null); show("Post updated."); load(); }} />
              ) : (
                <tr key={p._id}>
                  <th className="check-column"><input type="checkbox" aria-label={`Select ${p.title}`} checked={sel.has(p._id)} onChange={() => sel.toggle(p._id)} /></th>
                  <td>
                    <strong>
                      {trashView || !ownOrEditor(p) ? <span className="row-title">{p.title || "(no title)"}</span> : <Link className="row-title" to={`/posts/${p._id}`}>{p.title || "(no title)"}</Link>}
                      {status !== p.status && p.status !== "publish" && <span className="post-state"> — {STATUS_LABEL[p.status]}</span>}
                      {p.password && <span className="post-state"> — Password protected</span>}
                      {p.sticky && <span className="post-state"> — Sticky</span>}
                      {p.lock?.user && p.lock.user._id !== user._id && Date.now() - new Date(p.lock.at) < 150000 && <span className="post-state"> 🔒 {p.lock.user.displayName} is editing</span>}
                    </strong>
                    <div className="row-actions">
                      {trashView ? (
                        <>
                          <span><button onClick={() => act(() => post(`/admin/posts/${p._id}/restore`), "1 post restored from the Trash.")}>Restore</button></span>
                          <span className="delete"><button onClick={() => confirm("Delete permanently?") && act(() => del(`/admin/posts/${p._id}`), "1 post permanently deleted.")}>Delete Permanently</button></span>
                        </>
                      ) : (
                        ownOrEditor(p) && (
                          <>
                            <span><Link to={`/posts/${p._id}`}>Edit</Link></span>
                            <span><button onClick={() => setQuick(p._id)}>Quick Edit</button></span>
                            <span className="trash"><button onClick={() => act(() => post(`/admin/posts/${p._id}/trash`), "1 post moved to the Trash.")}>Trash</button></span>
                            <span className="delete">
                              <button
                                onClick={() =>
                                  confirm(`Permanently delete “${p.title || "(no title)"}”?\n\nIts comments and revisions will also be deleted. This cannot be undone.`) &&
                                  act(() => del(`/admin/posts/${p._id}`, { force: 1 }), "1 post permanently deleted.")
                                }
                              >
                                Delete
                              </button>
                            </span>
                            {p.status === "publish" ? (
                              <span><a href={`${SITE_URL}/blog/${p.slug}`} target="_blank" rel="noreferrer">View</a></span>
                            ) : (
                              <span><button onClick={async () => { try { const r = await get(`/admin/posts/${p._id}/preview-link`); window.open(r.data.url, "_blank"); } catch (e) { fail(e); } }}>Preview</button></span>
                            )}
                            <span><button onClick={() => act(() => post(`/admin/posts/${p._id}/duplicate`), "Post duplicated as a draft.")}>Duplicate</button></span>
                          </>
                        )
                      )}
                    </div>
                  </td>
                  <td className="hide-sm"><a onClick={() => setParam({ author: p.author?._id })} style={{ cursor: "pointer" }}>{p.author?.displayName}</a></td>
                  <td className="hide-sm">
                    {p.categories.map((c, i) => (
                      <Fragment key={c._id}>{i > 0 && ", "}<a style={{ cursor: "pointer" }} onClick={() => { setCat(c._id); setParam({ category: c._id }); }}>{c.name}</a></Fragment>
                    ))}
                  </td>
                  <td className="hide-sm">{p.tags.length ? p.tags.map((t) => t.name).join(", ") : "—"}</td>
                  <td className="column-comments hide-sm">
                    <Link to={`/comments?post=${p._id}`}><span className="comment-bubble">{p.commentCount}</span></Link>
                  </td>
                  <td className="column-comments hide-sm">{p.views}</td>
                  <td className="column-date">
                    {p.status === "publish" ? "Published" : p.status === "future" ? "Scheduled" : p.status === "trash" ? "Trashed" : "Last Modified"}
                    <br />
                    {fmtDate(p.status === "publish" || p.status === "future" ? p.publishedAt : p.updatedAt)}
                  </td>
                </tr>
              )
            )}
        </tbody>
        <tfoot>{head}</tfoot>
      </table>
      <div className="tablenav">
        <div />
        <Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} />
      </div>
    </div>
  );
}
