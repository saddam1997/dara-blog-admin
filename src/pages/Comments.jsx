import { useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { del, get, post, put, SITE_URL } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Notice, Pages, SearchBox, Spinner, useNotice, useSelection } from "../components/ui.jsx";
import { fmtDate } from "../utils.js";

const TABS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["spam", "Spam"],
  ["trash", "Trash"],
];

export default function Comments() {
  const [sp, setSp] = useSearchParams();
  const { can } = useAuth();
  const { refreshBadges } = useOutletContext();
  const status = sp.get("status") || "all";
  const postId = sp.get("post") || "";
  const page = Number(sp.get("page") || 1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulk, setBulk] = useState("");
  const [reply, setReply] = useState(null); // { id, text }
  const [edit, setEdit] = useState(null); // { id, authorName, authorEmail, authorUrl, content }
  const sel = useSelection(items);
  const { notice, show, fail, clear } = useNotice();
  const mod = can("moderate_comments");

  const setParam = (patch) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!("page" in patch)) n.delete("page");
    setSp(n);
  };

  const load = () => {
    setLoading(true);
    get("/admin/comments", { status, page, limit: 20, q: sp.get("s"), post: postId })
      .then((r) => { setItems(r.data); setMeta(r.meta); })
      .catch(fail)
      .finally(() => setLoading(false));
    sel.clear();
  };
  useEffect(load, [sp.toString()]);

  const after = (msg) => { show(msg); load(); refreshBadges?.(); };
  const setStatus = async (c, s, msg) => {
    try { await put(`/admin/comments/${c._id}`, { status: s }); after(msg); } catch (e) { fail(e); }
  };
  const bulkAct = async (action, ids, msg) => {
    try { await post("/admin/comments/bulk", { ids, action }); after(msg); } catch (e) { fail(e); }
  };
  const applyBulk = () => {
    if (!bulk || !sel.selected.length) return;
    if (bulk === "delete" && !confirm("Permanently delete the selected comments?")) return;
    bulkAct(bulk, sel.selected, `${sel.selected.length} comment(s) updated.`);
    setBulk("");
  };
  const sendReply = async () => {
    if (!reply.text.trim()) return;
    try { await post(`/admin/comments/${reply.id}/reply`, { content: reply.text }); setReply(null); after("Reply posted."); } catch (e) { fail(e); }
  };
  const saveEdit = async () => {
    const { id, ...body } = edit;
    try { await put(`/admin/comments/${id}`, body); setEdit(null); after("Comment updated."); } catch (e) { fail(e); }
  };

  const counts = meta?.counts || {};
  const bulkOptions = {
    all: [["unapprove", "Unapprove"], ["approve", "Approve"], ["spam", "Mark as spam"], ["trash", "Move to Trash"]],
    pending: [["approve", "Approve"], ["spam", "Mark as spam"], ["trash", "Move to Trash"]],
    approved: [["unapprove", "Unapprove"], ["spam", "Mark as spam"], ["trash", "Move to Trash"]],
    spam: [["notspam", "Not spam"], ["delete", "Delete permanently"]],
    trash: [["restore", "Restore"], ["delete", "Delete permanently"]],
  }[status];

  return (
    <div className="wrap">
      <h1 className="page-title">Comments</h1>
      {postId && items[0]?.post && <span className="subtitle">on “<Link to={`/posts/${postId}`}>{items[0].post.title}</Link>” · <a href="#" onClick={(e) => { e.preventDefault(); setParam({ post: "" }); }}>show all</a></span>}
      {sp.get("s") && <span className="subtitle">Search results for: <strong>{sp.get("s")}</strong></span>}
      <Notice notice={notice} onClose={clear} />

      <div className="toprow">
        <ul className="subsubsub">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <a className={status === k ? "current" : ""} onClick={() => setParam({ status: k === "all" ? "" : k })}>
                {label} <span className="count">({counts[k] ?? 0})</span>
              </a>
            </li>
          ))}
        </ul>
        <SearchBox value={sp.get("s")} onSearch={(s) => setParam({ s })} label="Search Comments" />
      </div>

      <div className="tablenav">
        <div className="actions">
          {mod && (
            <>
              <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk actions">
                <option value="">Bulk actions</option>
                {bulkOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="button" onClick={applyBulk} disabled={!sel.selected.length}>Apply</button>
              {(status === "spam" || status === "trash") && counts[status] > 0 && (
                <button className="button" onClick={async () => { if (!confirm(`Empty ${status}?`)) return; try { await del("/admin/comments/empty", { status }); after(`${status === "spam" ? "Spam" : "Trash"} emptied.`); } catch (e) { fail(e); } }}>
                  Empty {status === "spam" ? "Spam" : "Trash"}
                </button>
              )}
            </>
          )}
        </div>
        <Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} />
      </div>

      <table className="widefat">
        <thead>
          <tr>
            {mod && <td className="check-column"><input type="checkbox" checked={sel.all} onChange={sel.toggleAll} aria-label="Select all" /></td>}
            <th style={{ width: "20%" }}>Author</th>
            <th>Comment</th>
            <th className="hide-sm" style={{ width: "18%" }}>In response to</th>
            <th className="column-date hide-sm">Submitted on</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr className="no-items"><td colSpan={5}><Spinner /></td></tr>}
          {!loading && items.length === 0 && <tr className="no-items"><td colSpan={5}>No comments found.</td></tr>}
          {!loading && items.map((c) => (
            <tr key={c._id} className={c.status === "pending" ? "unapproved" : ""}>
              {mod && <th className="check-column"><input type="checkbox" checked={sel.has(c._id)} onChange={() => sel.toggle(c._id)} aria-label="Select comment" /></th>}
              <td>
                <div className="comment-author">
                  <img src={c.avatar} alt="" />
                  <div>
                    <strong>{c.authorName}</strong>
                    {c.authorUrl && <div><a href={c.authorUrl} target="_blank" rel="noreferrer nofollow">{c.authorUrl.replace(/^https?:\/\//, "").slice(0, 30)}</a></div>}
                    <div className="em"><a href={`mailto:${c.authorEmail}`}>{c.authorEmail}</a></div>
                    {mod && c.ip && <div className="em"><a href="#" onClick={(e) => { e.preventDefault(); setParam({ s: c.ip }); }}>{c.ip}</a></div>}
                  </div>
                </div>
              </td>
              <td>
                {c.parent && <p className="muted" style={{ marginTop: 0 }}>In reply to <strong>{c.parent.authorName}</strong>.</p>}
                {edit?.id === c._id ? (
                  <div className="inline-reply">
                    <div className="flex" style={{ marginBottom: 6 }}>
                      <input type="text" value={edit.authorName} onChange={(e) => setEdit({ ...edit, authorName: e.target.value })} aria-label="Name" />
                      <input type="email" value={edit.authorEmail} onChange={(e) => setEdit({ ...edit, authorEmail: e.target.value })} aria-label="Email" />
                      <input type="url" value={edit.authorUrl} onChange={(e) => setEdit({ ...edit, authorUrl: e.target.value })} aria-label="URL" placeholder="URL" />
                    </div>
                    <textarea value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} aria-label="Comment" />
                    <div className="flex" style={{ marginTop: 6 }}>
                      <button className="button button-primary" onClick={saveEdit}>Update Comment</button>
                      <button className="button" onClick={() => setEdit(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-text">{c.content}</div>
                )}
                {mod && (
                  <div className="row-actions">
                    {c.status === "pending" && <span><button style={{ color: "#007017" }} onClick={() => setStatus(c, "approved", "Comment approved.")}>Approve</button></span>}
                    {c.status === "approved" && <span><button style={{ color: "#996800" }} onClick={() => setStatus(c, "pending", "Comment unapproved.")}>Unapprove</button></span>}
                    {["pending", "approved"].includes(c.status) && (
                      <>
                        <span><button onClick={() => setReply({ id: c._id, text: "" })}>Reply</button></span>
                        <span><button onClick={() => setEdit({ id: c._id, authorName: c.authorName, authorEmail: c.authorEmail, authorUrl: c.authorUrl, content: c.content })}>Edit</button></span>
                        <span className="delete"><button onClick={() => bulkAct("spam", [c._id], "Comment marked as spam.")}>Spam</button></span>
                        <span className="trash"><button onClick={() => bulkAct("trash", [c._id], "Comment moved to the Trash.")}>Trash</button></span>
                      </>
                    )}
                    {c.status === "spam" && <span><button onClick={() => bulkAct("notspam", [c._id], "Comment restored from spam.")}>Not Spam</button></span>}
                    {c.status === "trash" && <span><button onClick={() => bulkAct("restore", [c._id], "Comment restored from the Trash.")}>Restore</button></span>}
                    {["spam", "trash"].includes(c.status) && (
                      <span className="delete"><button onClick={() => confirm("Delete permanently?") && del(`/admin/comments/${c._id}`).then(() => after("Comment permanently deleted.")).catch(fail)}>Delete Permanently</button></span>
                    )}
                  </div>
                )}
                {reply?.id === c._id && (
                  <div className="inline-reply">
                    <label className="lbl" htmlFor={`reply-${c._id}`}><strong>Reply to Comment</strong></label>
                    <textarea id={`reply-${c._id}`} autoFocus value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value })} />
                    <div className="flex" style={{ marginTop: 6 }}>
                      <button className="button button-primary" onClick={sendReply}>{c.status === "pending" ? "Approve and Reply" : "Reply"}</button>
                      <button className="button" onClick={() => setReply(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </td>
              <td className="hide-sm">
                {c.post ? (
                  <>
                    <Link to={`/posts/${c.post._id}`}><strong>{c.post.title}</strong></Link>
                    <br />
                    {c.post.status === "publish" && <a href={`${SITE_URL}/blog/${c.post.slug}#comments`} target="_blank" rel="noreferrer">View Post</a>}
                    {" · "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setParam({ post: c.post._id }); }}>All comments</a>
                  </>
                ) : "—"}
              </td>
              <td className="column-date hide-sm">{fmtDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tablenav"><div /><Pages meta={meta} page={page} setPage={(n) => setParam({ page: String(n) })} /></div>
    </div>
  );
}
