import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { del, get, put } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, Notice, Pages, SearchBox, Spinner, useNotice, useSelection } from "../components/ui.jsx";
import { ROLE_LABEL } from "../utils.js";

export default function Users() {
  const [sp, setSp] = useSearchParams();
  const { user: me, can } = useAuth();
  const role = sp.get("role") || "all";
  const page = Number(sp.get("page") || 1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulk, setBulk] = useState("");
  const [newRole, setNewRole] = useState("");
  const [deleting, setDeleting] = useState(null); // { users:[], reassign:"", mode:"reassign" }
  const sel = useSelection(items.filter((u) => u._id !== me._id));
  const { notice, show, fail, clear } = useNotice();

  const setParam = (patch) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!("page" in patch)) n.delete("page");
    setSp(n);
  };
  const load = () => {
    setLoading(true);
    get("/admin/users", { role, page, q: sp.get("s"), orderby: sp.get("orderby"), order: sp.get("order") })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
    sel.clear();
  };
  useEffect(load, [sp.toString()]);

  const changeRole = async () => {
    if (!newRole || !sel.selected.length) return;
    let ok = 0;
    for (const id of sel.selected) {
      try { await put(`/admin/users/${id}`, { role: newRole }); ok++; } catch (e) { fail(e); }
    }
    if (ok) show(`Changed roles for ${ok} user(s).`);
    setNewRole("");
    load();
  };
  const startDelete = (users) => setDeleting({ users, reassign: "", mode: "reassign" });
  const confirmDelete = async () => {
    const { users, reassign, mode } = deleting;
    if (mode === "reassign" && !reassign) return fail(new Error("Choose a user to receive the content."));
    let ok = 0;
    for (const u of users) {
      try { await del(`/admin/users/${u._id}`, mode === "reassign" ? { reassign } : undefined); ok++; } catch (e) { fail(e); }
    }
    setDeleting(null);
    if (ok) show(`${ok} user(s) deleted.`);
    load();
  };
  const sortBy = (f) => setParam({ orderby: f, order: sp.get("orderby") === f && sp.get("order") !== "desc" ? "desc" : "asc" });

  const counts = meta?.counts || {};
  return (
    <div className="wrap">
      <h1 className="page-title">Users</h1>
      {can("create_users") && <Link to="/users/new" className="button page-title-action">Add New User</Link>}
      <Notice notice={notice} onClose={clear} />
      <div className="toprow">
        <ul className="subsubsub">
          {["all", "administrator", "editor", "author", "contributor", "subscriber"].filter((r) => r === "all" || counts[r]).map((r) => (
            <li key={r}><a className={role === r ? "current" : ""} onClick={() => setParam({ role: r === "all" ? "" : r })}>{r === "all" ? "All" : ROLE_LABEL[r]} <span className="count">({counts[r] || 0})</span></a></li>
          ))}
        </ul>
        <SearchBox value={sp.get("s")} onSearch={(s) => setParam({ s })} label="Search Users" />
      </div>
      <div className="tablenav">
        <div className="actions">
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk actions"><option value="">Bulk actions</option><option value="delete">Delete</option></select>
          <button className="button" disabled={!sel.selected.length} onClick={() => bulk === "delete" && startDelete(items.filter((u) => sel.has(u._id)))}>Apply</button>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Change role to">
            <option value="">Change role to…</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="button" disabled={!sel.selected.length || !newRole} onClick={changeRole}>Change</button>
        </div>
        <Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} />
      </div>
      <table className="widefat">
        <thead>
          <tr>
            <td className="check-column"><input type="checkbox" checked={sel.all} onChange={sel.toggleAll} aria-label="Select all" /></td>
            <th className="sortable" onClick={() => sortBy("username")}>Username</th>
            <th className="sortable hide-sm" onClick={() => sortBy("name")}>Name</th>
            <th className="sortable" onClick={() => sortBy("email")}>Email</th>
            <th className="column-role sortable" onClick={() => sortBy("role")}>Role</th>
            <th className="column-posts hide-sm">Posts</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr className="no-items"><td colSpan={6}><Spinner /></td></tr>}
          {!loading && items.length === 0 && <tr className="no-items"><td colSpan={6}>No users found.</td></tr>}
          {!loading && items.map((u) => (
            <tr key={u._id}>
              <th className="check-column">{u._id !== me._id && <input type="checkbox" checked={sel.has(u._id)} onChange={() => sel.toggle(u._id)} aria-label={`Select ${u.username}`} />}</th>
              <td>
                <div className="flex" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 2, background: "#dcdcde", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                    {u.avatar ? <img src={u.avatar} alt="" width={32} height={32} style={{ objectFit: "cover" }} /> : u.displayName?.[0]?.toUpperCase()}
                  </span>
                  <div>
                    <strong><Link className="row-title" to={u._id === me._id ? "/profile" : `/users/${u._id}`}>{u.username}</Link></strong>
                    {u.status === "disabled" && <span className="post-state"> — Disabled</span>}
                    <div className="row-actions">
                      <span><Link to={u._id === me._id ? "/profile" : `/users/${u._id}`}>Edit</Link></span>
                      {u._id !== me._id && can("delete_users") && <span className="delete"><button onClick={() => startDelete([u])}>Delete</button></span>}
                      <span><Link to={`/posts?author=${u._id}`}>View posts</Link></span>
                    </div>
                  </div>
                </div>
              </td>
              <td className="hide-sm">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName}</td>
              <td><a href={`mailto:${u.email}`}>{u.email}</a></td>
              <td className="column-role">{ROLE_LABEL[u.role]}</td>
              <td className="column-posts hide-sm"><Link to={`/posts?author=${u._id}`}>{u.postCount}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <Modal
          size="small"
          title="Delete Users"
          onClose={() => setDeleting(null)}
          footer={<><button className="button" onClick={() => setDeleting(null)}>Cancel</button><button className="button button-primary" onClick={confirmDelete}>Confirm Deletion</button></>}
        >
          <p>You have specified these users for deletion:</p>
          <ul>{deleting.users.map((u) => <li key={u._id}>ID #{u._id.slice(-6)}: {u.username}</li>)}</ul>
          <p><strong>What should be done with content owned by {deleting.users.length > 1 ? "these users" : "this user"}?</strong></p>
          <label style={{ display: "block", marginBottom: 6 }}><input type="radio" checked={deleting.mode === "delete"} onChange={() => setDeleting({ ...deleting, mode: "delete" })} /> Delete all content.</label>
          <label style={{ display: "block" }}>
            <input type="radio" checked={deleting.mode === "reassign"} onChange={() => setDeleting({ ...deleting, mode: "reassign" })} /> Attribute all content to:{" "}
            <select value={deleting.reassign} onChange={(e) => setDeleting({ ...deleting, reassign: e.target.value, mode: "reassign" })}>
              <option value="">Select a user</option>
              {items.filter((u) => !deleting.users.some((d) => d._id === u._id) && u.role !== "subscriber").map((u) => <option key={u._id} value={u._id}>{u.displayName} ({u.username})</option>)}
            </select>
          </label>
        </Modal>
      )}
    </div>
  );
}
